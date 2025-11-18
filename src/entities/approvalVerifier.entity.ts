// import { Entity, JoinColumn, JoinTable, ManyToMany, ManyToOne } from "typeorm";
// import { ApprovalFlow } from "./approvalFlow.entity";
// import { User } from "./user.entity";
// import Model from "./model.entity";

// @Entity('approval_verifiers')
// export class ApprovalVerifier  extends Model{
 
//   @ManyToOne(() => ApprovalFlow, (flow) => flow.verifiers, { onDelete: 'CASCADE' })
//   @JoinColumn({ name: 'approval_flow_id' })
//   approvalFlow: ApprovalFlow;

//   // @ManyToOne(() => User, { nullable: false })
//   // @JoinColumn({ name: 'verifier_id' })
//   // verifier: User;


  
//     @ManyToMany(() => User)
//     @JoinTable({
//       name: 'verifiers_id',
//       joinColumn: { name: 'verifier_id', referencedColumnName: 'id' },
//       inverseJoinColumn: { name: 'user_id', referencedColumnName: 'id' }
//     })
//     verifier: User[];
// }
