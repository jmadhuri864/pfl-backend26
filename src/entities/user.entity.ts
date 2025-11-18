import {
  Entity,
  Column,
  BeforeInsert,
  OneToMany,
  OneToOne,
  JoinColumn,
  ManyToOne,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import 'reflect-metadata';
import bcrypt from 'bcryptjs';

import { Address } from './address.entity';

import { Transfer } from './transfer.entity';
import { Branches } from './branches.entity';

import { format } from 'date-fns';
import { Company } from './company.entity';
import { DocumentPermission } from './permission.entity';

import { Exclude } from 'class-transformer';
import Model from './model.entity';
import { OfficesData } from './offices.entity';

export enum Role {
  ADMIN = 'admin',
  EMPLOYEE = 'employee',
  VERIFIER = 'verifier',
  APPROVER = 'approver',
  FINALIZER = 'finalizer',
}
@Entity('employees')
export class User extends Model {
  @Column({ nullable: true })
  firstName: string;

  @Column({ nullable: true })
  middleName: string;

  @Column({ nullable: true })
  lastName: string;

  @Column({ nullable: true })
  username: string;

  @Column({ nullable: true })
  primaryMobNo: string;
  @Column({
    type: 'simple-array',
    nullable: true,
    default: '',
  })
  department: string[];

  // Default role = employee
  @Column({
    type: 'enum',
    enum: Role,
    array: true, // allows multiple roles
    default: [Role.EMPLOYEE],
  })
  roles: Role[];

  @Column({ nullable: true })
  secondaryMobNo: string;

  @Column({ nullable: true })
  primaryEmail: string;

  @Column({ nullable: true })
  secondaryEmail: string;
  @OneToOne(() => Address, (address) => address.user, {
    cascade: true,
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn()
  residentialAddress: Address;

  @OneToOne(() => Address, (address) => address.user, {
    cascade: true,
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn()
  permanentAddress: Address;

  @ManyToMany(() => Company, { cascade: true })
  @JoinTable({
    name: 'user_companies',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'company_id', referencedColumnName: 'id' },
  })
  companyName: Company[];

  @Column({
    type: 'date',
    nullable: true,
    transformer: {
      to: (value: Date) => value,
      from: (value: string) =>
        value ? format(new Date(value), 'yyyy-MM-dd') : null,
    },
  })
  joiningDate: Date;
  @Column({ nullable: true })
  designation: string;

  @Column({ nullable: true })
  cugNo: string;

  @Column({ nullable: true })
  workEmail: string;
  @Column({ nullable: true })
  isAddressSame: boolean;
  // @ManyToOne(() => Levels, {
  //   nullable: true,
  //   onDelete: 'SET NULL',
  //   cascade: true,
  // })
  // @JoinColumn({ name: 'level_id' })
  // currentLevel: Levels;

  @OneToMany(() => DocumentPermission, (permission) => permission.employee, {
    cascade: true,
  })
  @JoinColumn({ name: 'document_permissions' })
  permissions: DocumentPermission[];

  // @Column({ nullable: true })
  // joiningLocationInput: string;

  @Column({ nullable: true })
  otherWorkLocationInput: string;

  // @OneToOne(() => Branches, {
  //   cascade: true,
  //   nullable: true,
  //   onDelete: 'SET NULL',
  // })
  // @JoinColumn({ name: 'joiningLocation_id' })
  // joiningLocation: Branches | null;
  @ManyToOne(() => Branches, {
    nullable: true,
    onDelete: 'SET NULL',
    cascade: true,
  })
  @JoinColumn({ name: 'joiningLocation_id' })
  joiningLocation: Branches | null;

  // @OneToOne(() => OfficesData, {
  //   cascade: true,
  //   nullable: true,
  //   onDelete: 'SET NULL',
  // })
  // @JoinColumn({ name: 'joiningofficedata_id' })
  // joiningOffice: OfficesData | null;
  @ManyToOne(() => OfficesData, {
    nullable: true,
    onDelete: 'SET NULL',
    cascade: true,
  })
  @JoinColumn({ name: 'joiningOfficedata_id' })
  joiningOffice: OfficesData | null;

  @ManyToOne(() => Branches, {
    nullable: true,
    onDelete: 'SET NULL',
    cascade: true,
  })
  @JoinColumn({ name: 'currentLocation_id' })
  currentWorkLocation: Branches | null;

  @ManyToOne(() => OfficesData, {
    nullable: true,
    onDelete: 'SET NULL',
    cascade: true,
  })
  @JoinColumn({ name: 'currentOffices_id' })
  currentOfficeLocation: OfficesData | null;

  // @OneToMany(() => Branches, (branch) => branch.user, {
  //   cascade: true,
  // })
  // accessLocation: Branches[];

  @ManyToMany(() => Branches)
  @JoinTable({
    name: 'access_location_id',
    joinColumn: { name: 'accesslocation_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'user_id', referencedColumnName: 'id' },
  })
  accessLocation: Branches[];

  @Column({ nullable: true })
  @Exclude()
  password: string;
  @OneToMany(() => Transfer, (transfer) => transfer.employee, {
    nullable: true,
  })
  transfers: Transfer[];
  // 👇 add these two fields
  @Column({ default: false })
  isOnline: boolean;

  @Column({ type: "timestamp", nullable: true })
  lastActivityAt: Date | null;

  @Column({ nullable: true })
  employeeId: string;
  @Column({ nullable: true })
  @Exclude()
  tempPlainPassword?: string;

  @Column({
    type: 'enum',
    enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'],
    default: 'INACTIVE',
  })
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

  @BeforeInsert()
  async hashPassword() {
    if (this.tempPlainPassword) {
      this.password = await bcrypt.hash(this.tempPlainPassword, 12);
    }
  }

  static async comparePasswords(
    candidatePassword: string,
    hashedPassword: string,
  ) {
    return await bcrypt.compare(candidatePassword, hashedPassword);
  }

  toJSON() {
    return { ...this, password: undefined, verified: undefined };
  }
}
//  @ManyToMany(() => ReportingManagers, { cascade: true, nullable: true })
//   @JoinTable({
//     name: 'user_reporting_managers',
//     joinColumn: { name: 'user_id', referencedColumnName: 'id' },
//     inverseJoinColumn: {
//       name: 'reporting_manager_id',
//       referencedColumnName: 'id',
//     },
//   })
//   reportingManagers: ReportingManagers[];

//   @ManyToMany(() => ReportingManagers, { cascade: true, nullable: true })
//   @JoinTable({
//     name: 'user_reporting_managers',
//     joinColumn: { name: 'user_id', referencedColumnName: 'id' },
//     inverseJoinColumn: {
//       name: 'reporting_manager_id',
//       referencedColumnName: 'id',
//     },
//   })
//   approvers: ReportingManagers[];
