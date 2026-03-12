import { inject, injectable } from 'inversify';
import { TYPES } from '../types';
import logger from '../utils/logger';
import { buildQuery, PaginationOptions } from '../utils/pagination';
import { formatDateTime } from '../utils/dateUtils';
import AppError from '../utils/appError';
import { DataSource } from 'typeorm';
import { Invoice } from '../entities/invoice.entity';
import { InvoiceProduct } from '../entities/invoiceProduct.entity';
import { Repository } from 'typeorm';
import { CustomerDeliveryChallanRepository } from '../repositories/customerDeliveryChallan.repository';
import { DocumentbService } from './documentb.service';
import { DocumentStatus, DocumentTypeEnum } from '../entities/docuemnt.entity';
import { DocumentTypeEnum as DocDefEnum } from '../entities/documentdef.entity';

@injectable()
export class FinalInvoiceService {
  private invoiceRepository: Repository<Invoice>;
  private invoiceProductRepository: Repository<InvoiceProduct>;

  constructor(
    @inject(TYPES.DataSource)
    private readonly dataSource: DataSource,
    @inject(TYPES.CustomerDeliveryChallanRepository)
    private challanRepository: CustomerDeliveryChallanRepository,
    @inject(TYPES.DocumentbService)
    private documentService: DocumentbService,
  ) {
    this.invoiceRepository = this.dataSource.getRepository(Invoice);
    this.invoiceProductRepository = this.dataSource.getRepository(InvoiceProduct);
  }

  async create(deliveryChallanId: string, additionalData: any, requestedBy: any): Promise<any> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Fetch delivery challan with all related data
      const deliveryChallan = await queryRunner.manager.findOne(this.challanRepository.target, {
        where: { id: deliveryChallanId },
        relations: [
          'deliveryChallanProducts',
          'deliveryChallanProducts.productName',
          'deliveryChallanProducts.variant',
          'deliveryChallanProducts.saleUoM',
          'customerName',
          'fromLocation',
          'companyName',
          'billingAddress',
          'deliveryAddress',
        ],
      });

      if (!deliveryChallan) {
        throw new AppError(404, `Delivery Challan with id ${deliveryChallanId} not found`);
      }

      // Check if invoice already created for this delivery challan
      if (deliveryChallan.isInvoiceCreated) {
        throw new AppError(400, `Invoice has already been created for this delivery challan`);
      }

      // Generate invoice number
      const companyName = deliveryChallan.companyName?.name || 'Company';
      const locationPrefix = deliveryChallan.fromLocation?.name || 'LOC';
      const invoiceNo = await this.generateInvoiceNo(companyName, locationPrefix);

      // Create invoice from delivery challan data
      const invoiceData = {
        invoiceNo: invoiceNo,
        invoiceDate: additionalData.invoiceDate || new Date(),
        companyName: deliveryChallan.companyName,
        deliveryChallan: { id: deliveryChallanId },
        customerName: deliveryChallan.customerName,
        poNumber: deliveryChallan.poNumber,
        fromLocation: deliveryChallan.fromLocation,
        billingAddress: deliveryChallan.billingAddress,
        deliveryAddress: deliveryChallan.deliveryAddress,
        vehicleNo: deliveryChallan.vehicleNo,
        placeOfSupply: additionalData.placeOfSupply || deliveryChallan.deliveryAddress?.state,
        totalProductAmount: deliveryChallan.totalProductAmount,
        netProductWeight: deliveryChallan.netProductWeight,
        totalAmount: additionalData.totalAmount || deliveryChallan.totalProductAmount,
        totalAmtInWords: additionalData.totalAmtInWords,
        cgst: additionalData.cgst || 0,
        sgst: additionalData.sgst || 0,
        igst: additionalData.igst || 0,
        taxAmount: additionalData.taxAmount || 0,
        discount: additionalData.discount || 0,
        freight: additionalData.freight || 0,
        otherCharges: additionalData.otherCharges || 0,
        createdBy: { id: requestedBy },
      };

      const invoice = queryRunner.manager.create(Invoice, invoiceData);
      const savedInvoice = await queryRunner.manager.save(invoice);

