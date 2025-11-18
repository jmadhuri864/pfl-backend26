import { inject, injectable } from 'inversify';
import * as XLSX from 'xlsx';
import { DataSource } from 'typeorm';
import { CustomerRepository } from '../repositories/customer.repository';
import { Customer } from '../entities/customer.entity';
import { CustomerCategoryService } from './customerCategory.service';
import { CustomerTypeService } from './customerType.service';
import { AddressService } from './address.service';
import AppError from '../utils/appError';
import { TYPES } from '../types';

import { Address } from '../entities/address.entity';
import { AuditLogService } from './auditLog.service';
import { buildQuery, PaginationOptions } from '../utils/pagination';
import { OfficeUseOnly } from '../entities/officeUseOnlyCust.entity';
import { CustomerCategory } from '../entities/customerCategory.entity';
import { CustomerType } from '../entities/customerType.entity';
import { keyMobileNoData } from '../entities/keyMobileNoCust.entity';
import { ProductSpecification } from '../entities/productSpecificationCust.entity';
import { BankDetailsCust } from '../entities/bankDetailsCust.entity';
import { StatutoryDetails } from '../entities/statutoryCust.entity';
import { BillingDetailsCust } from '../entities/billingdetailsCust.entity';
import { DeliveryDetails } from '../entities/deliveryDetailsCust.entity';
import { PaymentTerms } from '../entities/paymentDetailsCust.entity';
import { generateIncrementalCode } from '../utils/codeGeneration';
import { UserRepository } from '../repositories/user.repository';
import { Role } from '../entities/user.entity';
import { Status } from '../utils/status.enum';
import { formatDateTime } from '../utils/dateUtils';

@injectable()
export class CustomerService {
  private customerRepository: CustomerRepository;
  private customerCategoryService: CustomerCategoryService;
  private customerTypeService: CustomerTypeService;
  private addressService: AddressService;

  constructor(
    @inject(TYPES.DataSource) private dataSource: DataSource,
    @inject(TYPES.CustomerCategoryService)
    customerCategoryService: CustomerCategoryService,
    @inject(TYPES.CustomerTypeService) customerTypeService: CustomerTypeService,
    @inject(TYPES.UserRepository) private userRepository: UserRepository,
    @inject(TYPES.AddressService) addressService: AddressService,
    @inject(TYPES.AuditLogService)
    private readonly auditLogService: AuditLogService,
  ) {
    this.customerRepository = this.dataSource.getRepository(
      Customer,
    ) as CustomerRepository;
    this.customerCategoryService = customerCategoryService;
    this.customerTypeService = customerTypeService;
    this.addressService = addressService;
  }

  public async create(customerData: any): Promise<Customer[]> {
    console.log('in the service', customerData);

    const user = await this.userRepository.findOneBy({
      id: customerData.createdBy,
    });
    if (user?.roles && user.roles.includes('admin' as Role)) {
      customerData.status = 'approved';
    }
    customerData.customerCode = await generateIncrementalCode('customer');
    const cus = this.customerRepository.create(customerData);
    return await this.customerRepository.save(cus);
  }

  async findAllCustomers(queryOptions: PaginationOptions): Promise<any> {
  const queryBuilder = this.customerRepository
    .createQueryBuilder('customer')
    .leftJoinAndSelect('customer.customerCategory', 'customerCategory')
    .leftJoinAndSelect('customer.createdBy', 'createdBy')
    .leftJoinAndSelect('customer.customerTypes', 'customerTypes')
    .leftJoinAndSelect('customer.bankDetails', 'bankDetailsCust')
    .leftJoinAndSelect('customer.customerAddress', 'customerAddress')
    .leftJoinAndSelect('customer.statutoryDetails', 'statutoryDetails')
    .leftJoinAndSelect('customer.billingDetails', 'billingDetails')
    .leftJoinAndSelect('customer.deliveryDetails', 'deliveryDetails')
    .leftJoinAndSelect('customer.paymentTerms', 'paymentTerms')
    .leftJoinAndSelect('customer.officeUseOnly', 'officeUseOnly')
    .leftJoinAndSelect('customer.keyMobileNumbers', 'keyMobileNumbers')
    .leftJoinAndSelect('customer.productSpecification', 'productSpecification')
    .orderBy('customer.createdAt', 'DESC');

  const customers = await buildQuery(queryBuilder, queryOptions, 'customer');

  // ✅ Helper to format date and time in "dd-mm-yyyy" and "hh:mm AM/PM"
  // function formatDateTime(dateString?: string) {
  //   if (!dateString) return { createdDate: null, createdTime: null };

  //   const date = new Date(dateString);
  //   const day = String(date.getDate()).padStart(2, '0');
  //   const month = String(date.getMonth() + 1).padStart(2, '0');
  //   const year = date.getFullYear();

  //   const hours = date.getHours();
  //   const minutes = String(date.getMinutes()).padStart(2, '0');
  //   const ampm = hours >= 12 ? 'PM' : 'AM';
  //   const hour12 = hours % 12 || 12; // convert to 12-hour format
  //   const formattedTime = `${String(hour12).padStart(2, '0')}:${minutes} ${ampm}`;

  //   const formattedDate = `${day}-${month}-${year}`;

  //   return { createdDate: formattedDate, createdTime: formattedTime };
  // }

  const formattedData = customers.data.map((cust: any) => {
    const { createdDate, createdTime } = formatDateTime(cust.createdAt);

    return {
      ...cust,
      createdBy: cust.createdBy.firstName+' '+cust.createdBy.lastName,
        // ? {
        //     id: cust.createdBy.id,
        //     name: cust.createdBy.username, // or fullName if available
        //   }
        // : null,
      createdDate,
      createdTime,
    };
  });

  return {
    ...customers,
    data: formattedData,
  };
}



