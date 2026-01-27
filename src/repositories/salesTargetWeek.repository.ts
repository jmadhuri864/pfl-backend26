import { Repository } from "typeorm";


import { SalesTarget } from "../entities/salesTarget.entity";
import { SalesTargetWeek } from "../entities/salesTargetWeek.entity";

export class SalesTargetWeekRepository extends Repository<SalesTargetWeek> {}
