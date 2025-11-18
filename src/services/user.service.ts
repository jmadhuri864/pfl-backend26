import { id, inject, injectable } from 'inversify';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcrypt';
import { merge } from 'lodash';

dotenv.config();
import config from 'config';

import { Role, User } from '../entities/user.entity';
import { signJwt } from '../utils/jwt';

import { DataSource, In } from 'typeorm';

import { Address } from '../entities/address.entity';

import AppError from '../utils/appError';

import { UserRepository } from '../repositories/user.repository';
import { RoleRepository } from '../repositories/role.repository';
import { TYPES } from '../types';
import { AddressService } from './address.service';
import { AddressRepository } from '../repositories/address.repository';

import { AuditLogService } from './auditLog.service';
import { buildQuery, PaginationOptions } from '../utils/pagination';
import { BranchessRepository } from '../repositories/branches.repository';
import { formatDateTime } from '../utils/dateUtils';
import { CompanyRepository } from '../repositories/company.repository';
import { Department } from '../utils/status.enum';
import { parseExcelDate } from '../utils/excelParser';
import { Company } from '../entities/company.entity';
import { Branches } from '../entities/branches.entity';
import { DocumentDefinition, DocumentTypeEnum } from '../entities/documentdef.entity';
import { DocumentPermission } from '../entities/permission.entity';

interface Tokens {
  access_token: string;
  refresh_token: string;
}

@injectable()
export class UserService {
  private roleRepository: RoleRepository;

  private addressRepository: AddressRepository;

  constructor(
    @inject(TYPES.DataSource) private dataSource: DataSource,
    @inject(TYPES.UserRepository) private userRepository: UserRepository,
    @inject(TYPES.AuditLogService)
    private readonly auditLogService: AuditLogService,
    @inject(TYPES.BranchessRepository)
    private readonly branchRepository: BranchessRepository,
    @inject(TYPES.AddressService) private addressService: AddressService,

    @inject(TYPES.CompanyRepository)
    private readonly companyRepository: CompanyRepository,
  ) {
    this.addressRepository = this.dataSource.getRepository(
      Address,
    ) as AddressRepository;
  }

