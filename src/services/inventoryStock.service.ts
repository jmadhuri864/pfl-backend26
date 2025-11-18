import { inject, injectable } from 'inversify';
import { TYPES } from '../types';
import { InventoryStockRepository } from '../repositories/inventoryStock.repository';
import { buildQuery, PaginationOptions } from '../utils/pagination';
import { UserRepository } from '../repositories/user.repository';
import { InwardProductRepository } from '../repositories/inwardProduct.repository';

import { GrnProductRepository } from '../repositories/grnProduct.repository';
import { DumpProductRepository } from '../repositories/dumpProduct.repository';

@injectable()
export class InventoryStockService {
  constructor(
    @inject(TYPES.InventoryStockRepository)
    private readonly inventoryStockRepository: InventoryStockRepository,
     @inject(TYPES.UserRepository) private userRepository: UserRepository,
     @inject(TYPES.InwardProductRepository)
         private readonly inwardProductRepository: InwardProductRepository,
         @inject(TYPES.GrnProductRepository)
             private readonly grnProductRepository: GrnProductRepository,
              @inject(TYPES.DumpProductRepository) private readonly dumpProductRepository: DumpProductRepository,
  ) {}

  async getAllInventoryStocks(
    queryOptions: PaginationOptions,
  ): Promise<{ data: any; meta: any }> {
    const queryBuilder = this.inventoryStockRepository
      .createQueryBuilder('inventory')
      .leftJoinAndSelect('inventory.location', 'location')
      .leftJoinAndSelect('inventory.product', 'product')
      .leftJoinAndSelect('inventory.variant', 'varients')
      .leftJoinAndSelect('inventory.companyName', 'companyName')
      .orderBy(
        'inventory.createdAt',
        queryOptions.sort?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC',
      );

    const result = await buildQuery(queryBuilder, queryOptions, 'inventory');
    const data = result.data.map((stock: any) => ({
      ...this.formatInventoryStock(stock),
    }));

    const { meta } = result;
    return { data, meta };
  }

  async getInventoryStockById(id: string): Promise<any> {
    const stock = await this.inventoryStockRepository.findOne({
      where: { id },
      relations: ['location', 'product', 'variant', 'companyName'],
    });
    if (!stock) {
      throw new Error('Inventory Stock not found');
    }
    return this.formatInventoryStock(stock);
  }

  async searchStock(
    id?: string,
    varientId?: string,
    productId?: string,
    locationId?: string,
    companyId?: string,
  ): Promise<any> {
    const queryBuilder = this.inventoryStockRepository
      .createQueryBuilder('inventory')
      .leftJoinAndSelect('inventory.location', 'location')
      .leftJoinAndSelect('inventory.product', 'product')
      .leftJoinAndSelect('inventory.variant', 'varients')
      .leftJoinAndSelect('inventory.companyName', 'companyName')
      .where('inventory.id = :id', { id });

    if (locationId) {
      queryBuilder.andWhere('location.id = :locationId', { locationId });
    }

    if (productId) {
      queryBuilder.andWhere('product.id = :productId', { productId });
    }
    if (companyId) {
      queryBuilder.andWhere('companyName.id = :companyId', { companyId });
    }

    if (varientId) {
      queryBuilder.andWhere('varients.id = :varientId', { varientId });
    }

    const stock = await queryBuilder.getOne();

    if (!stock) {
      throw new Error('Stock not found with given filters');
    }

    return this.formatInventoryStock(stock);
  }

