import { Repository } from "typeorm";


import { SalesTarget } from "../entities/salesTarget.entity";
import { SalesTargetProduct } from "../entities/salesTargetProduct.entity";

export class SalesTargetProductRepository extends Repository<SalesTargetProduct> {}
