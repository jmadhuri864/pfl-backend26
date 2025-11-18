import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import Model from './model.entity';
import { User } from './user.entity';

export enum ActivityAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  VIEW = 'VIEW',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  EXPORT = 'EXPORT',
  PRINT = 'PRINT',
  DOWNLOAD = 'DOWNLOAD',
}

export enum ActivityModule {
  GRN = 'GRN',
  RFPA = 'RFPA',
  DEAL_SLIP = 'DEAL_SLIP',
  INVOICE = 'INVOICE',
  CUSTOMER = 'CUSTOMER',
  VENDOR = 'VENDOR',
  PRODUCT = 'PRODUCT',
  USER = 'USER',
  REPORT = 'REPORT',
  SETTINGS = 'SETTINGS',
  DASHBOARD = 'DASHBOARD',
  MULTI_CASH_VOUCHER = 'MULTI_CASH_VOUCHER',
  LABOUR_PAYMENT = 'LABOUR_PAYMENT',
  TRANSPORT_PAYMENT = 'TRANSPORT_PAYMENT',
  OTHER = 'OTHER',
}

@Entity('user_activity_logs')
@Index(['userId', 'createdAt'])
@Index(['action', 'createdAt'])
@Index(['module', 'createdAt'])
export class UserActivityLog extends Model {
  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  @Index()
  userId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userName: string;

  @Column({
    type: 'enum',
    enum: ActivityAction,
  })
  action: ActivityAction;

  @Column({
    type: 'enum',
    enum: ActivityModule,
  })
  module: ActivityModule;

  @Column({ type: 'varchar', length: 255, nullable: true })
  entityName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  entityId: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  changes: Record<string, { oldValue: any; newValue: any }>;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string;

  @Column({ type: 'text', nullable: true })
  userAgent: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  endpoint: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  httpMethod: string;

  @Column({ type: 'int', nullable: true })
  statusCode: number;

  @Column({ type: 'int', nullable: true })
  responseTime: number; // in milliseconds

  @Column({ type: 'boolean', default: false })
  isError: boolean;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;
}