  async findCustomerById(id: string): Promise<any> {
    return this.customerRepository.findOne({
      where: { id },
      relations: [
        'customerCategory',
        'customerTypes',
        'bankDetails',
        'customerAddress',
        'statutoryDetails',
        'billingDetails.billingAddress',
        'deliveryDetails.deliveryAddress',
        'keyMobileNumbers.ref1Address',
        'keyMobileNumbers.ref2Address',
        'billingDetails',
        'deliveryDetails',
        'paymentTerms',
        'officeUseOnly',
        'keyMobileNumbers',
        'productSpecification',
      ],
    });
  }

  async findCustomerByIdforview(id: string): Promise<any> {
    const data = await this.customerRepository.findOne({
      where: { id },
      relations: [
        'customerCategory',
        'customerTypes',
        'bankDetails',
        'bankDetails.bankAddress',
        'customerAddress',
        'statutoryDetails',
        'billingDetails.billingAddress',
        'deliveryDetails.deliveryAddress',
        'keyMobileNumbers.ref1Address',
        'keyMobileNumbers.ref2Address',
        'billingDetails',
        'deliveryDetails',
        'paymentTerms',
        'officeUseOnly',
        'keyMobileNumbers',
        'productSpecification',
        'createdBy'
      ],
    });

    if (!data) {
      throw new AppError(404, 'Customer not found');
    }
    const formatteddata = {
      id: data.id,
      organisationName: data.organisationName,
      customerImage: data.customerImage,
      organisationType: data.organisationType,
      otherType: data.otherType,
      customerCategory: data.customerCategory.name,
      createdBy: data.createdBy.firstName+' '+data.createdBy.lastName,
      createdTime: formatDateTime(data.createdAt).createdTime,
      createdDate: formatDateTime(data.createdAt).createdDate,
       customerCode: data.customerCode,
      emailSecondary: data.emailSecondary,
       emailPrimary: data.emailPrimary,
       secondaryContactNo: data.secondaryContactNo,
       primaryContactNo: data.primaryContactNo,
      // ? {
      //     id: data.customerCategory.id,
      //     name: data.customerCategory.name,
      //   }
      // : null,
      customerTypes: data.customerTypes.name,
      // ? {
      //     id: data.customerTypes.id,
      //     name: data.customerTypes.name,
      //   }
      // : null,
      bankDetails: data.bankDetails
        ? {
            id: data.bankDetails.id,
            accountHolderFName: data.bankDetails.accountHolderFName,
            accountHolderMName: data.bankDetails.accountHolderMName,
            accountHolderLName: data.bankDetails.accountHolderLName,
            ifscCode: data.bankDetails.ifscCode,
            bankBranch: data.bankDetails.bankBranch,
            bankAccNo: data.bankDetails.bankAccNo,
            accType: data.bankDetails.accType,
            ifCancelledCheque: data.bankDetails.ifCancelledCheque,
            notCancelledChequereason: data.bankDetails.notCancelledChequereason,
            cancelledChequeCopy: data.bankDetails.cancelledChequeCopy,
            otherAccType: data.bankDetails.otherAccType,
            bankStatementCopy: data.bankDetails.bankStatementCopy,
            bankName: data.bankDetails.bankName,
            bankAddress: data.bankDetails.bankAddress
              ? {
                  id: data.bankDetails.bankAddress.id,
                  address1: data.bankDetails.bankAddress.address1,
                  address2: data.bankDetails.bankAddress.address2,
                  location: data.bankDetails.bankAddress.location,
                  city: data.bankDetails.bankAddress.city,
                  state: data.bankDetails.bankAddress.state,
                  pincode: data.bankDetails.bankAddress.pincode,
                }
              : null,
          }
        : null,
      customerAddress: data.customerAddress
        ? {
            id: data.customerAddress.id,
            address1: data.customerAddress.address1,
            address2: data.customerAddress.address2,
            location: data.customerAddress.location,
            city: data.customerAddress.city,
            state: data.customerAddress.state,
            pincode: data.customerAddress.pincode,
          }
        : null,
      statutoryDetails: data.statutoryDetails
        ? {
            id: data.statutoryDetails.id,
            gstn: data.statutoryDetails.gstn,
            panNo: data.statutoryDetails.panNo,
            aadharNo: data.statutoryDetails.aadharNo,
            panCopy: data.statutoryDetails.panCopy,
            aadharCopy: data.statutoryDetails.aadharCopy,
            billBookCopy: data.statutoryDetails.billBookCopy,
            certificationDetails: data.statutoryDetails.certificationsDetails,
            otherCertification: data.statutoryDetails.otherCertifications,
            corpRegiDetails: data.statutoryDetails.corpRegiDetails,
            otherCorpRegiDetails: data.statutoryDetails.otherCorpRegiDetails,
            incorpoCertificateCopy:
              data.statutoryDetails.incorpoCertificateCopy,
            cinNo: data.statutoryDetails.cinNo,
            regiCertificateCopy: data.statutoryDetails.regiCertificateCopy,
          }
        : null,

      billingDetails: data.billingDetails
        ? {
            id: data.billingDetails.id,
            billingName: data.billingDetails.billingName,
            contactPersonFName: data.billingDetails.contactPersonFName,
            contactPersonLName: data.billingDetails.contactPersonLName,
            contactPersonMName: data.billingDetails.contactPersonMName,
            commonlyKnownAs: data.billingDetails.commonlyKnownAs,
            primaryContactNo: data.billingDetails.primaryContactNo,
            secondaryContactNo: data.billingDetails.secondaryContactNo,
            billingFormatCopy: data.billingDetails.billingFormatCopy,
            billingAddressProofCopy:
              data.billingDetails.billingAddressProofCopy,
            emailPrimary: data.billingDetails.emailPrimary,
            emailSecondary: data.billingDetails.emailSecondary,
            billingAddress: data.billingDetails.billingAddress
              ? {
                  id: data.billingDetails.billingAddress.id,
                  address1: data.billingDetails.billingAddress.address1,
                  address2: data.billingDetails.billingAddress.address2,
                  location: data.billingDetails.billingAddress.location,
                  city: data.billingDetails.billingAddress.city,
                  state: data.billingDetails.billingAddress.state,
                  pincode: data.billingDetails.billingAddress.pincode,
                }
              : null,
          }
        : null,
      deliveryDetails: data.deliveryDetails
        ? {
            deliveryAddress: data.deliveryDetails.deliveryAddress
              ? {
                  id: data.deliveryDetails.deliveryAddress.id,
                  address1: data.deliveryDetails.deliveryAddress.address1,
                  address2: data.deliveryDetails.deliveryAddress.address2,
                  location: data.deliveryDetails.deliveryAddress.location,
                  city: data.deliveryDetails.deliveryAddress.city,
                  state: data.deliveryDetails.deliveryAddress.state,
                  pincode: data.deliveryDetails.deliveryAddress.pincode,
                }
              : null,
            deliveryAddressProofCopy:
              data.deliveryDetails.deliveryAddressProofCopy,
            deliveryTime: data.deliveryDetails.deliveryTime,
            receivingPersonFName: data.deliveryDetails.receivingPersonFName,
            receivingPersonMName: data.deliveryDetails.receivingPersonMName,
            receivingPersonLName: data.deliveryDetails.receivingPersonLName,
            primaryContactNo: data.deliveryDetails.primaryContactNo,
            secondaryContactNo: data.deliveryDetails.secondaryContactNo,
            emailPrimary: data.deliveryDetails.emailPrimary,
            emailSecondary: data.deliveryDetails.emailSecondary,
          }
        : null,

      paymentTerms: data.paymentTerms
        ? {
            id: data.paymentTerms.id,
            paymentMode: data.paymentTerms.paymentMode,
            otherPaymentMode: data.paymentTerms.otherPaymentMode,
            otherPaymentMade: data.paymentTerms.otherPaymentMade,
            paymentMade: data.paymentTerms.paymentMade,
            marginDeposit: data.paymentTerms.marginDeposit,
            rtv: data.paymentTerms.rtv,
            agreementExecuted: data.paymentTerms.agreementExecuted,
            lc: data.paymentTerms.lc,
            bg: data.paymentTerms.bg,
            securityDepoCheqNo: data.paymentTerms.securityDepoCheqNo,
            securityDepoAmt: data.paymentTerms.securityDepoAmt,
            IELinAmt: data.paymentTerms.IELinAmt,
            IELRecommendedBy: data.paymentTerms.IELRecommendedBy,
            IELRecommendedDate: data.paymentTerms.IELRecommendedDate,
            RELinAmt: data.paymentTerms.RELinAmt,
            RELRecommendedBy: data.paymentTerms.RELRecommendedBy,
            RELRecommendedDate: data.paymentTerms.RELRecommendedDate,
            reason: data.paymentTerms.reason,
            docEvidenceCopy: data.paymentTerms.docEvidenceCopy,
          }
        : null,

      officeUseOnly: data.officeUseOnly
        ? {
            id: data.officeUseOnly.id,
            proposerBDName: data.officeUseOnly.proposerBDName,
            pflCoordinator: data.officeUseOnly.pflCoordinator,
            recommendedBy: data.officeUseOnly.recommendedBy,
            dispatchLocationPfl: data.officeUseOnly.dispatchLocationPfl,
            approvedBy: data.officeUseOnly.approvedBy,
            relationshipManager: data.officeUseOnly.relationshipManager,
            avgBillingMonthly: data.officeUseOnly.avgBillingMonthly,
            volumeMonthly: data.officeUseOnly.volumeMonthly,
            customerVerification: data.officeUseOnly.customerVerification,
            verificationAgency: data.officeUseOnly.verificationAgency,
            validityPeriod: data.officeUseOnly.validityPeriod,
            dueDiligenceDone: data.officeUseOnly.dueDiligenceDone,
            creditWorthinessDue: data.officeUseOnly.creditWorthinessDue,
            keyAccountPersonAssigned:
              data.officeUseOnly.keyAccountPersonAssigned,
            sinceWhen: data.officeUseOnly.sinceWhen,
            ledgerCreatedDate: data.officeUseOnly.ledgerCreatedDate,
            ledgerCreatedBy: data.officeUseOnly.ledgerCreatedBy,
            ledgerVerifiedApprovedBy:
              data.officeUseOnly.ledgerVerifiedApprovedBy,
            createdBy: data.officeUseOnly.createdBy,
            additionalNotes: data.officeUseOnly.additionalNotes,
          }
        : null,
      keyMobileNumbers: data.keyMobileNumbers
        ? {
            id: data.keyMobileNumbers.id,
            accDeptFName: data.keyMobileNumbers.accDeptFName,
            accDeptMName: data.keyMobileNumbers.accDeptMName,
            accDeptLName: data.keyMobileNumbers.accDeptLName,
            accDeptMobileNo: data.keyMobileNumbers.accDeptMobileNo,
            ownerFName: data.keyMobileNumbers.ownerFName,
            ownerMName: data.keyMobileNumbers.ownerMName,
            ownerLName: data.keyMobileNumbers.ownerLName,
            ownerMobileNo: data.keyMobileNumbers.ownerMobileNo,
            mandiLicenceNo: data.keyMobileNumbers.mandiLicenceNo,
            mandilicenceCopy: data.keyMobileNumbers.mandiLicenceCopy,
            regiNo: data.keyMobileNumbers.regiNo,
            regiCopy: data.keyMobileNumbers.regiCopy,
            electricityBill: data.keyMobileNumbers.electricityBill,
            electricityBillCopy: data.keyMobileNumbers.electricityBillCopy,
            notElectricityBillReason:
              data.keyMobileNumbers.notElectricityBillReason,
            consumerNo: data.keyMobileNumbers.consumerNo,
            customerBlackListed: data.keyMobileNumbers.customerBlacklisted,
            ifBlacklistedReason: data.keyMobileNumbers.ifBlacklistedReason,
            blackListedBy: data.keyMobileNumbers.blackListedBy,
            visitingCard: data.keyMobileNumbers.visitingCard,
            visitingCardCopy: data.keyMobileNumbers.visitingCardCopy,
            visitingContactNo: data.keyMobileNumbers.visitingContactNo,
            notVisitingCardReason: data.keyMobileNumbers.notVisitingCardReason,

            ref1FName: data.keyMobileNumbers.ref1FName,
            ref1MName: data.keyMobileNumbers.ref1MName,
            ref1LName: data.keyMobileNumbers.ref1LName,
            ref1ContactNo: data.keyMobileNumbers.ref1ContactNo,
            ref1Email: data.keyMobileNumbers.ref1Email,
            ref1Address: data.keyMobileNumbers.ref1Address
              ? {
                  id: data.keyMobileNumbers.ref1Address.id,
                  address1: data.keyMobileNumbers.ref1Address.address1,
                  address2: data.keyMobileNumbers.ref1Address.address2,
                  location: data.keyMobileNumbers.ref1Address.location,
                  city: data.keyMobileNumbers.ref1Address.city,
                  state: data.keyMobileNumbers.ref1Address.state,
                  pincode: data.keyMobileNumbers.ref1Address.pincode,
                }
              : null,
            ref2FName: data.keyMobileNumbers.ref2FName,
            ref2MName: data.keyMobileNumbers.ref2MName,
            ref2LName: data.keyMobileNumbers.ref2LName,
            ref2ContactNo: data.keyMobileNumbers.ref2ContactNo,
            ref2Email: data.keyMobileNumbers.ref2Email,
            ref2Address: data.keyMobileNumbers.ref2Address
              ? {
                  id: data.keyMobileNumbers.ref2Address.id,
                  address1: data.keyMobileNumbers.ref2Address.address1,
                  address2: data.keyMobileNumbers.ref2Address.address2,
                  location: data.keyMobileNumbers.ref2Address.location,
                  city: data.keyMobileNumbers.ref2Address.city,
                  state: data.keyMobileNumbers.ref2Address.state,
                  pincode: data.keyMobileNumbers.ref2Address.pincode,
                }
              : null,
          }
        : null,
      productSpecification: data.productSpecification.map((spec) => ({
        id: spec.id,
        articleName: spec.articleName,
        specifications: spec.specifications,
        packingMaterialSpec: spec.packingMaterialSpec,
        parameters: spec.parameters,

        rejectionCriteria: spec.rejectionCriteria,
        comment: spec.comment,
      })),
    };
    return formatteddata;
  }

