import { inject, injectable } from "inversify";
import { SaleOrderRepository } from "../repositories/saleOrder.repository";
import { TYPES } from "../types";
import { AuditLogService } from "./auditLog.service";
import { InvoiceRepository } from "../repositories/invoice.repository";
import { DeliveryChallanRepository } from "../repositories/deliveryChallan.repository";
import { Invoice } from "../entities/invoice.entity";
import { PdfGeneratorService } from "../utils/pdfGenerator";
import AppError from "../utils/appError";
import { PostReturnByCustomerRepository } from "../repositories/postReturnByCustomer.repository";
import { toWords } from "number-to-words";
import { formatDateTime } from "../utils/dateUtils";
import { DeliveryDetailsCustRepository } from "../repositories/deliveryDetailsCust.repository";
import { CustomerDeliveryChallanRepository } from "../repositories/customerDeliveryChallan.repository";
import { CustomerDeliveryChallan } from "../entities/customerDeliveryChallan.entity";

@injectable()
export class InvoiceService {
    constructor(
        @inject(TYPES.SaleOrderRepository)
        private readonly saleOrderRepository: SaleOrderRepository,
        @inject(TYPES.InvoiceRepository)
        private readonly invoiceRepository: InvoiceRepository,
        // @inject(TYPES.DeliveryChallanRepository)
        // private readonly deliveryChallanRepository: DeliveryChallanRepository,
        @inject(TYPES.PdfGeneratorService)
        private readonly pdfGeneratorService: PdfGeneratorService,
        @inject(TYPES.AuditLogService)
        private readonly auditLogService: AuditLogService,
          @inject(TYPES.CustomerDeliveryChallanRepository)
             private challanRepository: CustomerDeliveryChallanRepository,
        @inject(TYPES.PostReturnByCustomerRepository)
        private readonly postReturnByCustomerRepository: PostReturnByCustomerRepository,
       
      ) {}

     

    //   generateInvoiceNo(): string {
    //     // Get the current date
    //     const now = new Date();
    
    //     // Format the date as YYYYMMDD
    //     const datePart = now.getFullYear().toString() +
    //         (now.getMonth() + 1).toString().padStart(2, '0') +
    //         now.getDate().toString().padStart(2, '0');
    
    //     // Generate a random 4-digit number
    //     const randomPart = Math.floor(1000 + Math.random() * 9000);
    
    //     // Combine the date part and the random part
    //     return `INV-${datePart}-${randomPart}`;
    // }

    generateInvoiceNo(companyName: string, locationPrefix: string, lastSerialNumber: number): string {
    
      const companyInitials = companyName
          .split(' ')
          .map(word => word[0].toUpperCase())
          .join('');
  
    
      const year = new Date().getFullYear();
  
      
      const serialNumber = (lastSerialNumber + 1).toString().padStart(5, '0');
  
     
      return `${companyInitials}-${year}-${locationPrefix}-${serialNumber}`;
  }
  
 
  
    
    async createInvoice(orderId: string, invoiceData: any): Promise<any> {
        const saleOrder = await this.saleOrderRepository.findOne({ where: { id: orderId } });
        if (!saleOrder) {
          throw new Error('Sale Order not found');
        }
    
        const invoice = this.invoiceRepository.create({
          ...invoiceData,
          salesOrder: saleOrder
        });
    
        return await this.invoiceRepository.save(invoice);
      }
      async getProformaInvoice(): Promise<any> {
        const saleOrder = await this.invoiceRepository.find({
          where: { type: 'proforma' } as any, 
        });
        if (!saleOrder) {
          throw new Error('Sale Order not found');
        }
        return saleOrder;
      }

       async getFinalInvoice(): Promise<any> {
  const saleOrder = await this.invoiceRepository.find({
    where: { type: 'final' } as any,
    relations: ['deliveryChallan'],
  });

  if (!saleOrder || saleOrder.length === 0) {
    throw new Error('Sale Order not found');
  }

  const formattedData = saleOrder.map((invoice) => {
    return {
      id: invoice.id,
      deliveryChallan: invoice.deliveryChallan?.challanNo || null,
      
      invoiceDate: invoice.invoiceDate,
      invoiceNo: invoice.invoiceNo,
      pdfData: invoice.pdfData,
    };
  });

  return formattedData;
}

