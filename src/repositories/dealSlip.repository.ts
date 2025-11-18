// UserRepository.ts
import { Repository } from "typeorm";

import { DealSlip } from "../entities/dealSlip.entity";




export class DealSlipRepository extends Repository<DealSlip> {}