  async getGroupedInventoryStock() {
    const data = await this.inventoryStockRepository
      .createQueryBuilder('stock')
      .leftJoin('stock.companyName', 'company')
      .leftJoin('stock.location', 'location')
      .leftJoin('stock.product', 'product')
      .leftJoin('stock.varients', 'varient')
      .select([
        'company.id AS id',
        'company.name AS companyName',
        'location.id AS id',
        'location.name AS name',
      ])
      .addSelect('SUM(stock.onHandQty)', 'onHandQty')
      .addSelect('SUM(stock.amount)', 'amount')
      .groupBy('company.id')
      .addGroupBy('location.id')
      .getRawMany();

    return data;
  }
  async filterStock(data: any): Promise<any> {
    console.log('id', data.id);
    console.log('varientId', data.varientId);
    console.log('count', data.count);
    console.log('size', data.size);
    console.log('origin', data.origin);

    console.log('variety', data.variety);
    console.log('product', data.product);
    console.log('location', data.location);
    console.log('companyName', data.companyName);

    const queryBuilder = this.inventoryStockRepository
      .createQueryBuilder('inventory')
      .leftJoinAndSelect('inventory.location', 'location')
      .leftJoinAndSelect('inventory.product', 'product')
      .leftJoinAndSelect('inventory.varients', 'varients')
      .leftJoinAndSelect('inventory.companyName', 'companyName')
      //.where('1=1');

    if (data.id) {
      queryBuilder.andWhere('inventory.id = :id', { id: data.id });
    }

    if (data.location) {
      queryBuilder.andWhere('location.id = :location', {
        location: data.location,
      });
    }

    if (data.product) {
      queryBuilder.andWhere('product.id = :product', { product: data.product });
    }

    if (data.companyName) {
      queryBuilder.andWhere('companyName.id = :company', {
        company: data.companyName,
      });
    }

    if (data.varientId) {
      queryBuilder.andWhere('varients.id = :varientId', {
        varientId: data.varientId,
      });
    }

    if (data.origin) {
      queryBuilder.andWhere('LOWER(varients.origin) LIKE LOWER(:origin)', {
        origin: `%${data.origin}%`,
      });
    }

    if (data.size) {
      queryBuilder.andWhere('LOWER(varients.size) LIKE LOWER(:size)', {
        size: `%${data.size}%`,
      });
    }
    if (data.count) {
      queryBuilder.andWhere('LOWER(varients.count) LIKE LOWER(:count)', {
        count: `%${data.count}%`,
      });
    }

    if (data.variety) {
      queryBuilder.andWhere('LOWER(varients.variety) LIKE LOWER(:variety)', {
        variety: `%${data.variety}%`,
      });
    }

    const stock = await queryBuilder.getMany();

    if (!stock || stock.length === 0) {
      throw new Error('Stock not found with given filters');


    }


let   totalqty = 0;
    let totalamount = 0;

stock.forEach((item) => {
  const { onHandQty, amount } = item;
  if (onHandQty) {
    item.onHandQty = typeof onHandQty === 'string' ? parseFloat(onHandQty) : onHandQty;
  }
  if (amount) {
    item.amount = typeof amount === 'string' ? parseFloat(amount) : amount;
  }
  totalqty += item.onHandQty;
  totalamount += item.amount;})



    console.log('totalqty', totalqty);
    console.log('totalamount', totalamount);
    const formattedStock = stock.map((s) => this.formatInventoryStock(s));

    return {
      stock: formattedStock,
      totalqty,
      totalamount,
    };
  }

  async getProductGroupedInventoryStock(
    locationName?: string,
    companyName?: string,
  ): Promise<any> {
    const query = this.inventoryStockRepository
      .createQueryBuilder('stock')
      .leftJoin('stock.companyName', 'company')
      .leftJoin('stock.location', 'location')
      .leftJoin('stock.product', 'product')
      .leftJoin('stock.varients', 'varient')
      .select([
        'company.name AS companyName',
        'location.name AS locationName',
        'product.name AS productName',
      ])
      .addSelect('SUM(stock.onHandQty)', 'onHandQty')
      .addSelect('SUM(stock.amount)', 'amount')
      .groupBy('company.name')
      .addGroupBy('location.name')
      .addGroupBy('product.name');

    if (locationName) {
      query.andWhere('location.name ILIKE :locationName', {
        locationName: `%${locationName}%`,
      });
    }

    if (companyName) {
      query.andWhere('company.name ILIKE :companyName', {
        companyName: `%${companyName}%`,
      });
    }

    const stock = await query.getRawMany();
    console.log(stock);

    if (!stock || stock.length === 0) {
      throw new Error('Stock not found with given filters');
    }

    return stock.map(this.formatProductInventoryStock);
  }


async getProductbyaccesslocation(locationName?: string, id?: string): Promise<any[]> {
  const user = await this.userRepository.findOne({
    where: { id },
    relations: ['companyName'],
  });

  const companyName = user?.companyName?.id;
  console.log('companyName:', companyName);

  const query = this.inventoryStockRepository
    .createQueryBuilder('stock')
    .leftJoin('stock.companyName', 'company')
    .leftJoin('stock.location', 'location')
    .leftJoin('stock.product', 'product')
    .leftJoin('stock.varients', 'varient')
    .select('stock.id', 'stockId')
    .addSelect('company.id', 'companyId')
    .addSelect('company.name', 'companyName')
    .addSelect('location.id', 'locationId')
    .addSelect('product.id', 'productId')
    .addSelect('product.name', 'productName')
    .addSelect('varient.origin', 'origin')
    .addSelect('varient.variety', 'variety')
    .addSelect('varient.size', 'size')
    .addSelect('varient.count', 'count')
    .addSelect('COALESCE(SUM(stock.onHandQty), 0)', 'onHandQty')
    .addSelect('COALESCE(SUM(stock.amount), 0)', 'amount');

  if (locationName) {
    query.andWhere('location.id = :locationId', { locationId: locationName });
  }

  if (companyName) {
    query.andWhere('company.id = :companyName', { companyName });
  }

  query
    .groupBy('stock.id')
    .addGroupBy('company.id')
    .addGroupBy('company.name')
    .addGroupBy('location.id')
    .addGroupBy('product.id')
    .addGroupBy('product.name')
    .addGroupBy('varient.origin')
    .addGroupBy('varient.variety')
    .addGroupBy('varient.size')
    .addGroupBy('varient.count');

  const stock = await query.getRawMany();
  console.log('stock:', stock);

  return stock.map((doc: any) => ({
    id : doc.stockId,
    // companyId: doc.companyId,
    // companyName: doc.companyName,
    productId: doc.productId,
    productName: doc.productName,
    count: doc.count,
    origin: doc.origin,
    variety: doc.variety,
    size: doc.size,
    onHandQty: Number(doc.onHandQty),
    amount: Number(doc.amount),
  }));
}