      // async generateInvoice(deliveryChallanId: string): Promise<any> {
      //   // Fetch DeliveryChallan details
      //   const deliveryChallan = await this.deliveryChallanRepository.findOne({
      //     where: { id: deliveryChallanId },
      //     relations: ['items'], // Include related items
      //   });
      
      //   if (!deliveryChallan) {
      //     throw new Error('Delivery Challan not found');
      //   }
      
      //   // Prepare data for invoice
      //   const invoiceData = {
      //     challanNo: deliveryChallan.challanNo,
      //     partyName: deliveryChallan.customer.organisationName,
      //     items: deliveryChallan.items,
      //     totAmt: deliveryChallan.totAmt,
      //     vehicleNo: deliveryChallan.vehicleNo,
      //     createdDate: deliveryChallan.createdDate,
      //   };
      // console.log("invoiceData",invoiceData);
      //   // Generate PDF and upload to S3
      //   let data: Invoice
      //   data.invoiceNumber= await this.generateInvoiceNo();
      //   data. invoiceDate= new Date();
      //   data. type= 'proforma'; 
      //   const pdfUrl = await this.pdfGeneratorService.generateInvoicePdf(invoiceData);
      //   data.pdfData= pdfUrl
      //   // Save Invoice to Database
      //   //const invoice = this.invoiceRepository.create({
      //     //invoiceNumber: this.generateInvoiceNo(),
      //     // invoiceDate: new Date(),
      //     // type: 'proforma',
      //     //deliveryChallan,
      //     //pdfData: pdfUrl, // Save S3 link instead of binary data
      //   //});
      //   const invoice = this.invoiceRepository.create({
      //     data
      //   });
      
      //   return await this.invoiceRepository.save(invoice);
      // }
     
      

  //     async generateInvoice(deliveryChallanId: string,invoiceType:string): Promise<any> {
        
  //       console.log("deliveryChallanId",deliveryChallanId);
  //       console.log("invoiceType",invoiceType);
  //       const deliveryChallan = await this. deliveryDetailsRepository.findOne({
  //         where: { id: deliveryChallanId },
  //         relations: [
  //             'deliveryChallanProducts',
  //             'customer',
  //             'fromLocation', 
  //             'deliveryChallanProducts.productName',
  //             'deliveryChallanProducts.uom',
  //             'customer.billingDetails.billingAddress',
  //             'customer.deliveryDetails.deliveryAddress',
  //             'customer.statutoryDetails',
  //             'companyName',
  //             'companyName.bankDetails'
  //         ],
  //     });
  //     if (!deliveryChallan) {
  //         throw new Error('Delivery Challan not found');
  //     }
  //     const deliveryChallanDate = deliveryChallan.createdAt;
  //     const { createdDate: formattedCreatedDate, createdTime: deliveryChallanCreatedTime } = formatDateTime(deliveryChallanDate);
  //    console.log("deliveryChallan",deliveryChallan);
  //       if (!deliveryChallan) {
  //           throw new Error('Delivery Challan not found');
  //       }
  //       console.log("deliveryChallan",deliveryChallan);
       
    
  //     const count = await this.invoiceRepository.count({
  //       where: { location: { id: deliveryChallan } }
  //     });
      
  //     console.log("Count for fromLocation ID:", count)
    
  //     console.log("count",count);
       
  //       const invoiceNumber = await this.generateInvoiceNo(deliveryChallan.companyName.name, deliveryChallan.fromLocation.prefix, count);
    
        
  //       const invoiceDate = new Date();
  //       const rawDate =invoiceDate ;
  // const { createdDate, createdTime } = formatDateTime(rawDate);
      
 
        
