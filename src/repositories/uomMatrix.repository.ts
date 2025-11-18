// UserRepository.ts
import { Repository } from "typeorm";

import { UOMConversionMatrix } from "../entities/uom_matrix.entity";

export class UOMConversionMatrixRepository extends Repository<UOMConversionMatrix> {}
