import { Repository } from "typeorm";

import { CashVoucher } from "../entities/mCashVoucher.entity";

export class MultiCashVoucherRepository extends Repository<CashVoucher> {}