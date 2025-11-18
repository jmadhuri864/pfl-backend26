import { Repository } from "typeorm";

import { ProductClassification } from "../entities/product_classification.entity";

export class ProductClassificationRepository extends Repository<ProductClassification> {}
