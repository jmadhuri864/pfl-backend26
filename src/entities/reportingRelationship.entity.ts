import {
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import Model from './model.entity';
import { Levels } from './levels.entity';
import { User } from './user.entity';

@Entity('employees_reportingManager')
export class ReportingManagers extends Model {
  
  @ManyToOne(() => Levels, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'levels_id' })
  level: Levels;

  @ManyToMany(() => User, { cascade: true })
  @JoinTable({
    name: 'reporting_manager_to_users',
    joinColumn: { name: 'reporting_manager_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'user_id', referencedColumnName: 'id' },
  })
  reportingTo: User[];

 @ManyToMany(() => User, { cascade: true })
  @JoinTable({
    name: 'reporting_manager_to_users',
    joinColumn: { name: 'reporting_manager_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'user_id', referencedColumnName: 'id' },
  })
  approverlevel1: User[];


  @ManyToMany(() => User, (user) => user.reportingManagers)
  users: User[];
}