  async getVarientGroupedInventoryStock(
    locationName?: string,
    companyName?: string,
    productName?: string,
  ): Promise<any> {
    const query = this.inventoryStockRepository
      .createQueryBuilder('stock')
      .leftJoin('stock.companyName', 'company')
      .leftJoin('stock.location', 'location')
      .leftJoin('stock.product', 'product')
      .leftJoin('stock.varients', 'varient')
      .select([
        'company.name AS companyName',
        'location.name AS locationName',
        'product.name AS productName',
        'varient.productCode AS varientName',
      ])
      .addSelect('SUM(stock.onHandQty)', 'onHandQty')
      .addSelect('SUM(stock.amount)', 'amount')
     
      .groupBy('company.name')
      .addGroupBy('location.name')
      .addGroupBy('product.name')
      .addGroupBy('varient.productCode');

    if (locationName) {
      query.andWhere('location.name ILIKE :locationName', {
        locationName: `%${locationName}%`,
      });
    }

    if (companyName) {
      query.andWhere('company.name ILIKE :companyName', {
        companyName: `%${companyName}%`,
      });
    }
    if (productName) {
      query.andWhere('product.name ILIKE :productName', {
        productName: `%${productName}%`,
      });
    }

    const stock = await query.getRawMany();
    console.log(stock);
    if (!stock || stock.length === 0) {
      throw new Error('Stock not found with given filters');
    }

    return stock.map(this.formatVarientInventoryStock);
  }

  private formatProductInventoryStock(stock: any) {
    return {
      companyName: stock.companyname || null,
      location: stock.locationname || null,
      product: stock.productname || null,
      onHandQty: parseFloat(stock.onHandQty),
      amount: parseFloat(stock.amount),
    };
  }
  private formatVarientInventoryStock(stock: any) {
    return {
      companyName: stock.companyname || null,
      location: stock.locationname || null,
      product: stock.productname || null,
      varients: stock.varientname || null,
      onHandQty: parseFloat(stock.onHandQty),
      amount: parseFloat(stock.amount),
    };
  }

  private formatInventoryStockById(stock: any) {
    return {
      id: stock.id,
      companyName: stock.companyName
        ? {
            id: stock.companyName.id,
            name: stock.companyName.name,
          }
        : null,
      location: stock.location
        ? {
            id: stock.location.id,
            name: stock.location.name,
          }
        : null,

      product: stock.product
        ? {
            id: stock.product.id,
            name: stock.product.name,
          }
        : null,
      varients: stock.varients
        ? {
            id: stock.varients.id,
            productCode: stock.varients.productCode,
          }
        : null,
      onHandQty: stock.onHandQty,

      amount: stock.amount,
    };
  }