  private generateRandomPassword(length: number = 10): string {
    const charset =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&';
    let password = '';

    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, charset.length);
      password += charset[randomIndex];
    }

    return password;
  }

  async createUser(input: any): Promise<any> {
    let employeeId = await this.generateEmployeeId();

    input.tempPlainPassword = this.generateRandomPassword();

    let accessLocationEntities: any[] = [];

    if (input.accessLocation && input.accessLocation.length > 0) {
      accessLocationEntities = await this.branchRepository.findBy({
        id: In(input.accessLocation),
      });
    }
    
    let companyEntities: any[] = [];
    if (input.companyName && input.companyName.length > 0) {
      companyEntities = await this.companyRepository.findBy({
        id: In(input.companyName),
      });
    }
// Handle roles
let roles: Role[] = [Role.EMPLOYEE]; // always assign default EMPLOYEE role

if (input.roles && input.roles.length > 0) {
  const validRoles = input.roles.filter((r: string) =>
    Object.values(Role).includes(r as Role)
  ) as Role[];

  // merge with default role, remove duplicates
  roles = Array.from(new Set([...roles, ...validRoles]));
}

// Handle departments
let departments: Department[] = [];
if (input.departments && input.departments.length > 0) {
  departments = input.departments.filter((d: string) =>
    Object.values(Department).includes(d as Department)
  ) as Department[];
}

    const user = this.userRepository.create({
      ...input,
      employeeId,
      accessLocation: accessLocationEntities,
      companyName: companyEntities,
      roles: roles,
      departments: departments,
    });

    return await this.userRepository.save(user);
  }
  async updateStatus(id: string, status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED') {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new Error('User not found');
    }

    user.status = status;
    return await this.userRepository.save(user);
  }
  async getAllUsers(queryOptions: PaginationOptions): Promise<any> {
    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.permanentAddress', 'permanentAddress')
      .leftJoinAndSelect('user.residentialAddress', 'residentialAddress')
      .leftJoinAndSelect('user.joiningLocation', 'joiningLocation')
      .leftJoinAndSelect('user.joiningOffice', 'joiningOffice')
      .leftJoinAndSelect('user.currentWorkLocation', 'currentWorkLocation')
      .leftJoinAndSelect('user.currentOfficeLocation', 'currentOfficeLocation')

      .leftJoinAndSelect('user.companyName', 'companyName')

      //.leftJoinAndSelect('user.currentLevel', 'currentLevel')
      .orderBy('user.createdAt', 'DESC');

    const { meta, data } = await buildQuery(queryBuilder, queryOptions, 'user');

    const mapAddress = (address: any): any =>
      address
        ? {
            id: address.id,
            address1: address.address1,
            address2: address.address2,
            location: address.location,
            city: address.city,
            state: address.state,
            pincode: address.pincode,
          }
        : null;

    const users = data.map((user) => ({
      id: user.id,
      firstName: user.firstName,
      middleName: user.middleName,
      lastName: user.lastName,
      username: user.username,
      primaryMobNo: user.primaryMobNo,
      secondaryMobNo: user.secondaryMobNo,
      primaryEmail: user.primaryEmail,
      secondaryEmail: user.secondaryEmail,
      joiningDate: user.joiningDate,
      designation: user.designation,
      cugNo: user.cugNo,
      otherWorkLocationInput: user.otherWorkLocationInput,
      workEmail: user.workEmail,
      employeeId: user.employeeId,
      status: user.status,
      password: user.tempPlainPassword,

      permanentAddress: mapAddress(user.permanentAddress),
      residentialAddress: mapAddress(user.residentialAddress),
      //currentLevel:user.currentLevel?.name,
      joiningLocation: user.joiningLocation
        ? user.joiningLocation.name
        : user.joiningOffice
        ? user.joiningOffice.name
        : null,

      currentWorkLocation: user.currentWorkLocation
        ? user.currentWorkLocation.name
        : user.currentOfficeLocation
        ? user.currentOfficeLocation.name
        : null,
    }));

    return {
      data: users,
      meta,
    };
  }

  async findUserById(userId: string): Promise<any> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: [
        'permanentAddress',
        'companyName',
        'residentialAddress',

        'permissions',

        'permissions.documentDefinition',
        'joiningLocation',
        'joiningOffice',
        'currentOfficeLocation',
        'currentWorkLocation',
        'accessLocation',
      ],
    });
    if (!user) {
      throw new AppError(404, `User with ID ${userId} not found`);
    }
    return this.mapToUserDTO(user);
  }

  async findUserByIdForUpdate(userId: string): Promise<any> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: [
        'permanentAddress',
        'companyName',
        'residentialAddress',

        'permissions',

        'permissions.documentDefinition',
        'joiningLocation',
        'joiningOffice',
        'currentOfficeLocation',
        'currentWorkLocation',
        'accessLocation',
      ],
    });
    if (!user) {
      throw new AppError(404, `User with ID ${userId} not found`);
    }
    return this.mapToUser(user);
  }

  private mapToUser(user: User): any {
    const mapAddress = (address: any): any =>
      address
        ? {
            id: address.id,
            address1: address.address1,
            address2: address.address2,
            location: address.location,
            city: address.city,
            state: address.state,
            pincode: address.pincode,
          }
        : null;

    const mapBasicUser = (u: User): any => u.id;
    const rawDate = user.createdAt;
    const { createdDate, createdTime } = formatDateTime(rawDate);

    return {
      id: user.id,
      createdDate,
      createdTime,
      firstName: user.firstName,
      middleName: user.middleName,
      lastName: user.lastName,
      username: user.username,
      primaryMobNo: user.primaryMobNo,
      secondaryMobNo: user.secondaryMobNo,
      primaryEmail: user.primaryEmail,
      secondaryEmail: user.secondaryEmail,
      joiningDate: user.joiningDate,
      designation: user.designation,
      cugNo: user.cugNo,
      otherWorkLocationInput: user.otherWorkLocationInput,
      workEmail: user.workEmail,
isAddressSame: user.isAddressSame,
      employeeId: user.employeeId,
      status: user.status,

      joiningLocation: user.joiningLocation?.id
        ? user.joiningLocation.id
        : user.joiningOffice?.id
        ? user.joiningOffice.id
        : null,

      currentWorkLocation: user.currentWorkLocation?.id
        ? user.currentWorkLocation.id
        : user.currentOfficeLocation?.id
        ? user.currentOfficeLocation.id
        : null,

      accessLocation: user.accessLocation.map((location) => location.id),

      companyName: user.companyName?.map((company) => company.id) || [],

      roles: user.roles || [],

      department: Array.isArray(user.department) ? user.department : [],
      permanentAddress: mapAddress(user.permanentAddress),
      residentialAddress: mapAddress(user.residentialAddress),

      //permissions: user.permissions.map((perm) => perm.id),
      permissions: user.permissions.map((perm) => ({
        id: perm.id,
        documentDefinition: perm.documentDefinition?.id,
        canCreate: perm.canCreate,
        canView: perm.canView,
        canEdit: perm.canEdit,
        canDelete: perm.canDelete,
        canDownload: perm.canDownload,
      })),
    };
  }
  async findUserByIdForView(userId: string): Promise<any> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: [
        'permanentAddress',
        'companyName',
        'residentialAddress',

        'permissions',

        'permissions.documentDefinition',
        'joiningLocation',
        'joiningOffice',
        'currentOfficeLocation',
        'currentWorkLocation',
        'accessLocation',
      ],
    });
    if (!user) {
      throw new AppError(404, `User with ID ${userId} not found`);
    }
    return this.mapToUserDTO(user);
  }

  private mapToUserDTO(user: User): any {
    const mapAddress = (address: Address): any => ({
      id: address?.id,
      address1: address?.address1,
      address2: address?.address2,
      location: address?.location,
      city: address?.city,
      state: address?.state,
      pincode: address?.pincode,
    });

    const mapBasicUser = (u: User): any => ({
      id: u.id,
      firstName: u.firstName,
      middleName: u.middleName,
      lastName: u.lastName,
      employeeId: u.employeeId,
      status: u.status,
    });

    return {
      id: user.id,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      firstName: user.firstName,
      middleName: user.middleName,
      lastName: user.lastName,
      username: user.username,
      primaryMobNo: user.primaryMobNo,
      secondaryMobNo: user.secondaryMobNo,
      primaryEmail: user.primaryEmail,
      secondaryEmail: user.secondaryEmail,
      joiningDate: user.joiningDate,
      designation: user.designation,
      cugNo: user.cugNo,
      otherWorkLocationInput: user.otherWorkLocationInput,
      workEmail: user.workEmail,
isAddressSame:user.isAddressSame,
      employeeId: user.employeeId,
      status: user.status,

      joiningLocation: user.joiningLocation?.name
        ? user.joiningLocation.name
        : user.joiningOffice?.name
        ? user.joiningOffice.name
        : null,

      currentWorkLocation: user.currentWorkLocation?.name
        ? user.currentWorkLocation.name
        : user.currentOfficeLocation?.name
        ? user.currentOfficeLocation.name
        : null,

      accessLocation: user.accessLocation.map((location) => location.name),
      companyName: user.companyName?.map((company) => company.name),
      roles: user.roles,
      department: user.department,
      //currentLevel: user.currentLevel ? mapBasicUser(user.currentLevel) : null,

      permanentAddress: mapAddress(user.permanentAddress),
      residentialAddress: mapAddress(user.residentialAddress),

      permissions: user.permissions.map((perm) => ({
        id: perm.id,
        canCreate: perm.canCreate,
        canView: perm.canView,
        canEdit: perm.canEdit,
        canDelete: perm.canDelete,
        canDownload: perm.canDownload,
        documentDefinition: perm.documentDefinition?.id,
        // documentDefinition: {
        //   id: perm.documentDefinition?.id,
        //   uniqueKey: perm.documentDefinition?.uniqueKey,
        //   name: perm.documentDefinition?.name,
        //   documentType: perm.documentDefinition?.documentType,
        // },
      })),
    };
  }

  async findUserByEmail(email: string): Promise<any> {
    return this.userRepository.findOne({
      where: { workEmail: email },
    });
  }

  async deleteUser(id: string): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { id },
    });

    if (!user) {
      return false;
    }

    const now = new Date();
    const sixMonthsFromNow = new Date(now);
    sixMonthsFromNow.setMonth(now.getMonth() + 6);
    sixMonthsFromNow.setHours(0, 0, 0, 0);

    console.log(
      `User with ID ${id} marked for deletion in 6 months at ${sixMonthsFromNow}`,
    );

    user.deletionScheduledAt = sixMonthsFromNow;

    await this.userRepository.save(user);

    console.log(`User with ID ${id} marked for deletion in 6 months.`);
    return true;
  }

  // async updateUser(id: string, userData: any, updatedBy: string): Promise<any> {
  //   const user = await this.userRepository.findOne({
  //     where: { id: id },
  //     relations: [
  //       'permanentAddress',
  //       'companyName',
  //       'residentialAddress',
  //       //'reportingManagers',
  //       //'currentLevel',
  //       'permissions',
  //       // 'reportingManagers.level',
  //       // 'reportingManagers.reportingTo',
  //       'permissions.documentDefinition',
  //       'joiningLocation',
  //       'joiningOffice',
  //       'currentOfficeLocation',
  //       'currentWorkLocation',
  //       'accessLocation',
  //     ],
  //   });
  //   if (!user) {
  //     throw new AppError(404, 'User not found');
  //   }

  //   // Step 1: Nullify OneToOne relations if they are being updated
  //   const needsNullUpdate =
  //     userData.joiningLocation !== undefined ||
  //     userData.joiningOffice !== undefined ||
  //     userData.currentWorkLocation !== undefined ||
  //     userData.currentOfficeLocation !== undefined;

  //   if (needsNullUpdate) {
  //     user.joiningLocation = null;
  //     user.joiningOffice = null;
  //     user.currentWorkLocation = null;
  //     user.currentOfficeLocation = null;
  //     await this.userRepository.save(user);
  //   }

  //   // Step 2: Reassign updated values
  //   if (userData.joiningLocation !== undefined) {
  //     user.joiningLocation = userData.joiningLocation;
  //   }

  //   if (userData.joiningOffice !== undefined) {
  //     user.joiningOffice = userData.joiningOffice;
  //   }

  //   if (userData.currentWorkLocation !== undefined) {
  //     user.currentWorkLocation = userData.currentWorkLocation;
  //   }

  //   if (userData.currentOfficeLocation !== undefined) {
  //     user.currentOfficeLocation = userData.currentOfficeLocation;
  //   }

  //   const originalUser = { ...user };

  //   Object.assign(user, userData);

  //   const updatedUser = await this.userRepository.save(user);

  //   await this.auditLogService.logChange(
  //     'User',
  //     id,
  //     originalUser,
  //     updatedUser,
  //     updatedBy,
  //   );

  //   return updatedUser;
  // }
  async updateUser(id: string, userData: any, updatedBy: string): Promise<any> {
  const user = await this.userRepository.findOne({
    where: { id },
    relations: [
      "permanentAddress",
      "companyName",
      "residentialAddress",
      "permissions",
      "permissions.documentDefinition",
      "joiningLocation",
      "joiningOffice",
      "currentOfficeLocation",
      "currentWorkLocation",
      "accessLocation",
    ],
  });

  if (!user) {
    throw new AppError(404, "User not found");
  }

  // Nullify old OneToOne relations before replacing
  user.joiningLocation = null;
  user.joiningOffice = null;
  user.currentWorkLocation = null;
  user.currentOfficeLocation = null;

  // Replace with new data (PUT = full update)
  Object.assign(user, userData);

  const originalUser = { ...user };

  const updatedUser = await this.userRepository.save(user);

  await this.auditLogService.logChange(
    "User",
    id,
    originalUser,
    updatedUser,
    updatedBy
  );

  return updatedUser;
}

  // async filteruser(queryOptions:PaginationOptions): Promise<any> {
  //   const user = await this.userRepository.find({
  //     //where: { status: 'ACTIVE' },
  //     select: {
  //       id: true,
  //       firstName: true,
  //       middleName: true,
  //       lastName: true,
  //       employeeId: true,
  //     },
  //   });
  //   const formattedUsers = user.map((user) => ({
  //     id: user.id,

  //     fullName: `${user.firstName} ${user.middleName || ''} ${user.lastName}`,

  //     employeeId: user.employeeId,
  //   }));
  //   return formattedUsers;
  // }

  async filterUser(options: PaginationOptions): Promise<any> {
  const queryBuilder = this.userRepository
    .createQueryBuilder('user')
    .select([
      'user.id',
      'user.firstName',
      'user.middleName',
      'user.lastName',
      'user.employeeId',
    ])
    //.where('user.status = :status', { status: 'ACTIVE' }) // optional filter
    .orderBy('user.firstName', 'ASC');

  const result = await buildQuery(queryBuilder, options, 'user');

  // Format the data after fetching
  const formattedUsers = result.data.map((user) => ({
    id: user.id,
    fullName: `${user.firstName} ${user.middleName || ''} ${user.lastName}`.trim(),
    employeeId: user.employeeId,
  }));

  return {
    ...result,
    data: formattedUsers,
  };
}


  async findUserByIdentifier(uid: string): Promise<User | null> {
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(uid);
    const isPhoneNumber = /^[+\d][\d\s]+$/.test(uid);
    const isUsername = !isEmail && !isPhoneNumber;

    let user: User | null = null;

    if (isUsername) {
      user = await this.userRepository.findOne({
        where: { username: uid },
        relations: [
          'permissions',
          'permissions.documentDefinition',
          'currentWorkLocation',
          //'currentLevel',
        ],
      });
    } else if (isEmail) {
      user = await this.userRepository.findOne({
        where: { workEmail: uid },
        relations: [
          'permissions',
          'permissions.documentDefinition',
          'currentWorkLocation',
          //'currentLevel',
        ],
      });
    } else if (isPhoneNumber) {
      user = await this.userRepository.findOne({
        where: { primaryMobNo: uid },
        relations: [
          'permissions',
          'permissions.documentDefinition',
          'currentWorkLocation',
          //'currentLevel',
        ],
      });
    }

    return user;
  }

  async signTokens(user: User): Promise<Tokens> {
    const access_token = signJwt({ sub: user.id }, 'accessTokenPrivateKey', {
      expiresIn: `${config.get<number>('accessTokenExpiresIn')}m`,
    });

    const refresh_token = signJwt({ sub: user.id }, 'refreshTokenPrivateKey', {
      expiresIn: `${config.get<number>('refreshTokenExpiresIn')}m`,
    });

    return { access_token, refresh_token };
  }

  async getTotalNumberOfUsers(): Promise<number> {
    return this.userRepository.count();
  }

  async generateEmployeeId(): Promise<string> {
    try {
      const companyCode = '00';

      const count = await this.getTotalNumberOfUsers();

      const serialNumber = count + 1;
      const formattedSerialNumber = serialNumber.toString().padStart(4, '0');

      return `PF${companyCode}${formattedSerialNumber}`;
    } catch (error) {
      console.error('Error generating employee ID:', error);
      throw error;
    }
  }
  //TODO:New By Vaishali

  resetPasswordLink = async (
    email: string,
    newPassword: string,
    confirmPassword: string,
  ) => {
    try {
      if (newPassword !== confirmPassword) {
        return { status: 400, message: 'Passwords do not match' };
      }
      const user = await this.userRepository.findOneBy({ workEmail: email });
      if (user) {
        console.log('Old Password', user.password);
        user.password = await bcrypt.hash(newPassword, 10);
        user.tempPlainPassword = '';
        const updatedUser = await this.userRepository.save(user);
        console.log('New Password', user.password);
        return { status: 200, message: 'Password Reset Successfully' };
      }
      return { status: 404, message: 'User Not Found' };
    } catch (error) {
      return { status: 500, message: 'Internal Server Error', error };
    }
  };

  updateEmployeeIdRoleCode(employeeId: string, newRoleCode: string): string {
    const companyCode = employeeId.slice(2, 4);
    const serialNumber = employeeId.slice(-4);

    const oldRoleCode = employeeId.charAt(4);

    if (oldRoleCode === newRoleCode) {
      return employeeId;
    }

    return `PF${companyCode}${newRoleCode}${serialNumber}`;
  }

  async createUsersWithRelations(usersData: any[]) {
    const userRepo = this.dataSource.getRepository(User);
    const companyRepo = this.dataSource.getRepository(Company);
    const addressRepo = this.dataSource.getRepository(Address);
    const branchRepo = this.dataSource.getRepository(Branches);
    const documentDefRepo = this.dataSource.getRepository(DocumentDefinition);
    const permissionRepo = this.dataSource.getRepository(DocumentPermission);
    let employeeId = await this.generateEmployeeId();
    const results: any[] = [];
    for (const row of usersData) {
      await this.dataSource.transaction(async transactionalEntityManager => {
        // Process Company
        let company = null;
        if (row.companyName && row.companyName.name) {
          company = await companyRepo.findOne({ where: { name: row.companyName.name } });
          if (!company) {
            company = companyRepo.create(row.companyName);
            company = await transactionalEntityManager.save(company);
          }
        }

        // Process Residential Address
        let residentialAddress = null;
        if (row.residentialAddress && row.residentialAddress.address1) {
          residentialAddress = addressRepo.create(row.residentialAddress);
          residentialAddress = await transactionalEntityManager.save(residentialAddress);
        }

        // Process Permanent Address
        let permanentAddress = null;
        if (row.permanentAddress && row.permanentAddress.address1) {
          permanentAddress = addressRepo.create(row.permanentAddress);
          permanentAddress = await transactionalEntityManager.save(permanentAddress);
        }

        // Process Joining Location
        let joiningLocation = null;
        if (row.joiningLocation && row.joiningLocation.name) {
          joiningLocation = await branchRepo.findOne({ where: { name: row.joiningLocation.name } });
          if (!joiningLocation) {
            joiningLocation = branchRepo.create({ name: row.joiningLocation.name });
            joiningLocation = await transactionalEntityManager.save(joiningLocation);
          }
        }

        // Process Current Work Location
        let currentWorkLocation = null;
        if (row.currentWorkLocation && row.currentWorkLocation.name) {
          currentWorkLocation = await branchRepo.findOne({ where: { name: row.currentWorkLocation.name } });
          if (!currentWorkLocation) {
            currentWorkLocation = branchRepo.create({ name: row.currentWorkLocation.name });
            currentWorkLocation = await transactionalEntityManager.save(currentWorkLocation);
          }
        }

        // Process Access Location (assuming comma-separated values)
        let accessLocation = [];
        if (row.accessLocation) {
          const names = row.accessLocation.split(',').map((n: string) => n.trim());
          for (const name of names) {
            let location = await branchRepo.findOne({ where: { name } });
            if (!location) {
              location = branchRepo.create({ name });
              location = await transactionalEntityManager.save(location);
            }
            accessLocation.push(location);
          }
        }

        const joiningDate = parseExcelDate(row.joiningDate);
        

        // Create User
        const user = userRepo.create({
          firstName: row.firstName,
          lastName: row.lastName,
          username: row.username,
          primaryMobNo: row.primaryMobNo,
          primaryEmail: row.primaryEmail,
          joiningDate: joiningDate,//row.joiningDate /*? new Date(row.joiningDate) : null*/,
          workEmail: row.workEmail,
          department: row.department,
          companyName: company,
          residentialAddress,
          permanentAddress,
          joiningLocation,
          currentWorkLocation,
          accessLocation,
          employeeId: employeeId,
          tempPlainPassword: this.generateRandomPassword(),
        });

        const savedUser = await transactionalEntityManager.save(user);

        // Process Document Permissions
        if (row.permissions && row.permissions.documentDefinition) {
          let docDef = await documentDefRepo.findOne({ where: { name: row.permissions.documentDefinition.name } });
          if (!docDef) {
            docDef = documentDefRepo.create({
              name: row.permissions.documentDefinition.name,
              uniqueKey: row.permissions.documentDefinition.name.toLowerCase().replace(/\s/g, '_'),
              documentType: row.permissions.documentDefinition.documentType as DocumentTypeEnum
            });
            docDef = await transactionalEntityManager.save(docDef);
          }

          const permission = permissionRepo.create({
            employee: savedUser,
            documentDefinition: docDef,
            canCreate: !!row.permissions.canCreate,
            canView: !!row.permissions.canView,
            canEdit: !!row.permissions.canEdit,
            canDelete: !!row.permissions.canDelete,
            canDownload: !!row.permissions.canDownload
          });

          await transactionalEntityManager.save(permission);
        }

        results.push(savedUser);
      });
    }

    return results;
  }
}