      // Create invoice products from delivery challan products
      if (deliveryChallan.deliveryChallanProducts && deliveryChallan.deliveryChallanProducts.length > 0) {
        const invoiceProducts = deliveryChallan.deliveryChallanProducts.map((dcProduct) => {
          const invoiceProduct = queryRunner.manager.create(InvoiceProduct, {
            productName: dcProduct.productName,
            variant: dcProduct.variant,
            quantity: dcProduct.quantity,
            acceptedQty: dcProduct.acceptedQty,
            rejectedQty: dcProduct.rejectedQty,
            returnedQty: dcProduct.returnedQty,
            saleUoM: dcProduct.saleUoM,
            amount: dcProduct.amount,
            unitPrice: dcProduct.unitPrice,
            grossWeight: dcProduct.grossWeight,
            netWeight: dcProduct.netWeight,
            hsnCode: additionalData.hsnCode || '',
            description: dcProduct.productName?.description || '',
          });
          invoiceProduct.invoice = savedInvoice;
          return invoiceProduct;
        });

        await queryRunner.manager.save(InvoiceProduct, invoiceProducts);
      }

      // Mark delivery challan as invoice created
      deliveryChallan.isInvoiceCreated = true;
      await queryRunner.manager.save(deliveryChallan);

      console.log("Creating document for final invoice...");
      // Create document
      const document = await this.documentService.createDocument({
        type: DocumentTypeEnum.FINAL_INVOICE,
        docDef: DocDefEnum.SALE,
        status: DocumentStatus.HOLD,
        remarks: 'Document auto-created with Final Invoice',
        lastActionBy: { id: requestedBy },
        document_type_id: savedInvoice.id,
      });

      console.log("Document created with ID:", document.id);
      console.log("Starting approval flow for final invoice...");
      await this.documentService.startApprovalFlow(document.id);

      await queryRunner.commitTransaction();

      // Fetch the complete invoice with relations
      const completeInvoice = await this.invoiceRepository.findOne({
        where: { id: savedInvoice.id },
        relations: [
          'invoiceProducts',
          'companyName',
          'deliveryChallan',
          'customerName',
          'fromLocation',
          'billingAddress',
          'deliveryAddress',
        ],
      });