  private formatInventoryStock(stock: any) {
    return {
      id: stock.id,
      location: stock.location?.name || null,
      companyName: stock.companyName?.name || null,
      product: stock.product?.name || null,
      varients: stock.varients?.productCode || null,
      onHandQty: stock.onHandQty as number,

      amount: stock.amount as number,
    };
  }

    async getInventoryStockbyuserAccesslocation(id:string) {

      const user = await this.userRepository.findOne(
        {
          where:{id},
          relations : [
            'accessLocation'
          ]
        })

        const accessLocationIds = user?.accessLocation?.map(loc => loc.id) || [];


console.log(user?.accessLocation)
    const data = await this.inventoryStockRepository
  .createQueryBuilder('stock')
  .leftJoin('stock.companyName', 'company')
  .leftJoin('stock.location', 'location')
  .leftJoin('stock.product', 'product')
  .leftJoin('stock.varients', 'varient')
  .select([
    'company.id AS companyId',
    'company.name AS companyName',
    'location.id AS locationId',
    'location.name AS locationName',
  ])
  .addSelect('SUM(stock.onHandQty)', 'onHandQty')
  .addSelect('SUM(stock.amount)', 'amount')
  .where('location.id IN (:...accessLocationIds)', { accessLocationIds })
  .groupBy('company.id')
  .addGroupBy('company.name')
  .addGroupBy('location.id')
  .addGroupBy('location.name')
  .getRawMany();


    return data;
  }



