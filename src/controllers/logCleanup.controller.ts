// import { Request, Response, NextFunction } from 'express';
// import { inject } from 'inversify';
// import {
//   controller,
//   httpGet,
//   httpPost,
//   httpDelete,
//   request,
//   response,
//   next,
// } from 'inversify-express-utils';
// import { LogCleanupService } from '../services/logCleanup.service';
// import { TYPES } from '../types';
// import { deserializeUser, requireUser } from '../middleware/deserializeUser';
// import AppError from '../utils/appError';
// import logger from '../utils/logger';
// import { ControllerLogger } from '../utils/controllerLogger';

// @controller('/log-cleanup', deserializeUser, requireUser)
// export class LogCleanupController {
//   constructor(
//     @inject(TYPES.LogCleanupService)
//     private logCleanupService: LogCleanupService,
//   ) {}

//   /**
//    * Get cleanup statistics
//    * GET /log-cleanup/stats
//    */
//   @httpGet('/stats')
//   public async getCleanupStats(
//     @request() req: Request,
//     @response() res: Response,
//     @next() next: NextFunction,
//   ): Promise<void> {
//     try {
//       // Check if user is admin
//       const userRole = res.locals.user.role;
//       if (userRole !== 'SuperAdmin' && userRole !== 'Admin') {
//         return next(new AppError(403, 'Access denied. Admin only.'));
//       }

//       const stats = await this.logCleanupService.getCleanupStats();
//       const isJobRunning = this.logCleanupService.isCleanupJobRunning();
//       const nextCleanupTime = this.logCleanupService.getNextCleanupTime();

//       ControllerLogger.logView('Log Cleanup Statistics', 'stats', req, res);

//       res.status(200).json({
//         status: 'success',
//         data: {
//           ...stats,
//           automaticCleanupEnabled: isJobRunning,
//           nextCleanupTime,
//           retentionPeriod: '6 months (180 days)',
//         },
//       });
//     } catch (error) {
//       logger.error('Error fetching cleanup stats:', error);
//       ControllerLogger.logError('Log Cleanup Statistics retrieval', error, req, res);
//       next(error);
//     }
//   }

//   /**
//    * Start automatic cleanup job
//    * POST /log-cleanup/start-automatic
//    */
//   @httpPost('/start-automatic')
//   public async startAutomaticCleanup(
//     @request() req: Request,
//     @response() res: Response,
//     @next() next: NextFunction,
//   ): Promise<void> {
//     try {
//       // Check if user is SuperAdmin
//       const userRole = res.locals.user.role;
//       if (userRole !== 'SuperAdmin') {
//         return next(new AppError(403, 'Access denied. SuperAdmin only.'));
//       }

//       this.logCleanupService.startAutomaticCleanup();

//       ControllerLogger.logSuccess('Automatic log cleanup started', 'cleanup-job', req, res);

//       res.status(200).json({
//         status: 'success',
//         message: 'Automatic log cleanup job started. Will run daily at 2:00 AM.',
//       });
//     } catch (error) {
//       logger.error('Error starting automatic cleanup:', error);
//       ControllerLogger.logError('Automatic log cleanup start', error, req, res);
//       next(error);
//     }
//   }

//   /**
//    * Stop automatic cleanup job
//    * POST /log-cleanup/stop-automatic
//    */
//   @httpPost('/stop-automatic')
//   public async stopAutomaticCleanup(
//     @request() req: Request,
//     @response() res: Response,
//     @next() next: NextFunction,
//   ): Promise<void> {
//     try {
//       // Check if user is SuperAdmin
//       const userRole = res.locals.user.role;
//       if (userRole !== 'SuperAdmin') {
//         return next(new AppError(403, 'Access denied. SuperAdmin only.'));
//       }

//       this.logCleanupService.stopAutomaticCleanup();

//       ControllerLogger.logSuccess('Automatic log cleanup stopped', 'cleanup-job', req, res);

//       res.status(200).json({
//         status: 'success',
//         message: 'Automatic log cleanup job stopped.',
//       });
//     } catch (error) {
//       logger.error('Error stopping automatic cleanup:', error);
//       ControllerLogger.logError('Automatic log cleanup stop', error, req, res);
//       next(error);
//     }
//   }

//   /**
//    * Perform manual cleanup
//    * POST /log-cleanup/manual
//    */
//   @httpPost('/manual')
//   public async performManualCleanup(
//     @request() req: Request,
//     @response() res: Response,
//     @next() next: NextFunction,
//   ): Promise<void> {
//     try {
//       // Check if user is SuperAdmin
//       const userRole = res.locals.user.role;
//       if (userRole !== 'SuperAdmin') {
//         return next(new AppError(403, 'Access denied. SuperAdmin only.'));
//       }

//       const { daysToKeep = 180 } = req.body;

//       const deletedCount = await this.logCleanupService.performManualCleanup(
//         Number(daysToKeep),
//       );

//       ControllerLogger.logSuccess('Manual log cleanup performed', deletedCount.toString(), req, res);

//       res.status(200).json({
//         status: 'success',
//         message: `Manual log cleanup completed. Deleted ${deletedCount} old activity logs.`,
//         deletedCount,
//         daysKept: Number(daysToKeep),
//       });
//     } catch (error) {
//       logger.error('Error performing manual cleanup:', error);
//       ControllerLogger.logError('Manual log cleanup', error, req, res);
//       next(error);
//     }
//   }

//   /**
//    * Get cleanup job status
//    * GET /log-cleanup/status
//    */
//   @httpGet('/status')
//   public async getCleanupStatus(
//     @request() req: Request,
//     @response() res: Response,
//     @next() next: NextFunction,
//   ): Promise<void> {
//     try {
//       // Check if user is admin
//       const userRole = res.locals.user.role;
//       if (userRole !== 'SuperAdmin' && userRole !== 'Admin') {
//         return next(new AppError(403, 'Access denied. Admin only.'));
//       }

//       const isJobRunning = this.logCleanupService.isCleanupJobRunning();
//       const nextCleanupTime = this.logCleanupService.getNextCleanupTime();

//       ControllerLogger.logView('Log Cleanup Status', 'status', req, res);

//       res.status(200).json({
//         status: 'success',
//         data: {
//           automaticCleanupEnabled: isJobRunning,
//           nextCleanupTime,
//           retentionPeriod: '6 months (180 days)',
//           cleanupSchedule: 'Daily at 2:00 AM',
//         },
//       });
//     } catch (error) {
//       logger.error('Error fetching cleanup status:', error);
//       ControllerLogger.logError('Log Cleanup Status retrieval', error, req, res);
//       next(error);
//     }
//   }
// }