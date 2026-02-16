import {  Repository } from "typeorm";

import { RFPA } from "../entities/rfpa.entity";
import { PaymentInfoForRFPA } from "../entities/rfpaPayementInfo.entity";

export class RfpaPaymentInfoRepository extends Repository<PaymentInfoForRFPA> {

}