  //       const invoiceData = {
  //         company: sanitizeValue(deliveryChallan.companyName.name),
  //           poNo: sanitizeValue(deliveryChallan.poNumber).toUpperCase(),
  //           partyName: sanitizeValue(deliveryChallan.customer.organisationName),
  //           customerCode: sanitizeValue(deliveryChallan.customer.customerCode),
  //           billToAddress: deliveryChallan.customer.billingDetails.billingAddress ? {
  //             address1: sanitizeValue(deliveryChallan.customer.billingDetails.billingAddress?.address1),
  //             address2: sanitizeValue(deliveryChallan.customer.billingDetails.billingAddress?.address2),
  //             location: sanitizeValue(deliveryChallan.customer.billingDetails.billingAddress?.location),
  //             city: sanitizeValue(deliveryChallan.customer.billingDetails.billingAddress?.city),
  //             state: sanitizeValue(deliveryChallan.customer.billingDetails.billingAddress?.state),
  //             pincode: sanitizeValue(deliveryChallan.customer.billingDetails.billingAddress?.pincode),
  //           }:null,
  //           shipToAddress: deliveryChallan.customer.deliveryDetails.deliveryAddress ?{
  //             address1: sanitizeValue(deliveryChallan.customer.deliveryDetails.deliveryAddress?.address1),
  //             address2: sanitizeValue(deliveryChallan.customer.deliveryDetails.deliveryAddress?.address2),
  //             location: sanitizeValue(deliveryChallan.customer.deliveryDetails.deliveryAddress?.location),
  //             city: sanitizeValue(deliveryChallan.customer.deliveryDetails.deliveryAddress?.city),
  //             state: sanitizeValue(deliveryChallan.customer.deliveryDetails.deliveryAddress?.state),
  //             pincode: sanitizeValue(deliveryChallan.customer.deliveryDetails.deliveryAddress?.pincode),
  //           }:null,
  //           panNo: sanitizeValue(deliveryChallan.customer.statutoryDetails.panNo).toUpperCase(),
  //           gstn: sanitizeValue(deliveryChallan.customer.statutoryDetails.gstn).toUpperCase(),
  //           items: deliveryChallan.deliveryChallanProducts.map(item => ({
  //             productName: sanitizeValue(item.productName.name),
  //             qty: sanitizeValue(item.quantity),
  //             uom: sanitizeValue(item.uom.unit),
  //             rate: sanitizeValue(item.unitPrice),
  //             amt: sanitizeValue(item.amount),
  //           })),
  //           bankDetails:deliveryChallan.companyName.bankDetails?{
  //             bankName: sanitizeValue(deliveryChallan.companyName.bankDetails[0]?.bankName),
  //             branch: sanitizeValue(deliveryChallan.companyName.bankDetails[0]?.branch),
  //             accountNo: sanitizeValue(deliveryChallan.companyName.bankDetails[0]?.accountNo),
  //             ifsc: sanitizeValue(deliveryChallan.companyName.bankDetails[0]?.ifscCode),
  //           }:null,
  //           amountInWords: sanitizeValue(deliveryChallan.totalAmtInWords).toUpperCase(),
  //           totalAmt: sanitizeValue(deliveryChallan.totalProductAmount),
  //           vehicleNo: sanitizeValue(deliveryChallan.vehicleNo).toUpperCase(),
  //           createdDate: sanitizeValue(formattedCreatedDate),
  //           invoiceNumber: sanitizeValue(invoiceNumber), 
  //           invoiceDate: sanitizeValue(createdDate), 
  //           type: sanitizeValue(invoiceType).toUpperCase(), 
  //         };
          
    
  //       console.log("invoiceData", invoiceData);
        
        
  //       const pdfUrl = await this.pdfGeneratorService.generateInvoicePdf(invoiceData);
    
      
  //       const invoice = this.invoiceRepository.create({
           