  public async getStockReport(
    companyName?: string,
    locationId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<any[]> 
  {
   console.log(companyName)
   console.log(locationId)
   console.log(startDate)
   console.log(endDate)
//     const inwardQb = this.inwardProductRepository
//       .createQueryBuilder("ip")
//       .leftJoin("ip.inwardRegister", "ir")
//       .leftJoin("ip.productName", "product")
//       .where("ir.company_id = :companyId", { companyId: companyName });

//     if (locationId) {
//       inwardQb.andWhere("ir.branch_id = :branchId", { branchId: locationId });
//     }
//     if (startDate && endDate) {
//       inwardQb.andWhere("ir.date BETWEEN :start AND :end", { start: startDate, end: endDate });
//     }
// // console.log("",inwardQb)
//     const inwardData = await inwardQb
//       .select([
//         "product.id as productId",
//         "product.name as productName",
//         "product.variants as variant",
//         "SUM(ip.netWeight) as inwardQty",
//         "SUM(ip.amount) as inwardAmt",
//       ])
//       .groupBy("product.id")
//       .addGroupBy("product.name")
//     .addGroupBy("product.variants")
//       .getRawMany();

//    console.log("inwarddata is ",inwardData)
const result = await this.inwardProductRepository
  .createQueryBuilder("ip")
  .leftJoin("ip.inwardRegister", "ir")
  .leftJoin("ip.productName", "product")
  .leftJoin("ip.variant", "pv") 
  .select("product.id", "productId")
  .addSelect("product.product_name", "productName")
  .addSelect("pv.id", "variantId")
  .addSelect("pv.variantName", "variantName") // ✅ corrected
  .addSelect("SUM(ip.netWeight)", "inwardQty")
  .addSelect("SUM(ip.amount)", "inwardAmt")
  .where("ir.company_id = :companyId", { companyId: companyName })
  .andWhere("ir.branch_id = :branchId", { branchId: locationId })
  .andWhere("ir.date BETWEEN :startDate AND :endDate", { startDate, endDate })
  .groupBy("product.id")
  .addGroupBy("product.product_name")
  .addGroupBy("pv.id")
  .addGroupBy("pv.variantName") // ✅ corrected
  .getRawMany();

console.log("inwarddata is ",result)
    const purchaseQb = this.grnProductRepository
  .createQueryBuilder("gp")
  .leftJoin("gp.grn", "grn")
  .leftJoin("gp.productName", "product")
  .leftJoin("gp.variant", "pv") // ✅ join variant properly
  .where("grn.company_id = :companyId", { companyId: companyName });

if (locationId) {
  purchaseQb.andWhere("grn.purchaseLocation = :branchId", { branchId: locationId });
}
if (startDate && endDate) {
  purchaseQb.andWhere("grn.createdAt BETWEEN :start AND :end", {
    start: startDate,
    end: endDate,
  });
}

const purchaseData = await purchaseQb
  .select([
    "product.id as productId",
    "product.name as productName",
    "pv.id as variantId",              // ✅
    "pv.variantName as variantName",  // ✅
    "SUM(gp.netWeight) as purchaseQty",
    "SUM(gp.amount) as purchaseAmt",

    // ✅ RTV and NON-RTV qty splits
    `SUM(CASE WHEN gp.rtv = true THEN gp.netWeight ELSE 0 END) as rtvQty`,
    `SUM(CASE WHEN gp.rtv = true THEN gp.amount ELSE 0 END) as rtvAmt`,
    `SUM(CASE WHEN gp.rtv = false THEN gp.netWeight ELSE 0 END) as nonRtvQty`,
    `SUM(CASE WHEN gp.rtv = false THEN gp.amount ELSE 0 END) as nonRtvAmt`,
  ])
  .groupBy("product.id")
  .addGroupBy("product.name")
  .addGroupBy("pv.id")              // ✅ group by variant id
  .addGroupBy("pv.variantName")     // ✅ group by variant name
  .getRawMany();

console.log("purchaseData is ", purchaseData);

 
    const dumpQb = this.dumpProductRepository
      .createQueryBuilder("dp")
      .leftJoin("dp.dumpRegister", "dump")
      .leftJoin("dp.productName", "product")
      .leftJoin("dp.variant", "pv")
      
      .where("dump.company_id = :companyId", { companyId: companyName });

    if (locationId) {
      dumpQb.andWhere("dump.branch_id = :branchId", { branchId: locationId });
    }
    if (startDate && endDate) {
      dumpQb.andWhere("dump.date BETWEEN :start AND :end", { start: startDate, end: endDate });
    }

    const dumpData = await dumpQb
      .select([
        "product.id as productId",
        "product.name as productName",
         "pv.id as variantId",              
    "pv.variantName as variantName",
        "SUM(dp.quantity) as dumpQty",
        "SUM(dp.amount) as dumpAmt",
      ])
      .groupBy("product.id")
      .addGroupBy("product.name")
      .addGroupBy("pv.id")              // ✅ group by variant id
  .addGroupBy("pv.variantName")
      .getRawMany();

   console.log("dumpData is ",dumpData)
    // Merge
// Merge
function normalizeRow(row: any): any {
  return {
    id: row.productid,
    productName: row.productname,
    variantId: row.variantid,
    variantName: row.variantname,
    inwardQty: row.inwardqty,
    inwardAmt: row.inwardamt,
    purchaseQty: row.purchaseqty,
    rtvQty: row.rtvqty,
    rtvAmt:row.rtvAmt,
    nonRtvAmt:row.nonRtvAmt,
    nonRtvQty: row.nonrtvqty,
    purchaseAmt: row.purchaseamt,
    dumpQty: row.dumpqty,
    dumpAmt: row.dumpamt,
  };
}

// ✅ Add this function
function makeKey(row: any) {
 return `${row.productId}-${row.variantId}`;
}

const merged: Record<string, any> = {};

function mergeData(rows: any[], type: "inward" | "purchase" | "dump") {
  for (const row of rows) {
    const key = makeKey(row);
    if (!merged[key]) {
      merged[key] = {
        productId: row.productId,
        productName: row.productName,
        variant: row.variant,
        purchaseQty: 0,
        purchaseAmt: 0,
        rtvQty: 0,
        rtvAmt:0,
        nonRtvQty: 0,
        nonRtvAmt:0,
        inwardQty: 0,
        inwardAmt: 0,
        dumpQty: 0,
        dumpAmt: 0,
      };
    }
    if (type === "inward") {
      merged[key].inwardQty += Number(row.inwardQty || 0);
      merged[key].inwardAmt += Number(row.inwardAmt || 0);
    } else if (type === "purchase") {
      merged[key].purchaseQty += Number(row.purchaseQty || 0);
      merged[key].purchaseAmt += Number(row.purchaseAmt || 0);
    } else if (type === "dump") {
      merged[key].dumpQty += Number(row.dumpQty || 0);
      merged[key].dumpAmt += Number(row.dumpAmt || 0);
    }
  }
}
    mergeData(result.map(normalizeRow), "inward");
    mergeData(purchaseData.map(normalizeRow), "purchase");
    mergeData(dumpData.map(normalizeRow), "dump");

    return Object.values(merged);
  }
}
