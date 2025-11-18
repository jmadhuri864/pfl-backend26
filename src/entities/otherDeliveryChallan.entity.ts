import { ChildEntity, Column, JoinColumn, ManyToOne } from "typeorm";

import { DeliveryChallanPurchase } from "./deliveryChallan.entity";
import { Address } from "./address.entity";

@ChildEntity("other-delivery-challan")
export class OtherDeliveryChallan extends DeliveryChallanPurchase {
    @ManyToOne(() => Address, {
      nullable: true,
      onDelete: "SET NULL",
      cascade: true,
    })
    @JoinColumn({ name: "input_tolocation_id" })
    toLocationInput: Address;
  
    @ManyToOne(() => Address, {
      nullable: true,
      onDelete: "SET NULL",
      cascade: true,
    })
    @JoinColumn({ name: "input_fromlocation_id" })
    fromLocationInput: Address;
}
