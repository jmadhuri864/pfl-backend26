import { Column, Entity, OneToMany } from "typeorm";
import Model from "./model.entity";
import { Levels } from "./levels.entity";

@Entity("departmentsForApprove")
export class Departments extends Model {
    @Column()
    name: string;  


    // @OneToMany(() => Levels, (level) => level.department)
    // levels: Levels[];
 }