      return completeInvoice;
    } catch (error: any) {
      await queryRunner.rollbackTransaction();
      console.error('Error creating Final Invoice:', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new Error('Failed to create Final Invoice');
    } finally {
      await queryRunner.release();
    }
  }

  private async generateInvoiceNo(companyName: string, locationPrefix: string): Promise<string> {
    // Get the last invoice for this company and location
    const lastInvoice = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.companyName', 'company')
      .leftJoinAndSelect('invoice.fromLocation', 'location')
      .where('company.name = :companyName', { companyName })
      .andWhere('location.name = :locationPrefix', { locationPrefix })
      .orderBy('invoice.createdAt', 'DESC')
      .getOne();

    let lastSerialNumber = 0;
    
    if (lastInvoice && lastInvoice.invoiceNo) {
      // Extract serial number from invoice format: INITIALS-YEAR-LOCATION-SERIAL
      const parts = lastInvoice.invoiceNo.split('-');
      if (parts.length === 4) {
        lastSerialNumber = parseInt(parts[3]) || 0;
      }
    }

    // Extract first letter of each word to create company initials
    const companyInitials = companyName
      .split(/\s+/) // Split by whitespace
      .map(word => word.trim())
      .filter(word => word.length > 0 && /[a-zA-Z]/.test(word[0])) // Only words starting with letters
      .map(word => word[0].toUpperCase()) // Take first letter and uppercase
      .join('');
    const year = new Date().getFullYear();
    const serialNumber = (lastSerialNumber + 1).toString().padStart(5, '0');
    
    return `${companyInitials}-${year}-${locationPrefix}-${serialNumber}`;
  }

  public async getByIdForUpdate(id: string): Promise<any> {
    const invoice = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.invoiceProducts', 'products')
      .leftJoinAndSelect('invoice.companyName', 'companyName')
      .leftJoinAndSelect('invoice.deliveryChallan', 'deliveryChallan')
      .leftJoinAndSelect('invoice.customerName', 'customerName')
      .leftJoinAndSelect('invoice.fromLocation', 'fromLocation')
      .leftJoinAndSelect('invoice.billingAddress', 'billingAddress')
      .leftJoinAndSelect('invoice.deliveryAddress', 'deliveryAddress')
      .leftJoinAndSelect('products.productName', 'productName')
      .leftJoinAndSelect('products.variant', 'variant')
      .leftJoinAndSelect('products.saleUoM', 'saleUoM')
      .where('invoice.id = :id', { id })
      .getOne();

    if (!invoice) {
      throw new AppError(400, `Invoice with id ${id} not found`);
    }

    const { createdDate, createdTime } = formatDateTime(invoice.createdAt);

    const formattedInvoice = {
      id: invoice.id,
      invoiceNo: invoice.invoiceNo,
      invoiceDate: invoice.invoiceDate,
      companyName: invoice.companyName?.id || null,
      deliveryChallan: invoice.deliveryChallan?.id || null,
      customerName: invoice.customerName?.id || null,
      poNumber: invoice.poNumber,
      fromLocation: invoice.fromLocation?.id || null,
      billingAddress: invoice.billingAddress
        ? {
            id: invoice.billingAddress.id,
            address1: invoice.billingAddress.address1,
            address2: invoice.billingAddress.address2,
            location: invoice.billingAddress.location,
            city: invoice.billingAddress.city,
            state: invoice.billingAddress.state,
            pincode: invoice.billingAddress.pincode,
          }
        : null,
      deliveryAddress: invoice.deliveryAddress
        ? {
            id: invoice.deliveryAddress.id,
            address1: invoice.deliveryAddress.address1,
            address2: invoice.deliveryAddress.address2,
            location: invoice.deliveryAddress.location,
            city: invoice.deliveryAddress.city,
            state: invoice.deliveryAddress.state,
            pincode: invoice.deliveryAddress.pincode,
          }
        : null,
      vehicleNo: invoice.vehicleNo,
      placeOfSupply: invoice.placeOfSupply,
      totalProductAmount: invoice.totalProductAmount,
      netProductWeight: invoice.netProductWeight,
      totalAmount: invoice.totalAmount,
      totalAmtInWords: invoice.totalAmtInWords,
      cgst: invoice.cgst,
      sgst: invoice.sgst,
      igst: invoice.igst,
      taxAmount: invoice.taxAmount,
      discount: invoice.discount,
      freight: invoice.freight,
      otherCharges: invoice.otherCharges,
      createdDate,
      createdTime,
      invoiceProducts: invoice.invoiceProducts?.map((product) => ({
        id: product.id,
        productName: product.productName?.id || null,
        variant: product.variant?.id || null,
        quantity: product.quantity,
        acceptedQty: product.acceptedQty,
        rejectedQty: product.rejectedQty,
        returnedQty: product.returnedQty,
        saleUoM: product.saleUoM?.id || null,
        amount: product.amount,
        unitPrice: product.unitPrice,
        grossWeight: product.grossWeight,
        netWeight: product.netWeight,
        hsnCode: product.hsnCode,
        description: product.description,
      })) || [],
    };

    return { data: formattedInvoice };
  }

  public async getByIdForView(id: string): Promise<any> {
    const invoice = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.invoiceProducts', 'products')
      .leftJoinAndSelect('invoice.companyName', 'companyName')
      .leftJoinAndSelect('invoice.deliveryChallan', 'deliveryChallan')
      .leftJoinAndSelect('invoice.customerName', 'customerName')
      .leftJoinAndSelect('invoice.fromLocation', 'fromLocation')
      .leftJoinAndSelect('invoice.billingAddress', 'billingAddress')
      .leftJoinAndSelect('invoice.deliveryAddress', 'deliveryAddress')
      .leftJoinAndSelect('invoice.createdBy', 'createdBy')
      .leftJoinAndSelect('products.productName', 'productName')
      .leftJoinAndSelect('products.variant', 'variant')
      .leftJoinAndSelect('products.saleUoM', 'saleUoM')
      .where('invoice.id = :id', { id })
      .getOne();

    if (!invoice) {
      throw new AppError(400, `Invoice with id ${id} not found`);
    }

    const { createdDate, createdTime } = formatDateTime(invoice.createdAt);

    const formattedInvoice = {
      id: invoice.id,
      invoiceNo: invoice.invoiceNo,
      invoiceDate: invoice.invoiceDate,
      companyName: invoice.companyName?.name || null,
      deliveryChallan: invoice.deliveryChallan?.challanNo || null,
      customerName: invoice.customerName?.organisationName || null,
      poNumber: invoice.poNumber,
      fromLocation: invoice.fromLocation?.name || null,
      billingAddress: invoice.billingAddress
        ? {
            id: invoice.billingAddress.id,
            address1: invoice.billingAddress.address1,
            address2: invoice.billingAddress.address2,
            location: invoice.billingAddress.location,
            city: invoice.billingAddress.city,
            state: invoice.billingAddress.state,
            pincode: invoice.billingAddress.pincode,
          }
        : null,
      deliveryAddress: invoice.deliveryAddress
        ? {
            id: invoice.deliveryAddress.id,
            address1: invoice.deliveryAddress.address1,
            address2: invoice.deliveryAddress.address2,
            location: invoice.deliveryAddress.location,
            city: invoice.deliveryAddress.city,
            state: invoice.deliveryAddress.state,
            pincode: invoice.deliveryAddress.pincode,
          }
        : null,
      vehicleNo: invoice.vehicleNo,
      placeOfSupply: invoice.placeOfSupply,
      totalProductAmount: invoice.totalProductAmount,
      netProductWeight: invoice.netProductWeight,
      totalAmount: invoice.totalAmount,
      totalAmtInWords: invoice.totalAmtInWords,
      cgst: invoice.cgst,
      sgst: invoice.sgst,
      igst: invoice.igst,
      taxAmount: invoice.taxAmount,
      discount: invoice.discount,
      freight: invoice.freight,
      otherCharges: invoice.otherCharges,
      createdDate,
      createdTime,
      createdBy: invoice.createdBy
        ? `${invoice.createdBy.firstName} ${invoice.createdBy.lastName}`
        : null,
      invoiceProducts: invoice.invoiceProducts?.map((product) => ({
        id: product.id,
        productName: product.productName?.name || null,
        variant: product.variant?.variantName || null,
        quantity: product.quantity,
        acceptedQty: product.acceptedQty,
        rejectedQty: product.rejectedQty,
        returnedQty: product.returnedQty,
        saleUoM: product.saleUoM?.unit || null,
        amount: product.amount,
        unitPrice: product.unitPrice,
        grossWeight: product.grossWeight,
        netWeight: product.netWeight,
        hsnCode: product.hsnCode,
        description: product.description,
      })) || [],
    };

    return { data: formattedInvoice };
  }

  public async getAll(
    queryOptions: PaginationOptions,
    userId: string,
  ): Promise<any> {
    const queryBuilder = this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.invoiceProducts', 'products')
      .leftJoinAndSelect('invoice.companyName', 'companyName')
      .leftJoinAndSelect('invoice.deliveryChallan', 'deliveryChallan')
      .leftJoinAndSelect('invoice.customerName', 'customerName')
      .leftJoinAndSelect('invoice.fromLocation', 'fromLocation')
      .leftJoinAndSelect('invoice.billingAddress', 'billingAddress')
      .leftJoinAndSelect('invoice.deliveryAddress', 'deliveryAddress')
      .leftJoinAndSelect('invoice.createdBy', 'createdBy');

    const invoices = await buildQuery(queryBuilder, queryOptions, 'invoice');

    const response = {
      data: invoices.data.map((invoice) => {
        const { createdDate, createdTime } = formatDateTime(invoice.createdAt);

        return {
          id: invoice.id,
          invoiceNo: invoice.invoiceNo,
          invoiceDate: invoice.invoiceDate,
          companyName: invoice.companyName?.name || null,
          deliveryChallan: invoice.deliveryChallan?.challanNo || null,
          customerName: invoice.customerName?.organisationName || null,
          poNumber: invoice.poNumber,
          fromLocation: invoice.fromLocation?.name || null,
          totalProductAmount: invoice.totalProductAmount,
          netProductWeight: invoice.netProductWeight,
          totalAmount: invoice.totalAmount,
          cgst: invoice.cgst,
          sgst: invoice.sgst,
          igst: invoice.igst,
          taxAmount: invoice.taxAmount,
          createdDate,
          createdTime,
          createdBy: invoice.createdBy
            ? `${invoice.createdBy.firstName} ${invoice.createdBy.lastName}`
            : null,
        };
      }),
      meta: invoices.meta,
    };

    return response;
  }

  async update(id: string, data: any): Promise<any> {
    try {
      const invoice = await this.invoiceRepository.findOne({ where: { id } });

      if (!invoice) return null;

      const updated = Object.assign(invoice, data);
      return await this.invoiceRepository.save(updated);
    } catch (err) {
      logger.error(`Error updating final invoice with ID: ${id}`, {
        error: err,
      });
      return null;
    }
  }

  public async getByIdForPdf(id: string): Promise<any> {
      try {
        const invoice = await this.invoiceRepository.findOne({
          where: { id },
          relations: [
            'invoiceProducts',
            'invoiceProducts.productName',
            'invoiceProducts.variant',
            'invoiceProducts.saleUoM',
            'companyName',
            'companyName.bankDetails',
            'deliveryChallan',
            'customerName',
            'customerName.billingDetails',
            'customerName.deliveryDetails',
            'customerName.statutoryDetails',
           
            'fromLocation',
            'fromLocation.address',
            'billingAddress',
            'deliveryAddress',
            'createdBy',
          ],
        });

        if (!invoice) {
          throw new AppError(404, 'Invoice not found');
        }

        // Get company details
        const company = invoice.companyName;

        // Get customer details
        const customer = invoice.customerName;

        // Get billing address (from invoice or customer)
        const billToAddress = invoice.billingAddress
          ? {
              address1: invoice.billingAddress.address1 || '',
              address2: invoice.billingAddress.address2 || '',
              location: invoice.billingAddress.location || '',
              city: invoice.billingAddress.city || '',
              state: invoice.billingAddress.state || '',
              pincode: invoice.billingAddress.pincode || '',
            }
          : customer?.billingDetails?.billingAddress
          ? {
              address1: customer.billingDetails.billingAddress?.address1 || '',
              address2: customer.billingDetails.billingAddress?.address2 || '',
              location: customer.billingDetails.billingAddress?.location || '',
              city: customer.billingDetails.billingAddress?.city || '',
              state: customer.billingDetails.billingAddress?.state || '',
              pincode: customer.billingDetails.billingAddress?.pincode || '',
            }
          : null;

        // Get delivery/shipping address (from invoice or customer)
        const shipToAddress = invoice.deliveryAddress
          ? {
              address1: invoice.deliveryAddress.address1 || '',
              address2: invoice.deliveryAddress.address2 || '',
              location: invoice.deliveryAddress.location || '',
              city: invoice.deliveryAddress.city || '',
              state: invoice.deliveryAddress.state || '',
              pincode: invoice.deliveryAddress.pincode || '',
            }
          : customer?.deliveryDetails?.deliveryAddress
          ? {
              address1: customer.deliveryDetails.deliveryAddress?.address1 || '',
              address2: customer.deliveryDetails.deliveryAddress?.address2 || '',
              location: customer.deliveryDetails.deliveryAddress?.location || '',
              city: customer.deliveryDetails.deliveryAddress?.city || '',
              state: customer.deliveryDetails.deliveryAddress?.state || '',
              pincode: customer.deliveryDetails.deliveryAddress?.pincode || '',
            }
          : null;

        // Get bank details from customer or company
        const customerBankDetails = customer?.bankDetails;
        const companyBankDetails = company?.bankDetails && company.bankDetails.length > 0 ? company.bankDetails[0] : null;
        const bankDetails = (customerBankDetails || companyBankDetails || {}) as any;
        
        // Map bank details properties correctly based on entity type
        const mappedBankDetails = {
          bankName: bankDetails?.bankName || '',
          accountNo: bankDetails?.accountNo || '',
          ifsc: bankDetails?.ifscCode || bankDetails?.ifsc || '',
          branch: bankDetails?.bankBranch || bankDetails?.branch || '',
        };
        
        
        // Format invoice products
        const items = invoice.invoiceProducts?.map((product) => ({

          productName: product.productName?.name || '',
          variantName: product.variant?.variantName || '',
          qty: product.quantity || 0,
          rate: product.unitPrice || 0,
          amt: product.amount || 0,
          uom: product.saleUoM?.unit || '',
        })) || [];
console.log(items)
        // Format date safely
        let invoiceDate = '';
        if (invoice.invoiceDate) {
          const date = new Date(invoice.invoiceDate);
          invoiceDate = `${date.getDate().toString().padStart(2, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getFullYear()}`;
        }

        // Build formatted data object for template
        const formattedData = {
          type: 'SALE',
          company: company?.name || '',
          invoiceNumber: invoice.invoiceNo || '',
          invoiceDate: invoiceDate,
          poNo: invoice.poNumber || '',
          vehicleNo: invoice.vehicleNo || '',
          customerCode: customer?.customerCode || '',
          partyName: customer?.organisationName || '',
          billToAddress: billToAddress ? {
            address1: billToAddress.address1 || '',
            address2: billToAddress.address2 || '',
            location: billToAddress.location || '',
            city: billToAddress.city || '',
            state: billToAddress.state || '',
            pincode: billToAddress.pincode || '',
          } : { city: '' },
          shipToAddress: shipToAddress ? {
            address1: shipToAddress.address1 || '',
            address2: shipToAddress.address2 || '',
            location: shipToAddress.location || '',
            city: shipToAddress.city || '',
            state: shipToAddress.state || '',
            pincode: shipToAddress.pincode || '',
          } : { city: '' },
          gstn: customer?.statutoryDetails?.gstn || '',
          panNo: customer?.statutoryDetails?.panNo || '',
          items: items,
          totalAmt: invoice.totalAmount || 0,
          amountInWords: invoice.totalAmtInWords || '',
          bankDetails: mappedBankDetails,
        };

        return formattedData;
      } catch (error: any) {
        logger.error(`Error fetching invoice for PDF with ID: ${id}`, {
          error: error,
          message: error.message,
          stack: error.stack,
        });
        if (error instanceof AppError) {
          throw error;
        }
        throw new Error(`Failed to fetch invoice for PDF generation: ${error.message}`);
      }
    }

}