  async findCustomerByIdforupdate(id: string): Promise<any> {
    const data = await this.customerRepository.findOne({
      where: { id },
      relations: [
        'customerCategory',
        'customerTypes',
        'bankDetails',
        'bankDetails.bankAddress',
        'customerAddress',
        'statutoryDetails',
        'billingDetails.billingAddress',
        'deliveryDetails.deliveryAddress',
        'keyMobileNumbers.ref1Address',
        'keyMobileNumbers.ref2Address',
        'billingDetails',
        'deliveryDetails',
        'paymentTerms',
        'officeUseOnly',
        'keyMobileNumbers',
        'productSpecification',
      ],
    });

    if (!data) {
      throw new AppError(404, 'Customer not found');
    }
    const formatteddata = {
      id: data.id,
      organisationName: data.organisationName,
      customerImage: data.customerImage,
      organisationType: data.organisationType,
      otherType: data.otherType,
      customerCategory: data.customerCategory.id,
      customerCode: data.customerCode,
      emailSecondary: data.emailSecondary,
       emailPrimary: data.emailPrimary,
       secondaryContactNo: data.secondaryContactNo,
       primaryContactNo: data.primaryContactNo,
        createdBy: data.createdBy.firstName+' '+data.createdBy.lastName,
      createdTime: formatDateTime(data.createdAt).createdTime,
      createdDate: formatDateTime(data.createdAt).createdDate,
      // ? {
      //     id: data.customerCategory.id,
      //     name: data.customerCategory.name,
      //   }
      // : null,
      customerTypes: data.customerTypes.id,
      // ? {
      //     id: data.customerTypes.id,
      //     name: data.customerTypes.name,
      //   }
      // : null,
      bankDetails: data.bankDetails
        ? {
            id: data.bankDetails.id,
            accountHolderFName: data.bankDetails.accountHolderFName,
            accountHolderMName: data.bankDetails.accountHolderMName,
            accountHolderLName: data.bankDetails.accountHolderLName,
            ifscCode: data.bankDetails.ifscCode,
            bankBranch: data.bankDetails.bankBranch,
            bankAccNo: data.bankDetails.bankAccNo,
            accType: data.bankDetails.accType,
            ifCancelledCheque: data.bankDetails.ifCancelledCheque,
            notCancelledChequereason: data.bankDetails.notCancelledChequereason,
            cancelledChequeCopy: data.bankDetails.cancelledChequeCopy,
            otherAccType: data.bankDetails.otherAccType,
            bankStatementCopy: data.bankDetails.bankStatementCopy,
            bankName: data.bankDetails.bankName,
            bankAddress: data.bankDetails.bankAddress
              ? {
                  id: data.bankDetails.bankAddress.id,
                  address1: data.bankDetails.bankAddress.address1,
                  address2: data.bankDetails.bankAddress.address2,
                  location: data.bankDetails.bankAddress.location,
                  city: data.bankDetails.bankAddress.city,
                  state: data.bankDetails.bankAddress.state,
                  pincode: data.bankDetails.bankAddress.pincode,
                }
              : null,
          }
        : null,
      customerAddress: data.customerAddress
        ? {
            id: data.customerAddress.id,
            address1: data.customerAddress.address1,
            address2: data.customerAddress.address2,
            location: data.customerAddress.location,
            city: data.customerAddress.city,
            state: data.customerAddress.state,
            pincode: data.customerAddress.pincode,
          }
        : null,
      statutoryDetails: data.statutoryDetails
        ? {
            id: data.statutoryDetails.id,
            gstn: data.statutoryDetails.gstn,
            panNo: data.statutoryDetails.panNo,
            aadharNo: data.statutoryDetails.aadharNo,
            panCopy: data.statutoryDetails.panCopy,
            aadharCopy: data.statutoryDetails.aadharCopy,
            billBookCopy: data.statutoryDetails.billBookCopy,
            certificationDetails: data.statutoryDetails.certificationsDetails,
            otherCertification: data.statutoryDetails.otherCertifications,
            corpRegiDetails: data.statutoryDetails.corpRegiDetails,
            otherCorpRegiDetails: data.statutoryDetails.otherCorpRegiDetails,
            incorpoCertificateCopy:
              data.statutoryDetails.incorpoCertificateCopy,
            cinNo: data.statutoryDetails.cinNo,
            regiCertificateCopy: data.statutoryDetails.regiCertificateCopy,
          }
        : null,

      billingDetails: data.billingDetails
        ? {
            id: data.billingDetails.id,
            billingName: data.billingDetails.billingName,
            contactPersonFName: data.billingDetails.contactPersonFName,
            contactPersonLName: data.billingDetails.contactPersonLName,
            contactPersonMName: data.billingDetails.contactPersonMName,
            commonlyKnownAs: data.billingDetails.commonlyKnownAs,
            primaryContactNo: data.billingDetails.primaryContactNo,
            secondaryContactNo: data.billingDetails.secondaryContactNo,
            billingFormatCopy: data.billingDetails.billingFormatCopy,
            billingAddressProofCopy:
              data.billingDetails.billingAddressProofCopy,
            emailPrimary: data.billingDetails.emailPrimary,
            emailSecondary: data.billingDetails.emailSecondary,
            billingAddress: data.billingDetails.billingAddress
              ? {
                  id: data.billingDetails.billingAddress.id,
                  address1: data.billingDetails.billingAddress.address1,
                  address2: data.billingDetails.billingAddress.address2,
                  location: data.billingDetails.billingAddress.location,
                  city: data.billingDetails.billingAddress.city,
                  state: data.billingDetails.billingAddress.state,
                  pincode: data.billingDetails.billingAddress.pincode,
                }
              : null,
          }
        : null,
      deliveryDetails: data.deliveryDetails
        ? {
            deliveryAddress: data.deliveryDetails.deliveryAddress
              ? {
                  id: data.deliveryDetails.deliveryAddress.id,
                  address1: data.deliveryDetails.deliveryAddress.address1,
                  address2: data.deliveryDetails.deliveryAddress.address2,
                  location: data.deliveryDetails.deliveryAddress.location,
                  city: data.deliveryDetails.deliveryAddress.city,
                  state: data.deliveryDetails.deliveryAddress.state,
                  pincode: data.deliveryDetails.deliveryAddress.pincode,
                }
              : null,
            deliveryAddressProofCopy:
              data.deliveryDetails.deliveryAddressProofCopy,
            deliveryTime: data.deliveryDetails.deliveryTime,
            receivingPersonFName: data.deliveryDetails.receivingPersonFName,
            receivingPersonMName: data.deliveryDetails.receivingPersonMName,
            receivingPersonLName: data.deliveryDetails.receivingPersonLName,
            primaryContactNo: data.deliveryDetails.primaryContactNo,
            secondaryContactNo: data.deliveryDetails.secondaryContactNo,
            emailPrimary: data.deliveryDetails.emailPrimary,
            emailSecondary: data.deliveryDetails.emailSecondary,
          }
        : null,

      paymentTerms: data.paymentTerms
        ? {
            id: data.paymentTerms.id,
            paymentMode: data.paymentTerms.paymentMode,
            otherPaymentMode: data.paymentTerms.otherPaymentMode,
            otherPaymentMade: data.paymentTerms.otherPaymentMade,
            paymentMade: data.paymentTerms.paymentMade,
            marginDeposit: data.paymentTerms.marginDeposit,
            rtv: data.paymentTerms.rtv,
            agreementExecuted: data.paymentTerms.agreementExecuted,
            lc: data.paymentTerms.lc,
            bg: data.paymentTerms.bg,
            securityDepoCheqNo: data.paymentTerms.securityDepoCheqNo,
            securityDepoAmt: data.paymentTerms.securityDepoAmt,
            IELinAmt: data.paymentTerms.IELinAmt,
            IELRecommendedBy: data.paymentTerms.IELRecommendedBy,
            IELRecommendedDate: data.paymentTerms.IELRecommendedDate,
            RELinAmt: data.paymentTerms.RELinAmt,
            RELRecommendedBy: data.paymentTerms.RELRecommendedBy,
            RELRecommendedDate: data.paymentTerms.RELRecommendedDate,
            reason: data.paymentTerms.reason,
            docEvidenceCopy: data.paymentTerms.docEvidenceCopy,
          }
        : null,

      officeUseOnly: data.officeUseOnly
        ? {
            id: data.officeUseOnly.id,
            proposerBDName: data.officeUseOnly.proposerBDName,
            pflCoordinator: data.officeUseOnly.pflCoordinator,
            recommendedBy: data.officeUseOnly.recommendedBy,
            dispatchLocationPfl: data.officeUseOnly.dispatchLocationPfl,
            approvedBy: data.officeUseOnly.approvedBy,
            relationshipManager: data.officeUseOnly.relationshipManager,
            avgBillingMonthly: data.officeUseOnly.avgBillingMonthly,
            volumeMonthly: data.officeUseOnly.volumeMonthly,
            customerVerification: data.officeUseOnly.customerVerification,
            verificationAgency: data.officeUseOnly.verificationAgency,
            validityPeriod: data.officeUseOnly.validityPeriod,
            dueDiligenceDone: data.officeUseOnly.dueDiligenceDone,
            creditWorthinessDue: data.officeUseOnly.creditWorthinessDue,
            keyAccountPersonAssigned:
              data.officeUseOnly.keyAccountPersonAssigned,
            sinceWhen: data.officeUseOnly.sinceWhen,
            ledgerCreatedDate: data.officeUseOnly.ledgerCreatedDate,
            ledgerCreatedBy: data.officeUseOnly.ledgerCreatedBy,
            ledgerVerifiedApprovedBy:
              data.officeUseOnly.ledgerVerifiedApprovedBy,
            createdBy: data.officeUseOnly.createdBy,
            additionalNotes: data.officeUseOnly.additionalNotes,
          }
        : null,
      keyMobileNumbers: data.keyMobileNumbers
        ? {
            id: data.keyMobileNumbers.id,
            accDeptFName: data.keyMobileNumbers.accDeptFName,
            accDeptMName: data.keyMobileNumbers.accDeptMName,
            accDeptLName: data.keyMobileNumbers.accDeptLName,
            accDeptMobileNo: data.keyMobileNumbers.accDeptMobileNo,
            ownerFName: data.keyMobileNumbers.ownerFName,
            ownerMName: data.keyMobileNumbers.ownerMName,
            ownerLName: data.keyMobileNumbers.ownerLName,
            ownerMobileNo: data.keyMobileNumbers.ownerMobileNo,
            mandiLicenceNo: data.keyMobileNumbers.mandiLicenceNo,
            mandilicenceCopy: data.keyMobileNumbers.mandiLicenceCopy,
            regiNo: data.keyMobileNumbers.regiNo,
            regiCopy: data.keyMobileNumbers.regiCopy,
            electricityBill: data.keyMobileNumbers.electricityBill,
            electricityBillCopy: data.keyMobileNumbers.electricityBillCopy,
            notElectricityBillReason:
              data.keyMobileNumbers.notElectricityBillReason,
            consumerNo: data.keyMobileNumbers.consumerNo,
            customerBlackListed: data.keyMobileNumbers.customerBlacklisted,
            ifBlacklistedReason: data.keyMobileNumbers.ifBlacklistedReason,
            blackListedBy: data.keyMobileNumbers.blackListedBy,
            visitingCard: data.keyMobileNumbers.visitingCard,
            visitingCardCopy: data.keyMobileNumbers.visitingCardCopy,
            visitingContactNo: data.keyMobileNumbers.visitingContactNo,
            notVisitingCardReason: data.keyMobileNumbers.notVisitingCardReason,

            ref1FName: data.keyMobileNumbers.ref1FName,
            ref1MName: data.keyMobileNumbers.ref1MName,
            ref1LName: data.keyMobileNumbers.ref1LName,
            ref1ContactNo: data.keyMobileNumbers.ref1ContactNo,
            ref1Email: data.keyMobileNumbers.ref1Email,
            ref1Address: data.keyMobileNumbers.ref1Address
              ? {
                  id: data.keyMobileNumbers.ref1Address.id,
                  address1: data.keyMobileNumbers.ref1Address.address1,
                  address2: data.keyMobileNumbers.ref1Address.address2,
                  location: data.keyMobileNumbers.ref1Address.location,
                  city: data.keyMobileNumbers.ref1Address.city,
                  state: data.keyMobileNumbers.ref1Address.state,
                  pincode: data.keyMobileNumbers.ref1Address.pincode,
                }
              : null,
            ref2FName: data.keyMobileNumbers.ref2FName,
            ref2MName: data.keyMobileNumbers.ref2MName,
            ref2LName: data.keyMobileNumbers.ref2LName,
            ref2ContactNo: data.keyMobileNumbers.ref2ContactNo,
            ref2Email: data.keyMobileNumbers.ref2Email,
            ref2Address: data.keyMobileNumbers.ref2Address
              ? {
                  id: data.keyMobileNumbers.ref2Address.id,
                  address1: data.keyMobileNumbers.ref2Address.address1,
                  address2: data.keyMobileNumbers.ref2Address.address2,
                  location: data.keyMobileNumbers.ref2Address.location,
                  city: data.keyMobileNumbers.ref2Address.city,
                  state: data.keyMobileNumbers.ref2Address.state,
                  pincode: data.keyMobileNumbers.ref2Address.pincode,
                }
              : null,
          }
        : null,
      productSpecification: data.productSpecification.map((spec) => ({
        id: spec.id,
        articleName: spec.articleName,
        specifications: spec.specifications,
        packingMaterialSpec: spec.packingMaterialSpec,
        parameters: spec.parameters,

        rejectionCriteria: spec.rejectionCriteria,
        comment: spec.comment,
      })),
    };
    return formatteddata;
  }

