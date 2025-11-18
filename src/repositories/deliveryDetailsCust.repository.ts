// UserRepository.ts
import { Repository } from "typeorm";
import { DeliveryDetails } from "../entities/deliveryDetailsCust.entity";




export class DeliveryDetailsCustRepository extends Repository<DeliveryDetails> {}