  //           invoiceNo: invoiceNumber,
  //           invoiceDate: createdDate ? new Date(createdDate) : new Date(), // Ensure this is a valid Date object
  //           type: invoiceType,
  //           location: deliveryChallan.fromLocation,
  //           deliveryChallan,
  //           pdfData: pdfUrl, 
  //       });
    
        
  //       return await this.invoiceRepository.save(invoice);
  //     }
    
async generateInvoice(deliveryChallanId: string, invoiceType: string): Promise<any> {
  console.log("deliveryChallanId", deliveryChallanId);
  console.log("invoiceType", invoiceType);

  // 🔹 Fetch challan with child (CustomerDeliveryChallan) relations
  const deliveryChallan = await this.challanRepository.findOne({
    where: { id: deliveryChallanId },
    relations: [
      'deliveryChallanProducts',
      'deliveryChallanProducts.productName',
      'deliveryChallanProducts.uom',
      'companyName',
      'companyName.bankDetails',
      'offices',
      'customerName', // 👈 from CustomerDeliveryChallan
      'customerName.billingDetails.billingAddress',
      'customerName.deliveryDetails.deliveryAddress',
      'customerName.statutoryDetails',
      'billingAddress', // 👈 CustomerDeliveryChallan specific
      'deliveryAddress', // 👈 CustomerDeliveryChallan specific
    ],
  });

  if (!deliveryChallan) {
    throw new Error('Delivery Challan not found');
  }

  // Format challan date
  const deliveryChallanDate = deliveryChallan.createdAt;
  const { createdDate: formattedCreatedDate } = formatDateTime(deliveryChallanDate);

  // 🔹 Count invoices for this office to generate running invoice number
  const count = await this.invoiceRepository.count({
    where: { location: { id: deliveryChallan.fromLocation?.id } },
  });

  const invoiceNumber = await this.generateInvoiceNo(
    deliveryChallan.companyName.name,
    deliveryChallan.fromLocation?.prefix,
    count,
  );

  // Invoice date
  const invoiceDate = new Date();
  const { createdDate } = formatDateTime(invoiceDate);

  // 🔹 Build invoice data
  const invoiceData = {
    company: sanitizeValue(deliveryChallan.companyName?.name),
    poNo: sanitizeValue((deliveryChallan as CustomerDeliveryChallan)?.poNumber)?.toUpperCase(),
    partyName: deliveryChallan.customerName
      ? sanitizeValue(deliveryChallan.customerName.organisationName)
      : null,
    customerCode: deliveryChallan.customerName
      ? sanitizeValue(deliveryChallan.customerName.customerCode)
      : null,

    // Prefer challan.billingAddress / deliveryAddress if set, fallback to customerName.*
    billToAddress: deliveryChallan.billingAddress
      ? {
          address1: sanitizeValue(deliveryChallan.billingAddress?.address1),
          address2: sanitizeValue(deliveryChallan.billingAddress?.address2),
          location: sanitizeValue(deliveryChallan.billingAddress?.location),
          city: sanitizeValue(deliveryChallan.billingAddress?.city),
          state: sanitizeValue(deliveryChallan.billingAddress?.state),
          pincode: sanitizeValue(deliveryChallan.billingAddress?.pincode),
        }
      : deliveryChallan.customerName?.billingDetails?.billingAddress
      ? {
          address1: sanitizeValue(deliveryChallan.customerName.billingDetails.billingAddress?.address1),
          address2: sanitizeValue(deliveryChallan.customerName.billingDetails.billingAddress?.address2),
          location: sanitizeValue(deliveryChallan.customerName.billingDetails.billingAddress?.location),
          city: sanitizeValue(deliveryChallan.customerName.billingDetails.billingAddress?.city),
          state: sanitizeValue(deliveryChallan.customerName.billingDetails.billingAddress?.state),
          pincode: sanitizeValue(deliveryChallan.customerName.billingDetails.billingAddress?.pincode),
        }
      : null,

    shipToAddress: deliveryChallan.deliveryAddress
      ? {
          address1: sanitizeValue(deliveryChallan.deliveryAddress?.address1),
          address2: sanitizeValue(deliveryChallan.deliveryAddress?.address2),
          location: sanitizeValue(deliveryChallan.deliveryAddress?.location),
          city: sanitizeValue(deliveryChallan.deliveryAddress?.city),
          state: sanitizeValue(deliveryChallan.deliveryAddress?.state),
          pincode: sanitizeValue(deliveryChallan.deliveryAddress?.pincode),
        }
      : deliveryChallan.customerName?.deliveryDetails?.deliveryAddress
      ? {
          address1: sanitizeValue(deliveryChallan.customerName.deliveryDetails.deliveryAddress?.address1),
          address2: sanitizeValue(deliveryChallan.customerName.deliveryDetails.deliveryAddress?.address2),
          location: sanitizeValue(deliveryChallan.customerName.deliveryDetails.deliveryAddress?.location),
          city: sanitizeValue(deliveryChallan.customerName.deliveryDetails.deliveryAddress?.city),
          state: sanitizeValue(deliveryChallan.customerName.deliveryDetails.deliveryAddress?.state),
          pincode: sanitizeValue(deliveryChallan.customerName.deliveryDetails.deliveryAddress?.pincode),
        }
      : null,

    panNo: deliveryChallan.customerName
      ? sanitizeValue(deliveryChallan.customerName.statutoryDetails?.panNo)?.toUpperCase()
      : null,
    gstn: deliveryChallan.customerName
      ? sanitizeValue(deliveryChallan.customerName.statutoryDetails?.gstn)?.toUpperCase()
      : null,

    items: deliveryChallan.deliveryChallanProducts.map(item => ({
      productName: sanitizeValue(item.productName?.name),
      qty: sanitizeValue(item.quantity),
      uom: sanitizeValue(item.uom?.unit),
      rate: sanitizeValue(item.unitPrice),
      amt: sanitizeValue(item.amount),
    })),

    bankDetails: deliveryChallan.companyName.bankDetails?.length
      ? {
          bankName: sanitizeValue(deliveryChallan.companyName.bankDetails[0]?.bankName),
          branch: sanitizeValue(deliveryChallan.companyName.bankDetails[0]?.branch),
          accountNo: sanitizeValue(deliveryChallan.companyName.bankDetails[0]?.accountNo),
          ifsc: sanitizeValue(deliveryChallan.companyName.bankDetails[0]?.ifscCode),
        }
      : null,

    amountInWords: sanitizeValue(deliveryChallan.totalAmtInWords)?.toUpperCase(),
    totalAmt: sanitizeValue(deliveryChallan.totalProductAmount),
    vehicleNo: sanitizeValue(deliveryChallan.vehicleNo)?.toUpperCase(),
    createdDate: sanitizeValue(formattedCreatedDate),
    invoiceNumber: sanitizeValue(invoiceNumber),
    invoiceDate: sanitizeValue(createdDate),
    type: sanitizeValue(invoiceType)?.toUpperCase(),
  };

  console.log("invoiceData", invoiceData);

  // 🔹 Generate invoice PDF
  const pdfUrl = await this.pdfGeneratorService.generateInvoicePdf(invoiceData);

  // 🔹 Save invoice entity
  const invoice = this.invoiceRepository.create({
    invoiceNo: invoiceNumber,
    invoiceDate: createdDate ? new Date(createdDate) : new Date(),
    type: invoiceType,
    location: deliveryChallan.fromLocation,
    deliveryChallan,
    pdfData: pdfUrl,
  });

  return await this.invoiceRepository.save(invoice);
}