  // Method to get a customer by ID
  // async findCustomerfilterById(id: string): Promise<Customer|null> {
  //   return this.customerRepository.findOne({
  //     where: { id },
  //     relations: [

  //       'statutoryDetails',
  //       'billingDetails',
  //       'deliveryDetails',

  //     ],
  //   });
  // }
  // async getcustomerfilterById(id: string): Promise<any> {
  //   const customer = await this.customerRepository
  //     .createQueryBuilder('customer')
  //     .leftJoinAndSelect('customer.billingDetails', 'billingDetails')
  //     .leftJoinAndSelect('customer.deliveryDetails', 'deliveryDetails')
  //     .leftJoinAndSelect('customer.statutoryDetails', 'statutoryDetails')
  //     .select([
  //       'customer.id',
  //       'customer.organisationName',
  //       'billingDetails.billingAddress.id',
  //       'deliveryDetails.deliveryAddress',
  //       'statutoryDetails.gstn',
  //       'statutoryDetails.panNo',
  //     ])
  //     .where('customer.id = :id', { id })
  //     .getRawOne();

  //   if (!customer) {
  //     throw new Error('Customer not found');
  //   }

  //   return customer
  // }
  async getCustomerFilterById(id: string): Promise<any> {
    const customer = await this.customerRepository
      .createQueryBuilder('customer')
      .leftJoinAndSelect('customer.billingDetails', 'billingDetails')
      .leftJoinAndSelect('billingDetails.billingAddress', 'billingAddress')
      .leftJoinAndSelect('customer.deliveryDetails', 'deliveryDetails')
      .leftJoinAndSelect('deliveryDetails.deliveryAddress', 'deliveryAddress')
      .leftJoinAndSelect('customer.statutoryDetails', 'statutoryDetails')
      .select([
        'customer.id AS "id"',
        'customer.organisationName AS "organisationName"',
        'billingDetails.id AS "billingDetailsId"',
        'billingAddress.address1 AS "billingAddressLine1"',
        'billingAddress.address2 AS "billingAddressLine2"',
        'billingAddress.location AS "billingAddressLocation"',
        'billingAddress.city AS "billingAddressCity"',
        'billingAddress.state AS "billingAddressState"',
        'billingAddress.pincode AS "billingAddressPincode"',
        'deliveryAddress.id AS "deliveryAddressID"',
        'deliveryAddress.address1 AS "deliveryAddressLine1"',
        'deliveryAddress.address2 AS "deliveryAddressLine2"',
        'deliveryAddress.location AS "deliveryAddressLocation"',
        'deliveryAddress.city AS "deliveryAddressCity"',
        'deliveryAddress.state AS "deliveryAddressState"',
        'deliveryAddress.pincode AS "deliveryAddressPincode"',
        'statutoryDetails.gstn AS "gstNumber"',
        'statutoryDetails.panNo AS "panNumber"',
      ])
      .where('customer.id = :id', { id })
      .getRawOne();

    if (!customer) {
      throw new Error('Customer not found');
    }

    return {
      customer: {
        id: customer.id,
        organisationName: customer.organisationName,
        billingAddress: {
          id: customer.billingDetailsId,
          address1: customer.billingAddressLine1,
          address2: customer.billingAddressLine2,
          location: customer.billingAddressLocation,
          city: customer.billingAddressCity,
          state: customer.billingAddressState,
          pincode: customer.billingAddressPincode,
        },
        deliveryAddress: {
          id: customer.deliveryAddressID,
          address1: customer.deliveryAddressLine1,
          address2: customer.deliveryAddressLine2,
          location: customer.deliveryAddressLocation,
          city: customer.deliveryAddressCity,
          state: customer.deliveryAddressState,
          pincode: customer.deliveryAddressPincode,
        },
        gstNumber: customer.gstNumber,
        panNumber: customer.panNumber,
      },
    };
  }

