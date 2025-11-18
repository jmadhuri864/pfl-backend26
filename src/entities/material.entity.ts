import {
    Entity,
    Column,
    ManyToOne,
    JoinColumn,
  } from 'typeorm';
import Model from './model.entity';
import { PMPVoucher } from './packingMaterialVoucher.entity';
import { UOM } from './uom.entity';
 
  
  @Entity("material_use_for_packing_voucher")
  export class Materials extends Model{
    
    @Column()
    itemName: string;
  
    @Column('int')
    itemQty: number;
  
    @ManyToOne(() => UOM, { nullable: true ,onDelete: "SET NULL",cascade:true})
    @JoinColumn({ name: "uom_id" })
    itemUom: UOM;

    @Column('decimal', { precision: 10, scale: 2 })
    rate: number;
  
    @Column('decimal', { precision: 10, scale: 2 })
    amt: number;
  
    @ManyToOne(() => PMPVoucher, (pmVoucher) => pmVoucher.materials, { onDelete: "SET NULL" })
    pmVoucher: PMPVoucher;
  }
  