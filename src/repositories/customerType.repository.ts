// UserRepository.ts
import { Repository } from "typeorm";

import { CustomerType } from "../entities/customerType.entity";

export class CustomerTypeRepository extends Repository<CustomerType> {}
