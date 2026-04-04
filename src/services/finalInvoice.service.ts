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
import { DocDoubleApproverService } from './docDoubleApprover.service';
import { toWords } from 'number-to-words';
import { DocumentbRepository } from '../repositories/documentb.repository';

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
    @inject(TYPES.DocDoubleApproverService)
    private docDoubleApproverService: DocDoubleApproverService,
     @inject(TYPES.DocumentbRepository)
    private readonly documentbRepository: DocumentbRepository,
  ) {
    this.invoiceRepository = this.dataSource.getRepository(Invoice);
    this.invoiceProductRepository = this.dataSource.getRepository(InvoiceProduct);
  }

  async create(deliveryChallanId: string, additionalData: any, requestedBy: any): Promise<any> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      console.log("requested by id in the create service",requestedBy)
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
        totalAmtInWords: deliveryChallan.totalAmtInWords,
        cgst: additionalData.cgst || 0,
        sgst: additionalData.sgst || 0,
        igst: additionalData.igst || 0,
        taxAmount: additionalData.taxAmount || 0,
        discount: additionalData.discount || 0,
        freight: additionalData.freight || 0,
        otherCharges: additionalData.otherCharges || 0,
        createdBy: { id: requestedBy },
      };
console.log(invoiceData)
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
      await queryRunner.commitTransaction();

      // Start approval flow after commit so invoice is visible to other DB connections
      await this.documentService.startApprovalFlow(document.id);

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
    const document = await this.docDoubleApproverService.getDocumentById(id);
    console.log(document);

    const invoiceId = document.documentTypeId;
    console.log(invoiceId)

    if (!invoiceId) {
      throw new AppError(400, `Invoice with document ID ${id} not found`);
    }

    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId },
      relations: [
        'invoiceProducts',
        'invoiceProducts.productName',
        'invoiceProducts.variant',
        'invoiceProducts.saleUoM',
        'companyName',
        'companyName.bankDetails',
        'deliveryChallan',
        'customerName',
        'customerName.statutoryDetails',
        'fromLocation',
        'billingAddress',
        'deliveryAddress',
        'createdBy',
      ],
    });

    if (!invoice) {
      throw new AppError(400, `Invoice with ID ${invoiceId} not found`);
    }

    const { createdDate, createdTime } = formatDateTime(invoice.createdAt);

    // Get customer contact number
    const customerContactNo = invoice.customerName?.primaryContactNo || invoice.customerName?.secondaryContactNo || null;

    // Get GSTN and PAN from statutory details
    const gstn = invoice.customerName?.statutoryDetails?.gstn || null;
    const panNo = invoice.customerName?.statutoryDetails?.panNo || null;

    // Get company bank details
    const companyBankDetails = invoice.companyName?.bankDetails && invoice.companyName.bankDetails.length > 0 
      ? invoice.companyName.bankDetails[0] 
      : null;

    return {
      id: invoice.id,
      invoiceNo: invoice.invoiceNo,
      invoiceDate: invoice.invoiceDate,
      companyName: {
        id: invoice.companyName?.id || null,
        name: invoice.companyName?.name || null,
        officeAddress: invoice.companyName?.officeAddress || null,
        gstNo: invoice.companyName?.gstNo || null,
        fassaiNo: invoice.companyName?.fassaiNo || null,
        bankDetails: companyBankDetails
          ? {
              bankName: companyBankDetails.bankName || null,
              accountNo: companyBankDetails.accountNo || null,
              branch: companyBankDetails.branch || null,
              ifscCode: companyBankDetails.ifscCode || null,
            }
          : null,
      },
      customer:{
        id:invoice.customerName?.id|| null,
         customerName: invoice.customerName?.organisationName || null,
      customerCode: invoice.customerName?.customerCode || null,
      contactNo: customerContactNo|| null,
      gstn: gstn|| null,
      panNo: panNo|| null,

      },
      createdDate: createdDate,
      createdTime: createdTime,
      deliveryChallan: invoice.deliveryChallan?.challanNo || null,
     
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
      createdBy: invoice.createdBy
        ? `${invoice.createdBy.firstName} ${invoice.createdBy.lastName}`
        : null,
      invoiceProducts: invoice.invoiceProducts?.map((product) => ({
        id: product.id,
        productName: product.productName?.name || null,
        variant: product.variant?.variantName || null,
        quantity: product.quantity,
        acceptedQty: (product.quantity || 0) - (product.returnedQty || 0),
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
      overAllStatus: document.overAllStatus,
      approvalSummary: document.approvalSummary,
      documentId: document.id,
    };
  }

  public async getAll(
    queryOptions: PaginationOptions,
    userId: string,
  ): Promise<any> {
    const { data, meta } = await this.docDoubleApproverService.getAllDocumentByUserIdForDoubleApprover(
      userId,
      DocumentTypeEnum.FINAL_INVOICE,
      queryOptions
    );

    const { search } = queryOptions;
    const typedDocuments = data as any[];
    const activeDocuments = typedDocuments.filter(doc => !doc.isDeleted);
    
    for (const doc of activeDocuments) {
      if (!doc.document_type_id) continue;
      try {
        doc.relatedData = await this.invoiceRepository.findOne({
          where: { id: doc.document_type_id },
          relations: [
            'invoiceProducts',
            'companyName',
            'deliveryChallan',
            'customerName',
            'fromLocation',
            'billingAddress',
            'deliveryAddress',
            'createdBy',
          ],
        });
      } catch {
        doc.relatedData = null;
      }
    }

    let relatedDataOnly = activeDocuments
      .filter((doc) => doc.relatedData)
      .map((doc) => ({
        documentId: doc.id,
        overAllStatus: doc.status,
        createdBy: doc.lastActionBy?.firstName + ' ' + doc.lastActionBy?.lastName,
        createdDate: formatDateTime(doc.createdAt).createdDate,
        createdTime: formatDateTime(doc.createdAt).createdTime,
        
        id: doc.relatedData.id,
        invoiceNo: doc.relatedData.invoiceNo,
        invoiceDate: doc.relatedData.invoiceDate,
         vehicleNo:doc.relatedData.vehicleNo||null,
        companyName: doc.relatedData.companyName?.name || null,
        deliveryChallan: doc.relatedData.deliveryChallan?.challanNo || null,
        customerName: doc.relatedData.customerName?.organisationName || null,
        poNumber: doc.relatedData.poNumber,
        fromLocation: doc.relatedData.fromLocation?.name || null,
        totalProductAmount: doc.relatedData.totalProductAmount,
        netProductWeight: doc.relatedData.netProductWeight,
        totalAmount: doc.relatedData.totalAmount,
      deliveryAddress:
(doc.relatedData.deliveryAddress?.adress1 || "") +
(doc.relatedData.deliveryAddress?.adress2 || "") + " " +
(doc.relatedData.deliveryAddress?.location || "") + " " +
(doc.relatedData.deliveryAddress?.city || "") + " " +
(doc.relatedData.deliveryAddress?.state || "") + " " +
(doc.relatedData.deliveryAddress?.pincode || "") || null,

billingAddress:
(doc.relatedData.billingAddress?.adress1 || "") +
(doc.relatedData.billingAddress?.adress2 || "") + " " +
(doc.relatedData.billingAddress?.location || "") + " " +
(doc.relatedData.billingAddress?.city || "") + " " +
(doc.relatedData.billingAddress?.state || "") + " " +
(doc.relatedData.billingAddress?.pincode || "") || null,
       
      }));

    // 🔍 Deep search helper
    const objectToString = (obj: any): string => {
      if (obj == null) return '';
      if (typeof obj === 'object') {
        return Object.values(obj).map((v) => objectToString(v)).join(' ');
      }
      return String(obj);
    };

    // 🔍 Apply search filter
    if (search && search.trim()) {
      const term = search.toLowerCase();
      relatedDataOnly = relatedDataOnly.filter((item) =>
        objectToString(item).toLowerCase().includes(term)
      );
    }

    // 🔄 Sorting
    if (queryOptions.sort) {
      const [field, direction] = queryOptions.sort.split(':');
      const sortOrder = direction?.toUpperCase() === 'DESC' ? -1 : 1;

      const getNestedValue = (obj: any, path: string) =>
        path.split('.').reduce((o, key) => (o ? o[key] : undefined), obj);

      relatedDataOnly.sort((a, b) => {
        const valA = getNestedValue(a, field);
        const valB = getNestedValue(b, field);

        if (valA == null && valB == null) return 0;
        if (valA == null) return -1 * sortOrder;
        if (valB == null) return 1 * sortOrder;

        if (!isNaN(valA) && !isNaN(valB)) {
          return (Number(valA) - Number(valB)) * sortOrder;
        }
        return String(valA).localeCompare(String(valB)) * sortOrder;
      });
    }

    return {
      data: relatedDataOnly,
      meta: {
        total: meta.total,
        page: meta.page,
        pages: meta.pages,
      },
    };
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
        
        // Get delivery challan to calculate acceptedQty with returns
        const deliveryChallan = invoice.deliveryChallan;
        
        // Format invoice products with acceptedQty = qty - returnedQty (if returns exist)
        const items = invoice.invoiceProducts?.map((product) => {
          // If returnedQty exists and is > 0, calculate acceptedQty = qty - returnedQty
          // Otherwise, use the original qty
          const returnedQty = product.returnedQty || 0;
          const acceptedQty = returnedQty > 0 ? (product.quantity || 0) - returnedQty : (product.quantity || 0);
          // Calculate amount based on acceptedQty
          const amt = acceptedQty * (product.unitPrice || 0);
          
          return {
            productName: product.productName?.name || '',
            variantName: product.variant?.variantName || '',
            qty: product.quantity || 0,
            acceptedQty: acceptedQty,
            rate: product.unitPrice || 0,
            amt: amt,
            uom: product.saleUoM?.unit || '',
          };
        }) || [];
        
        // Recalculate total amount based on updated items
        const totalAmt = items.reduce((sum, item) => sum + item.amt, 0);
        const amountInWords = toWords(totalAmt).toUpperCase();
        
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
          totalAmt: totalAmt,
          totalAmtInWord: amountInWords,
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
    public async deleteMultipleFinalInvoices(ids: string[]): Promise<{ success: string[]; failed: { id: string; reason: string }[]; message: string }> {
  const success: string[] = [];
  const failed: { id: string; reason: string }[] = [];
  for (const id of ids) {
    try {
      const finalInvoice = await this.invoiceRepository.findOne({
        where: { id },
      });
      if (!finalInvoice) {
        failed.push({ id, reason: 'FinalInvoice not found' });
        continue;
      }
      const relatedDocument = await this.documentbRepository.findOne({
        where: { document_type_id: finalInvoice.id }
      });

      if (!relatedDocument) {
        throw new Error(`Something went wrong`);
      }

      const deleteDocument = await this.documentbRepository.delete(relatedDocument.id);
      if (!deleteDocument) {
        throw new Error(`Failed to delete related document with ID ${relatedDocument.id}`);
      }

      const deleteAqr = await this.invoiceRepository.delete(finalInvoice.id);
      if (!deleteAqr) {
        throw new Error(`Failed to delete FinalInvoice with ID ${id}`);
      }
      success.push(id);
    } catch (error: any) {
      failed.push({ id, reason: error.message || 'Unknown error' });
    }
  }
  const message = `Deletion completed. Success: ${success.length}, Failed: ${failed.length}`;
  return { success, failed, message };
}

}
