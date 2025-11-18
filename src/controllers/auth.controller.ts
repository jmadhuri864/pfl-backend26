import { Request, Response, NextFunction, CookieOptions } from 'express';
import config from 'config';
import { UserService } from '../services/user.service';
import AppError from '../utils/appError';
import { signJwt, verifyJwt } from '../utils/jwt';
import { inject } from 'inversify';
import jwt from 'jsonwebtoken';
import {
  controller,
  httpPost,
  request,
  response,
  next,
} from 'inversify-express-utils';
import { TYPES } from '../types';
import { User } from '../entities/user.entity';
import logger from '../utils/logger';
import { UserSystemInfoRepository } from '../repositories/userSystemInfo.repository';
import { AppDataSource } from '../utils/data-source';
import { BlacklistedToken } from '../entities/blacklistedToken.entity';
import { NotificationService } from '../services/notification.service';
import { is } from 'useragent';
import { Department } from '../utils/status.enum';
import { UserRepository } from '../repositories/user.repository';
import { ActiveSessionRepository } from '../repositories/activeSession.repository';

const blacklistedTokensRepo = AppDataSource.getRepository(BlacklistedToken);

const cookiesOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'strict',
  path: '/',
  secure: process.env.NODE_ENV === 'production',
};

const accessTokenCookieOptions: CookieOptions = {
  ...cookiesOptions,
  expires: new Date(
    Date.now() + config.get<number>('accessTokenExpiresIn') * 60 * 1000,
  ),
  maxAge: config.get<number>('accessTokenExpiresIn') * 60 * 1000,
};

const refreshTokenCookieOptions: CookieOptions = {
  ...cookiesOptions,
  expires: new Date(
    Date.now() + config.get<number>('refreshTokenExpiresIn') * 60 * 1000,
  ),
  maxAge: config.get<number>('refreshTokenExpiresIn') * 60 * 1000,
};

@controller('/auth')
export class AuthController {
  constructor(
    @inject(TYPES.UserService) private userService: UserService,
    @inject(TYPES.ActiveSessionRepository)
    private activeSessionRepository: ActiveSessionRepository,
    @inject(TYPES.UserSystemInfoRepository)
    private readonly systemLogRepository: UserSystemInfoRepository,
    @inject(TYPES.NotificationService)
    private notificationService: NotificationService,
    @inject(TYPES.UserRepository)
    private userRepository: UserRepository,
  ) {}