     async generateFinalInvoice(
  deliveryChallanId: string,
  invoiceType: string
): Promise<any> {
  console.log("deliveryChallanId", deliveryChallanId);
  console.log("invoiceType", invoiceType);

  // First, update delivery challan with latest return data
  await this.updateDeliveryChallanWithReturns(deliveryChallanId);

  const deliveryChallan = await this.challanRepository.findOne({
    where: { id: deliveryChallanId },
    relations: [
      'deliveryChallanProducts',
      'deliveryChallanProducts.productName',
      'deliveryChallanProducts.uom',
      'companyName',
      'companyName.bankDetails',
      'offices',
      'customerName', // 👈 from CustomerDeliveryChallan
      'customerName.billingDetails.billingAddress',
      'customerName.deliveryDetails.deliveryAddress',
      'customerName.statutoryDetails',
      'billingAddress', // 👈 CustomerDeliveryChallan specific
      'deliveryAddress', // 👈 CustomerDeliveryChallan specific
    ],
  });

  if (!deliveryChallan) {
    throw new Error("Delivery Challan not found");
  }

  const date = new Date();

  // Count for invoice number generation
  const count = await this.invoiceRepository.count({
    where: { location: { id: deliveryChallan.fromLocation?.id } },
  });

  console.log("Count for fromLocation ID:", count);

  const invoiceNumber = await this.generateInvoiceNo(
    deliveryChallan.companyName.name,
    deliveryChallan.fromLocation?.prefix,
    count
  );

  // Build items with changedQty / changedPrice preference and return calculations
  const items = deliveryChallan.deliveryChallanProducts.map((product) => {
    // Get base quantity and price (prefer changed values)
    const baseQuantity =
      product.changedQty !== null && product.changedQty !== undefined
        ? product.changedQty
        : product.quantity;
    const baseUnitPrice =
      product.changedPrice !== null && product.changedPrice !== undefined
        ? product.changedPrice
        : product.unitPrice;
    
    // Get return values (default to 0 if not set) - using existing returnedQty field
    const returnQty = product.returnedQty || 0;
    const returnAmount = product.returnedAmount || 0;
    const returnNetWeight = product.returnedNetWeight || 0;
    
    // Calculate net values after returns
    const netQuantity = baseQuantity - returnQty;
    const baseAmount = baseQuantity * baseUnitPrice;
    const netAmount = baseAmount - returnAmount;
    const netWeight = (product.netWeight || 0) - returnNetWeight;

    return {
      productName: sanitizeValue(product.productName.name),
      uom: sanitizeValue(product.uom?.unit) || "",
      originalQty: baseQuantity,
      returnQty: returnQty,
      qty: netQuantity,
      rate: baseUnitPrice,
      originalAmt: baseAmount,
      returnAmt: returnAmount,
      amt: netAmount,
      netWeight: netWeight,
    };
  });

  console.log("items with returns", items);

  // Compute totals (using net amounts after returns)
  const totalAmount = items.reduce((sum, item) => sum + item.amt, 0);
  const totalAmountInWords = toWords(totalAmount).toUpperCase();

  // Format date
  const { createdDate } = formatDateTime(deliveryChallan.createdAt);

  const invoiceData = {
    company: sanitizeValue(deliveryChallan.companyName.name),
    poNo: sanitizeValue(deliveryChallan.poNumber).toUpperCase(),
    partyName: sanitizeValue(deliveryChallan.customerName.organisationName),
    customerCode: sanitizeValue(deliveryChallan.customerName.customerCode),
    billToAddress: deliveryChallan.customerName.billingDetails.billingAddress
      ? {
          address1: sanitizeValue(
            deliveryChallan.customerName.billingDetails.billingAddress?.address1
          ),
          address2: sanitizeValue(
            deliveryChallan.customerName.billingDetails.billingAddress?.address2
          ),
          location: sanitizeValue(
            deliveryChallan.customerName.billingDetails.billingAddress?.location
          ),
          city: sanitizeValue(
            deliveryChallan.customerName.billingDetails.billingAddress?.city
          ),
          state: sanitizeValue(
            deliveryChallan.customerName.billingDetails.billingAddress?.state
          ),
          pincode: sanitizeValue(
            deliveryChallan.customerName.billingDetails.billingAddress?.pincode
          ),
        }
      : null,
    shipToAddress: deliveryChallan.customerName.deliveryDetails.deliveryAddress
      ? {
          address1: sanitizeValue(
            deliveryChallan.customerName.deliveryDetails.deliveryAddress?.address1
          ),
          address2: sanitizeValue(
            deliveryChallan.customerName.deliveryDetails.deliveryAddress?.address2
          ),
          location: sanitizeValue(
            deliveryChallan.customerName.deliveryDetails.deliveryAddress?.location
          ),
          city: sanitizeValue(
            deliveryChallan.customerName.deliveryDetails.deliveryAddress?.city
          ),
          state: sanitizeValue(
            deliveryChallan.customerName.deliveryDetails.deliveryAddress?.state
          ),
          pincode: sanitizeValue(
            deliveryChallan.customerName.deliveryDetails.deliveryAddress?.pincode
          ),
        }
      : null,
    panNo: sanitizeValue(
      deliveryChallan.customerName.statutoryDetails.panNo
    ).toUpperCase(),
    gstn: sanitizeValue(
      deliveryChallan.customerName.statutoryDetails.gstn
    ).toUpperCase(),
    items,
    bankDetails: deliveryChallan.companyName.bankDetails
      ? {
          bankName: sanitizeValue(
            deliveryChallan.companyName.bankDetails[0]?.bankName
          ),
          branch: sanitizeValue(
            deliveryChallan.companyName.bankDetails[0]?.branch
          ),
          accountNo: sanitizeValue(
            deliveryChallan.companyName.bankDetails[0]?.accountNo
          ),
          ifsc: sanitizeValue(
            deliveryChallan.companyName.bankDetails[0]?.ifscCode
          ),
        }
      : null,
    amountInWords: sanitizeValue(totalAmountInWords).toUpperCase(),
    totalAmt: totalAmount, // use recalculated total instead of deliveryChallan.totalProductAmount
    vehicleNo: sanitizeValue(deliveryChallan.vehicleNo).toUpperCase(),
    createdDate: sanitizeValue(createdDate),
    invoiceNumber: sanitizeValue(invoiceNumber).toUpperCase(),
    invoiceDate: sanitizeValue(createdDate),
    type: sanitizeValue(invoiceType).toUpperCase(),
  };

  console.log("invoiceData", invoiceData);

  // Generate PDF
  const pdfUrl =
    await this.pdfGeneratorService.generateInvoicePdf(
      
      invoiceData,
      
    );

  // Save invoice entity
  const invoice = this.invoiceRepository.create({
    invoiceNo: invoiceNumber,
    invoiceDate: date,
    type: invoiceType,
    location: deliveryChallan.fromLocation,
    deliveryChallan,
    pdfData: pdfUrl,
    totalAmount,
  });

  return await this.invoiceRepository.save(invoice);
}

