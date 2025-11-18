import { Repository } from 'typeorm';
import { UserActivityLog } from '../entities/userActivityLog.entity';

export class UserActivityLogRepository extends Repository<UserActivityLog> {}