  public async updateCustomer(
    id: string,
    updateData: any,
    updatedBy: string,
  ): Promise<Customer | null> {
    console.log('in service', id), console.log('inservice', updateData);
    const customer = await this.customerRepository.findOne({
      where: { id },
      relations: [
        'customerCategory',
        'customerTypes',
        'bankDetails',
        'bankDetails.bankAddress',
        'customerAddress',
        'statutoryDetails',
        'billingDetails',
        'billingDetails.billingAddress',
        'deliveryDetails',
        'deliveryDetails.deliveryAddress',
        'paymentTerms',
        'officeUseOnly',
        'keyMobileNumbers',
        'productSpecification',
      ],
    });

    if (!customer) {
      throw new AppError(404, 'Customer not found');
    }

    const originalCustomer = { ...customer };

    const updatedCustomer = this.customerRepository.merge(customer, {
      ...updateData,
      updatedBy,
    });

    const updatedCustomer1 = await this.customerRepository.save(customer);

    await this.auditLogService.logChange(
      'Customer',
      id,
      originalCustomer,
      updatedCustomer1,
      updatedBy,
    );

    return updatedCustomer;
  }
  public async getCustomersName(): Promise<
    { id: string; organisationName: string }[]
  > {
    const customers = await this.customerRepository.find({
      select: ['id', 'organisationName'],
    });
    return customers.map((customer) => ({
      id: customer.id,
      organisationName: customer.organisationName,
    }));
  }
  //TODO:upload customer excel file
  async upload(filePath: string): Promise<any> {
    const workbook = XLSX.readFile(filePath);
    console.log('Sheet Names:', workbook.SheetNames);

    const sheetName = workbook.SheetNames[0];
    console.log('Sheet Name:', sheetName); // Log the sheet name to verify

    const worksheet = workbook.Sheets[sheetName];
    // Show raw data array
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    console.log('Raw Data:', rawData);

    const data: any = XLSX.utils.sheet_to_json(worksheet);
    console.log('Data from Excel:', data); // Log the data to see its structure

    // Validate the structure of the data
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Invalid or empty Excel data');
    }
    const customerRepo = this.dataSource.getRepository(Customer);
    const categoryRepo = this.dataSource.getRepository(CustomerCategory);
    const typeRepo = this.dataSource.getRepository(CustomerType);

