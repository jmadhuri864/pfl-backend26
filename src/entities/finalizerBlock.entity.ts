import { Entity, JoinTable, ManyToMany } from "typeorm";
import Model from "./model.entity";
import { User } from "./user.entity";

@Entity('finalizer_blocks')
export class FinalizerBlock extends Model {
 

  @ManyToMany(() => User)
  @JoinTable({
    name: 'finalizer_block_first_finalizers',
    joinColumn: { name: 'finalizer_block_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'user_id', referencedColumnName: 'id' }
  })
  firstFinalizers: User[];

  @ManyToMany(() => User)
  @JoinTable({
    name: 'finalizer_block_second_finalizers',
    joinColumn: { name: 'finalizer_block_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'user_id', referencedColumnName: 'id' }
  })
  secondFinalizers: User[];
}
