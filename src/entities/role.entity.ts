import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { User } from './user.entity';
import Model from './model.entity';



@Entity("role")
export class Role  extends Model{
   

    @Column({ unique: true })
    name: string;
    @Column({ unique: true,nullable:true })
    roleCode: string; 
   

    // @OneToMany(() => User, (user) => user.role,{ onDelete: "SET NULL" })
    // users: User[];
    
     

}