  @httpPost('/refresh-token')
  public async refreshAccessTokenHandler(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      logger.info('Received request to refresh access token');

      const refresh_token = req.body.refreshToken;
      if (!refresh_token) {
        logger.warn('Refresh token not provided');
        return next(
          new AppError(403, 'You need to re-authenticate. Please log in.'),
        );
      }

      const blacklistedToken = await blacklistedTokensRepo.findOne({
        where: { token: refresh_token },
      });

      if (blacklistedToken) {
        return next(
          new AppError(401, 'You need to re-authenticate. Please log in.'),
        );
      }

      const decoded = verifyJwt<{ sub: string }>(
        refresh_token,
        'refreshTokenPublicKey',
      );
      if (!decoded) {
        logger.warn('Invalid refresh token provided');
        return next(
          new AppError(403, 'You need to re-authenticate. Please log in.'),
        );
      }

      const user = await this.userService.findUserById(decoded.sub);
      if (!user) {
        logger.warn(`User not found for ID`);
        return next(
          new AppError(403, 'You need to re-authenticate. Please log in.'),
        );
      }

      const access_token = signJwt({ sub: user.id }, 'accessTokenPrivateKey', {
        expiresIn: `${config.get<number>('accessTokenExpiresIn')}m`,
      });

      res.cookie('access_token', access_token, accessTokenCookieOptions);
      res.cookie('logged_in', true, {
        ...accessTokenCookieOptions,
        httpOnly: false,
      });
      logger.info('Access token refreshed successfully', { userId: user.id });

      res.status(200).json({
        status: 'success',
        access_token,
      });
    } catch (err: any) {
      logger.error('Error while refreshing access token', {
        error: err.message,
      });
      next(err);
    }
  }

  @httpPost('/login')
  public async loginUserHandler(
    @request() req: Request<{}, {}, any>,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      logger.info('Login request received', { uid: req.body.uid });

      const { uid, password } = req.body;

      if (!uid || !password) {
        logger.warn('Missing required fields in login request');
        throw new AppError(400, 'UID and Password are required.');
      }

      const trimmedPassword = password.trim();
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(uid);
      const isPhoneNumber = /^[+\d][\d\s]+$/.test(uid);
      const isUsername = !isEmail && !isPhoneNumber;

      const user = await this.userService.findUserByIdentifier(uid);
      console.log(user);

      if (!user) {
        logger.error('User not found during login', { uid });
        throw new AppError(404, 'Please check your email or phone number.');
      }

      if (user.status === 'INACTIVE') {
        logger.error('User is inactive during login', { uid });
        throw new AppError(
          403,
          'Your account is inactive. Please contact administrator.',
        );
      }
      let isPasswordMatch;
      //const isPasswordMatch = await User.comparePasswords(trimmedPassword, user.tempPlainPassword);
      if (user.tempPlainPassword === trimmedPassword) {
        isPasswordMatch = true;
      }
      user.isOnline = true;
      await this.userRepository.save(user);
      if (!isPasswordMatch) {
        logger.warn('Invalid password during login', { uid });
        throw new AppError(401, 'Password is incorrect. Please try again.');
      }

      const permissions = user.permissions.map((permission) => ({
        documentDefinition: permission.documentDefinition
          ? {
              id: permission.documentDefinition.id,
              name: permission.documentDefinition.name,
              uniqueKey: permission.documentDefinition.uniqueKey,
            }
          : null,
        canCreate: permission.canCreate,
        canView: permission.canView,
        canEdit: permission.canEdit,
        canDelete: permission.canDelete,
        canDownload: permission.canDownload,
      }));

      const name = user.firstName + ' ' + user.lastName;

      // Store active session
      const existingSessions = await this.activeSessionRepository.find({
        where: { user_id: user.id, is_active: true },
      });
      console.log('existingSessions', existingSessions);

      if (!existingSessions || existingSessions.length === 0) {
        console.log('no existing session');

        const session = this.activeSessionRepository.create({
          user_id: user.id,
          username: name,
          is_active: true,
        });
        await this.activeSessionRepository.save(session);
        logger.info('Active session stored', { userId: user.id });
      }

      const {
        ip,
        osPlatform,
        osRelease,
        osType,
        cpuArch,
        browser,
        device,
        osName,
      } = req.systemInfo ?? {};

      const systemLog = this.systemLogRepository.create({
        userId: user.id,
        ip,
        osPlatform,
        osRelease,
        osType,
        cpuArch,
        browser,
        device,
        osName,
      });

      await this.systemLogRepository.save(systemLog);
      logger.info('System log saved', { userId: user.id });

      const { access_token, refresh_token } = await this.userService.signTokens(
        user,
      );
      logger.info('User logged in successfully', { userId: user.id });

      res.cookie('access_token', access_token, accessTokenCookieOptions);
      res.cookie('refresh_token', refresh_token, refreshTokenCookieOptions);
      res.cookie('logged_in', true, {
        ...accessTokenCookieOptions,
        httpOnly: false,
      });

      const message = `Welcome back, ${user.firstName}! You have successfully logged in.`;
      console.log(message, user.id);
      setTimeout(async () => {
        await this.notificationService.createNoti(message, user.id);
      }, 3000); // 1.5 seconds
      //await this.notificationService.createNoti(message, user.id);

      res.status(200).json({
        status: 'success',

        access_token,
        refresh_token,

        id: user.id,
        userName: name,
        // company: user.companyName?.name,
        //department: user.departments,
        roles: user.roles,
        currentWorkLocation: user.currentWorkLocation?.id,
        // level: user.currentLevel
        //   ? { id: user.currentLevel.id, name: user.currentLevel.name }
        //   : null,
        employeeId: user.employeeId,
        permissions,
      });
    } catch (err) {
      logger.error('Unexpected error during login process', { error: err });
      next(err);
    }
  }

  // @httpPost('/logout')
  // public async logoutUserHandler(
  //   req: Request,
  //   res: Response,
  //   next: NextFunction,
  // ) {
  //   try {
  //     const { refresh_token, access_token } = req.body;

  //     if (!refresh_token) {
  //       return next(new AppError(400, 'Refresh token not provided'));
  //     }
  //     if (!access_token) {
  //       return next(new AppError(400, 'Access token not provided'));
  //     }

  //    const decoded = verifyJwt<{ sub: string }>(
  //       access_token,
  //       'accessTokenPublicKey',
  //     );
  //   console.log("decoded",decoded);
  //   const user = await this.userRepository.findOne({ where: { id: decoded?.sub} });

  //   if (user) {
  //     user.isOnline = false;
  //     await this.userRepository.save(user);
  //   }
  //     const accessTokenExpiry =
  //       Math.floor(Date.now() / 1000) +
  //       config.get<number>('accessTokenExpiresIn') * 60;
  //     const accessTokenBlacklist = new BlacklistedToken();
  //     accessTokenBlacklist.token = access_token;
  //     accessTokenBlacklist.createdAt = new Date();
  //     accessTokenBlacklist.expiresAt = new Date(accessTokenExpiry * 1000);
  //     await blacklistedTokensRepo.save(accessTokenBlacklist);

  //     const refreshTokenExpiry =
  //       Math.floor(Date.now() / 1000) +
  //       config.get<number>('refreshTokenExpiresIn') * 60;
  //     const refreshTokenBlacklist = new BlacklistedToken();
  //     refreshTokenBlacklist.token = refresh_token;
  //     refreshTokenBlacklist.createdAt = new Date();
  //     refreshTokenBlacklist.expiresAt = new Date(refreshTokenExpiry * 1000);
  //     await blacklistedTokensRepo.save(refreshTokenBlacklist);

  //     res.clearCookie('access_token');
  //     res.clearCookie('refresh_token');
  //     logger.info('User logged out successfully');

  //     res.status(200).json({
  //       status: 'success',
  //       message: 'User logged out successfully',
  //     });
  //   } catch (error) {
  //     next(error);
  //   }
  // }

  @httpPost('/logout')
  public async logoutUserHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { refresh_token, access_token } = req.body;

      if (!refresh_token) {
        return next(new AppError(400, 'Refresh token not provided'));
      }
      if (!access_token) {
        return next(new AppError(400, 'Access token not provided'));
      }
      const decoded = verifyJwt<{ sub: string }>(
        access_token,
        'accessTokenPublicKey',
      );
      console.log('decoded', decoded);
      const user = await this.userRepository.findOne({
        where: { id: decoded?.sub },
      });

      if (user) {
        user.isOnline = false;
        await this.userRepository.save(user);
      }
      const accessTokenExpiry =
        Math.floor(Date.now() / 1000) +
        config.get<number>('accessTokenExpiresIn') * 60;
      const accessTokenBlacklist = new BlacklistedToken();
      accessTokenBlacklist.token = access_token;
      accessTokenBlacklist.createdAt = new Date();
      accessTokenBlacklist.expiresAt = new Date(accessTokenExpiry * 1000);
      await blacklistedTokensRepo.save(accessTokenBlacklist);

      const refreshTokenExpiry =
        Math.floor(Date.now() / 1000) +
        config.get<number>('refreshTokenExpiresIn') * 60;
      const refreshTokenBlacklist = new BlacklistedToken();
      refreshTokenBlacklist.token = refresh_token;
      refreshTokenBlacklist.createdAt = new Date();
      refreshTokenBlacklist.expiresAt = new Date(refreshTokenExpiry * 1000);
      await blacklistedTokensRepo.save(refreshTokenBlacklist);

      const decodedSession = verifyJwt<{ sub: string }>(
        access_token || refresh_token,
        'accessTokenPublicKey',
      );

      await this.activeSessionRepository.delete({
        user_id: decodedSession?.sub,
        is_active: true,
      });

      res.clearCookie('access_token');
      res.clearCookie('refresh_token');
      logger.info('User logged out successfully');

      res.status(200).json({
        status: 'success',
        message: 'User logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}
