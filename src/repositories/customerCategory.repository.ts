// UserRepository.ts
import { Repository } from "typeorm";

import { CustomerCategory } from "../entities/customerCategory.entity";

export class CustomerCategoryRepository extends Repository<CustomerCategory> {}