    async getInvoice(deliveryChallanId: string): Promise<any> {
       
        console.log("deliveryChallanId",deliveryChallanId);
        const invoice = await this.invoiceRepository.findOne({
            where: { deliveryChallan: { id: deliveryChallanId } }, 
            relations: ['deliveryChallan'], 
        });
    
        if (!invoice) {
            throw new AppError(400,'Invoice not found for the given delivery challan ID');
        }
    
        
        return { id: invoice.id, pdfData: invoice.pdfData };
    }


    async getAllInvoice(): Promise<any> {
      const invoice = await this.invoiceRepository.find({
          relations: ['deliveryChallan'], 
      });
      return invoice;
    }

    /**
     * Update delivery challan items with return data from customer returns
     * This aggregates all returns for a delivery challan and updates the items
     */
    async updateDeliveryChallanWithReturns(deliveryChallanId: string): Promise<void> {
      // Get all returns for this delivery challan
      const returns = await this.postReturnByCustomerRepository.find({
        where: { deliveryChallanNo: { id: deliveryChallanId } },
        relations: ['returnedProducts', 'returnedProducts.productName'],
      });

      if (!returns || returns.length === 0) {
        console.log('No returns found for this delivery challan');
        return;
      }

      // Get the delivery challan with its products
      const deliveryChallan = await this.challanRepository.findOne({
        where: { id: deliveryChallanId },
        relations: ['deliveryChallanProducts', 'deliveryChallanProducts.productName'],
      });

      if (!deliveryChallan) {
        throw new Error('Delivery Challan not found');
      }

      // Aggregate returns by product
      const returnsByProduct = new Map<string, { qty: number; amount: number; netWeight: number }>();

      returns.forEach((returnRecord) => {
        returnRecord.returnedProducts.forEach((returnedProduct) => {
          const productId = returnedProduct.productName.id;
          const existing = returnsByProduct.get(productId) || { qty: 0, amount: 0, netWeight: 0 };

          existing.qty += returnedProduct.returnedQty || 0;
          existing.amount += returnedProduct.returnedQtyAmt || 0;
          existing.netWeight += returnedProduct.returnedNetWt || 0;

          returnsByProduct.set(productId, existing);
        });
      });

      // Update delivery challan products with aggregated return data
      for (const product of deliveryChallan.deliveryChallanProducts) {
        const productId = product.productName.id;
        const returns = returnsByProduct.get(productId);

        if (returns) {
          product.returnedQty = returns.qty;
          product.returnedAmount = returns.amount;
          product.returnedNetWeight = returns.netWeight;
        }
      }

      // Save updated delivery challan
      await this.challanRepository.save(deliveryChallan);
      console.log('Delivery challan updated with return data');
    }
    
}


function sanitizeValue(value: any): string {
    return value == null ? '' : value.toString();
  }
  