    const savedCustomers = [];

    for (const row of data) {
      console.log('Row keys:', Object.keys(row)); // Add this line
      let category = null;
      if (row.customerCategory) {
        category = await categoryRepo.findOneBy({ name: row.customerCategory });
        if (!category) {
          category = categoryRepo.create({ name: row.customerCategory });
          await categoryRepo.save(category);
        }
      }

      let type = null;
      if (row.customerType) {
        type = await typeRepo.findOneBy({ name: row.customerType });
        if (!type) {
          type = typeRepo.create({ name: row.customerType });
          await typeRepo.save(type);
        }
      }

      let sequenceNumber = await customerRepo.count();
      const customerCode = `CUST${new Date().getFullYear()}${String(
        ++sequenceNumber,
      ).padStart(4, '0')}`;

      const officeUseOnly = OfficeUseOnly.create({
        proposerBDName: row.proposerDBName,
        pflCoordinator: row.pflCoordinator,
        approvedBy: row.approvedBy,
        relationshipManager: row.relationshipManager,
        createdBy: row.createdBy,
      });

      const keyMobileData = keyMobileNoData.create({
        accDeptFName: row.accDeptFName,
        accDeptLName: row.accDeptLName,
        accDeptMobileNo: row.accDeptMobileNo,
        ownerFName: row.ownerFName,
        ownerLName: row.ownerLName,
        ownerMobileNo: row.ownerMobileNo,
      });

      const productSpecification = ProductSpecification.create({
        articleName: row.articleName,
        packingMaterialSpec: row.packingMaterialSpec,
        parameters: row.parameters,
        rejectionCriteria: row.rejectionCriteria,
        comment: row.comment,
        specifications: row.specifications,
      });

      const bankDetails = BankDetailsCust.create({
        accountHolderFName: row.accountHolderFName,
        accountHolderMName: row.accountHolderMName,
        accountHolderLName: row.accountHolderLName,
        bankName: row.bankName,
        bankBranch: row.bankBranch,
        bankAccNo: row.bankAccNo,
        ifscCode: row.ifscCode,
        accType: row.accType,
        otherAccType: row.otherAccType,
        //ifCancelledCheque: row.ifCancelledCheque,
        // notCancelledChequereason: row.notCancelledChequeReason, // <-- property name must match entity
        //cancelledChequeCopy: row.cancelledChequeCopy,
        //bankStatementCopy: row.bankStatementCopy
      });

      const address = Address.create({
        address1: row.address1,
        address2: row.address2,
        location: row.location,
        city: row.city,
        state: row.state,
        pincode: row.pincode,
      });

      const statutoryDetails = StatutoryDetails.create({
        panNo: row.panNo,
        aadharNo: row.aadharNo,
        // panCopy: row.panCopy,
        //aadharCopy: row.aadharCopy,
        gstn: row.gstn,
        //billBookCopy: row.billBookCopy,
        certificationsDetails: row.certificationsDetails,
        otherCertifications: row.otherCertifications,
        corpRegiDetails: row.corpRegiDetails,
        otherCorpRegiDetails: row.otherCorpRegiDetails,
        //incorpoCertificateCopy: row.incorpoCertificateCopy,
        cinNo: row.cinNo,
        //regiCertificateCopy: row.regiCertificateCopy
      });

      const billingDetails = BillingDetailsCust.create({
        billingName: row.billingName,
        contactPersonFName: row.contactPersonFName,
        contactPersonMName: row.contactPersonMName,
        contactPersonLName: row.contactPersonLName,
        commonlyKnownAs: row.commonlyKnownAs,
        primaryContactNo: row.primaryContactNo_billing,
        secondaryContactNo: row.secondaryContactNo_billing,
        emailPrimary: row.emailPrimary_billing,
        emailSecondary: row.emailSecondary_billing,
        //billingFormatCopy: row.billingFormatCopy,
        //billingAddressProofCopy: row.billingAddressProofCopy
      });

      const deliveryDetails = DeliveryDetails.create({
        //deliveryAddressProofCopy: row.deliveryAddressProofCopy,
        deliveryTime: row.deliveryTime,
        receivingPersonFName: row.receivingPersonFName,
        receivingPersonMName: row.receivingPersonMName,
        receivingPersonLName: row.receivingPersonLName,
        primaryContactNo: row.primaryContactNo_delivery,
        secondaryContactNo: row.secondaryContactNo_delivery,
        emailPrimary: row.emailPrimary_delivery,
        emailSecondary: row.emailSecondary_delivery,
      });

      const paymentTerms = PaymentTerms.create({
        paymentMode: row.paymentMode,
        otherPaymentMode: row.otherPaymentMode,
        otherPaymentMade: row.otherPaymentMade,
        paymentMade: row.paymentMade,
        marginDeposit: row.marginDeposit,
        rtv: row.rtv,
        agreementExecuted: row.agreementExecuted,
        lc: row.lc,
        bg: row.bg,
        securityDepoCheqNo: row.securityDepoCheqNo,
        securityDepoAmt: row.securityDepoAmt,
        IELinAmt: row.IELinAmt,
        IELRecommendedBy: row.IELRecommendedBy,
        IELRecommendedDate: row.IELRecommendedDate,
        RELinAmt: row.RELinAmt,
        RELRecommendedBy: row.RELRecommendedBy,
        RELRecommendedDate: row.RELRecommendedDate,
        reason: row.reason,
        // docEvidenceCopy: row.docEvidenceCopy
      });

      const customer = await customerRepo.create({
        organisationName: row.organisationName, // Use the correct property name as defined in Customer entity

        organisationType: row.organisationType,
        otherType: row.otherType,
        customerCategory: category,
        customerTypes: type,
        customerCode: customerCode,
        bankDetailsCust: bankDetails,
        customerAddress: address,
        statutoryDetails: statutoryDetails,
        billingDetails: billingDetails,
        deliveryDetails: deliveryDetails,
        paymentTerms: paymentTerms,
        primaryContactNo: row.primaryContactNo,
        secondaryContactNo: row.secondaryContactNo,
        emailPrimary: row.emailPrimary,
        emailSecondary: row.emailSecondary,
        officeUseOnly: officeUseOnly,
        keyMobileNumbers: keyMobileData,
        productSpecification: productSpecification,
        //deliveryChallan: row.deliveryChallan ? true : false
      });

      await customerRepo.save(customer);
      savedCustomers.push(customer);
    }
    return savedCustomers;
  }
   async approveCustomer(customerId: string, approverId: string,status:Status) {
      console.log('Approver ID:', approverId);
      const approver = await this.userRepository.findOne({
        where: { id: approverId },
       
      });
      if (!approver) throw new Error('Approver not found');
  
      if (!approver.roles || !approver.roles.includes('admin' as Role)) {
        throw new Error('Only admin can approve customers');
      }
  
      const customer = await this.customerRepository.findOne({
        where: { id: customerId },
      });
      if (!customer) throw new Error('customer not found');
  
      customer.status = status;
      return await this.customerRepository.save(customer);
    }
  public async deleteCustomer(id: string): Promise<boolean> {
    const customer = await this.customerRepository.findOne({
      where: { id },
      relations: [
        'customerCategory',
        'customerType',
        'bankDetailsCust',
        'customerAddress',
        'statutoryDetails',
        'billingDetails',
        'deliveryDetails',
        'paymentTerms',
        'officeUseOnly',
        'keyMobileno',
        'productSpecification',
      ],
    });

    if (!customer) {
      throw new AppError(404, 'Customer not found');
    }

    const now = new Date();
    const sixMonthsFromNow = new Date(now);
    sixMonthsFromNow.setMonth(now.getMonth() + 6);
    sixMonthsFromNow.setHours(0, 0, 0, 0);

    console.log(
      `Customer with ID ${id} marked for deletion in 6 months at ${sixMonthsFromNow}`,
    );

    customer.deletionScheduledAt = sixMonthsFromNow;

    await this.customerRepository.save(customer);

    console.log(`Customer with ID ${id} marked for deletion in 6 months.`);
    return true;
  }
}
