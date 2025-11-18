// UserRepository.ts
import { Repository } from "typeorm";
import { TPVoucher } from "../entities/transportPaymentvoucher.entity";



export class TPVoucherRepository extends Repository<TPVoucher> {}
