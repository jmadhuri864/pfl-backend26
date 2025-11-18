import { Column, Entity, JoinTable, ManyToMany } from "typeorm";
import Model from "./model.entity";
import { User } from "./user.entity";

@Entity('approver_blocks')
export class ApproverBlock  extends Model{


  @Column({nullable:true})
  hierarchy: number;

  @Column({ type: 'decimal', nullable: true })
  minAmtCanApprove: number;

  @Column({ type: 'decimal', nullable: true })
  maxAmtCanApprove: number;

  @ManyToMany(() => User, { cascade: true ,nullable:true})
  @JoinTable({
    name: 'approver_block_users',
    joinColumn: { name: 'block_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'user_id', referencedColumnName: 'id' }
  })
  users: User[];
}
