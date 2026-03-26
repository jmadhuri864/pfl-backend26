import { inject, injectable } from "inversify";
import { format } from "date-fns"; // Make sure to install the date-fns library
import { Vendor } from "../entities/vendor.entity";
import { VendorRepository } from "../repositories/vendor.repository";
import { TYPES } from "../types";
import AppError from "../utils/appError";
import * as XLSX from "xlsx";
import { UpdateVendor } from "../schemas/vendor.schema";
import { AddressService } from "./address.service";
import { VendorCategoryService } from "./vendorCategory.service";
import { VendorSubcategoryService } from "./vendorSubcategory.service";
import { BankDetailsvendService } from "./vendorBankDetails.service";
import { VendorSaleInfoService } from "./vendorsaleinfo.service";
import { AuditLogService } from "./auditLog.service";
import { AppDataSource } from "../utils/data-source";
import { buildQuery, PaginationOptions } from "../utils/pagination";
import { Address } from "../entities/address.entity";
import { BankDetailsvend } from "../entities/bankDetailsVend.entity";
import { VendorSaleInfo } from "../entities/vendorsaleinfo.entity";
import { VendorCategoryRepository } from "../repositories/vendorCategory.repository";
import { VendorSubcategoryRepository } from "../repositories/vendorSubcategory.repository";
import { VendorCategory } from "../entities/vendorCategory.entity";
import { VendorSubcategory } from "../entities/vendorSubcategory.entity";
import { Product } from "../entities/product.entity";
import { User } from "../entities/user.entity";
import { In } from "typeorm";
import { ProductRepository } from "../repositories/product.repository";
import { UserRepository } from "../repositories/user.repository";
import { Role } from "../entities/user.entity";
import { Status } from "../utils/status.enum";
import { formatDateTime } from "../utils/dateUtils";
import { PackingMaterial } from "../entities/packingMaterial.entity";
import { formatAddress } from "../utils/addressFormate.utils";

@injectable()
export class VendorService {
  constructor(
    @inject(TYPES.VendorRepository)
    private readonly vendorRepository: VendorRepository,
    @inject(TYPES.ProductRepository)
    private readonly productRepository: ProductRepository,
    @inject(TYPES.VendorCategoryRepository)
    private readonly vendorCategoryRepository: VendorCategoryRepository,
    @inject(TYPES.UserRepository) private userRepository: UserRepository,
    @inject(TYPES.VendorSubcategoryRepository)
    private readonly vendorSubcategoryRepository: VendorSubcategoryRepository,

    @inject(TYPES.AddressService)
    private readonly addressService: AddressService,
    @inject(TYPES.VendorCategoryService)
    private readonly vendorCategoryService: VendorCategoryService,
    @inject(TYPES.BankDetailsvendService)
    private readonly vendorBankDetailService: BankDetailsvendService,
    @inject(TYPES.VendorSaleInfoService)
    private readonly vendorSaleInfoService: VendorSaleInfoService,
    @inject(TYPES.VendorSubcategoryService)
    private readonly vendorSubCategoryService: VendorSubcategoryService,
    @inject(TYPES.AuditLogService)
    private readonly auditLogService: AuditLogService
  ) {}
async createVendor(vendorDto: any): Promise<any> {
    // Create the new Vendor entity
    console.log("in the service", vendorDto);

    const user = await this.userRepository.findOneBy({id: vendorDto.createdBy});
    if(user?.roles && user.roles.includes("admin" as Role)){
      vendorDto.status = "approved";
      
    }
    if(vendorDto.listOfAllProducts && Array.isArray(vendorDto.listOfAllProducts)){
      const productIds = vendorDto.listOfAllProducts.map((p: any) => p.id || p);
      console.log("Product IDs to find:", productIds);
      
      const foundProducts = await this.productRepository.findBy({id: In(productIds)});
      console.log("Found products:", foundProducts.length);
      
      vendorDto.listOfAllProducts = foundProducts;
    }

    // Handle mainProduct if provided
    if(vendorDto.mainProduct && typeof vendorDto.mainProduct === 'object' && vendorDto.mainProduct.id) {
      const mainProduct = await this.productRepository.findOneBy({id: vendorDto.mainProduct.id});
      if(mainProduct) {
        vendorDto.mainProduct = mainProduct;
      }
    }
    //vendorDto.officeAddress = JSON.parse(vendorDto.officeAddress);

    let sequenceNumber = await this.vendorRepository.count();
      const vendorCode = `VENDOR${new Date().getFullYear()}${String(++sequenceNumber).padStart(4, '0')}`;

    vendorDto.vendorCode = vendorCode;
    const newVendor = this.vendorRepository.create(vendorDto);
    
    // Save the new Vendor to the database
    console.log("new vendor is", newVendor);
    return await this.vendorRepository.save(newVendor);
  }
async approveVendor(vendorId: string, approverId: string,status:Status) {
const approver = await this.userRepository.findOne({ where: { id: approverId }});
if (!approver) throw new Error("Approver not found");


if (!approver.roles || !approver.roles.includes("admin" as Role)) {
  throw new Error("Only admin can approve vendors");
}


const vendor = await this.vendorRepository.findOne({ where: { id: vendorId } });
if (!vendor) throw new Error("Vendor not found");


vendor.status = status;
return await this.vendorRepository.save(vendor);
}
  
  async getVendorById(id: string): Promise<Vendor | null> {
    const vendor = await this.vendorRepository.findOne({
      where: { id },
      relations: [
        "officeAddress",
        "vendorSaleInfo",
        "vendorBankDetails",
        "vendorBankDetails.branchAddress",
        "ref1Address",
        "ref2Address",
        "subcategory",
        "category",
      ]
      
    });
    if (!vendor) {
      throw new AppError(404, "Vendor not found");
    }
    //return vendor;
    return {
      ...vendor,
      subcategory: vendor.subcategory?.id || null,
      category: vendor.category?.id || null,
  } as any;
  }


//service

async getVendorByIdforview(id: string): Promise<any> {
  const vendor = await this.vendorRepository.findOne({
    where: { id },
    relations: [
      "officeAddress",
      "vendorSaleInfo",
      "vendorBankDetails",
      "vendorBankDetails.branchAddress",
      "ref1Address",
      "ref2Address",
      "subcategory",
      "category",
      "mainProduct",
      "listOfAllProducts",
      "mainPackingMaterial",
      "listOfPackingMaterial",
      "createdBy",
    ],
  });

  if (!vendor) {
    throw new AppError(404, "Vendor not found");
  }

  const formattedResult = {
    id: vendor.id,
    vendorCode: vendor.vendorCode,
    companyName: vendor.companyName,
    classification: vendor.classification,
    status: vendor.status,

    category: vendor.category?.name || null,
    subcategory: vendor.subcategory?.name || null,

    vendorGrade: vendor.vendorGrade,
    paymentMode: vendor.paymentMode,
    creditTerms: vendor.creditTerms,
    proposedPaymentTerms: vendor.proposedPaymentTerms,
    otherProductOrService: vendor.otherProductOrService,

    // 🔹 Date formatting
    dateOfIncorporation: vendor.dateOfIncorporation,
      // ? format(new Date(vendor.dateOfIncorporation), "dd-MM-yyyy")
      // : null,
    inFandVBusinessSince: vendor.inFandVBusinessSince,

    // 🔹 Product relations
    mainProduct: vendor.mainProduct.name || null,
     
    

    // 🔹 Packing material relations
    mainPackingMaterial: vendor.mainPackingMaterial?.packagingMaterialName || null,
     listOfPackingMaterial: vendor.listOfPackingMaterial?.map(p => p.packagingMaterialName),
     
  listOfAllProducts: vendor.listOfAllProducts?.map(p => p.name),



    dispatchCenter: vendor.dispatchCenter,
    warehouseLocations: vendor.warehouseLocations,
    packingCenterLocation: vendor.packingCenterLocation,
    tradeLicenseNumber: vendor.tradeLicenseNumber,
    anyDetailsTeamAndInfra: vendor.anyDetailsTeamAndInfra,

    // --- Office Details ---
    officeAddress: vendor.officeAddress
      ? {
          address1: vendor.officeAddress.address1,
          address2: vendor.officeAddress.address2,
          location: vendor.officeAddress.location,
          city: vendor.officeAddress.city,
          state: vendor.officeAddress.state,
          pincode: vendor.officeAddress.pincode,
        }
      : null,
    officeContactNo: vendor.officeContactNo,
    officeEmail: vendor.officeEmail,
    website: vendor.website,

    // --- Tax and Regulatory Details ---
    gstn: vendor.gstn,
    gstnCopy: vendor.gstnCopy,
    ifGstnCopy: vendor.ifGstnCopy,
    panNo: vendor.panNo,
    panCardCopy: vendor.panCardCopy,
    ifPanCardCopy: vendor.ifPanCardCopy,
    msmeNo: vendor.msmeNo,
    msmeCopy: vendor.msmeCopy,
    ifMsmeCopy: vendor.ifMsmeCopy,

    // --- Contact Person (Vendor Sale Info) ---
    vendorSaleInfo: vendor.vendorSaleInfo
      ? {
          contactFName: vendor.vendorSaleInfo.contactFName,
          contactMName: vendor.vendorSaleInfo.contactMName,
          contactLName: vendor.vendorSaleInfo.contactLName,
          directContactNumber: vendor.vendorSaleInfo.directContactNumber,
          mobileNumber: vendor.vendorSaleInfo.mobileNumber,
          email: vendor.vendorSaleInfo.email,
        }
      : null,

    // --- Bank Details ---
    vendorBankDetails: vendor.vendorBankDetails
      ? {
          beneficiaryFName: vendor.vendorBankDetails.beneficiaryFName,
          beneficiaryMName: vendor.vendorBankDetails.beneficiaryMName,
          beneficiaryLName: vendor.vendorBankDetails.beneficiaryLName,
          bankName: vendor.vendorBankDetails.bankName,
          typeOfAcc: vendor.vendorBankDetails.typeOfAcc,
          ifscCode: vendor.vendorBankDetails.ifscCode,
          swiftNo: vendor.vendorBankDetails.swiftNo,
          invoiceCurrency: vendor.vendorBankDetails.invoiceCurrency,
          cancelledChequeCopy: vendor.vendorBankDetails.cancelledChequeCopy,
          ifCancelledCheque: vendor.vendorBankDetails.ifCancelledCheque,
          branchAddress: vendor.vendorBankDetails.branchAddress
            ? {
                address1: vendor.vendorBankDetails.branchAddress.address1,
                address2: vendor.vendorBankDetails.branchAddress.address2,
                location: vendor.vendorBankDetails.branchAddress.location,
                city: vendor.vendorBankDetails.branchAddress.city,
                state: vendor.vendorBankDetails.branchAddress.state,
                pincode: vendor.vendorBankDetails.branchAddress.pincode,
              }
            : null,
        }
      : null,

    // --- Reference 1 ---
    
      ref1FName: vendor.ref1FName,
      ref1MName: vendor.ref1MName,
      ref1LName: vendor.ref1LName,
     ref1PrimaryCNumb: vendor.ref1PrimaryCNumb,
      ref1AltrCNumb :vendor.ref1AltrCNumb,
      ref1Email: vendor.ref1Email,
      ref1Address: vendor.ref1Address
        ? {
            address1: vendor.ref1Address.address1,
            address2: vendor.ref1Address.address2,
            location: vendor.ref1Address.location,
            city: vendor.ref1Address.city,
            state: vendor.ref1Address.state,
            pincode: vendor.ref1Address.pincode,
          }
        : null,
  

    // --- Reference 2 ---
    
      ref2FName: vendor.ref2FName,
      ref2MName: vendor.ref2MName,
      ref2LName: vendor.ref2LName,
      ref2PrimaryCNumb: vendor.ref2PrimaryCNumb,
      ref2AltrCNumb: vendor.ref2AltrCNumb,
      ref2Email: vendor.ref2Email,
      ref2Address: vendor.ref2Address
        ? {
            address1: vendor.ref2Address.address1,
            address2: vendor.ref2Address.address2,
            location: vendor.ref2Address.location,
            city: vendor.ref2Address.city,
            state: vendor.ref2Address.state,
            pincode: vendor.ref2Address.pincode,
          }
        : null,
  

    createdBy: vendor.createdBy?.firstName+' '+vendor.createdBy?.lastName,
    createdTime:formatDateTime(vendor.createdAt).createdTime,
    createdDate: formatDateTime(vendor.createdAt).createdDate,
      // ? {
      //     id: vendor.createdBy.id,
      //     username: vendor.createdBy.username,
      //     email: vendor.createdBy.email,
      //   }
      // : null,
  };

  return formattedResult;
}
async getVendorByIdforupdate(id: string): Promise<any> {
  const vendor = await this.vendorRepository.findOne({
    where: { id },
    relations: [
      "officeAddress",
      "vendorSaleInfo",
      "vendorBankDetails",
      "vendorBankDetails.branchAddress",
      "ref1Address",
      "ref2Address",
      "subcategory",
      "category",
      "mainProduct",
      "listOfAllProducts",
      "mainPackingMaterial",
      "listOfPackingMaterial",
      "createdBy",
    ],
  });

  if (!vendor) {
    throw new AppError(404, "Vendor not found");
  }

  const formattedResult = {
    id: vendor.id,
    vendorCode: vendor.vendorCode,
    companyName: vendor.companyName,
    classification: vendor.classification,
    status: vendor.status,

    category: vendor.category?.id|| null,
    subcategory: vendor.subcategory?.id || null,

    vendorGrade: vendor.vendorGrade,
    paymentMode: vendor.paymentMode,
    creditTerms: vendor.creditTerms,
    proposedPaymentTerms: vendor.proposedPaymentTerms,
    otherProductOrService: vendor.otherProductOrService,

    // 🔹 Date formatting
    dateOfIncorporation: vendor.dateOfIncorporation,
      // ? format(new Date(vendor.dateOfIncorporation), "dd-MM-yyyy")
      // : null,
    inFandVBusinessSince: vendor.inFandVBusinessSince,

    // 🔹 Product relations
    mainProduct: vendor.mainProduct?.id || null,
     
    listOfAllProducts: vendor.listOfAllProducts?.map(p => p.id) || [],

    // 🔹 Packing material relations
    mainPackingMaterial: vendor.mainPackingMaterial?.id || null,
    listOfPackingMaterial: vendor.listOfPackingMaterial?.map(p => p.id) || [],
    
   

    dispatchCenter: vendor.dispatchCenter,
    warehouseLocations: vendor.warehouseLocations,
    packingCenterLocation: vendor.packingCenterLocation,
    tradeLicenseNumber: vendor.tradeLicenseNumber,
    anyDetailsTeamAndInfra: vendor.anyDetailsTeamAndInfra,

    // --- Office Details ---
    officeAddress: vendor.officeAddress
      ? {
          address1: vendor.officeAddress.address1,
          address2: vendor.officeAddress.address2,
          location: vendor.officeAddress.location,
          city: vendor.officeAddress.city,
          state: vendor.officeAddress.state,
          pincode: vendor.officeAddress.pincode,
        }
      : null,
    officeContactNo: vendor.officeContactNo,
    officeEmail: vendor.officeEmail,
    website: vendor.website,

    // --- Tax and Regulatory Details ---
    gstn: vendor.gstn,
    gstnCopy: vendor.gstnCopy,
    ifGstnCopy: vendor.ifGstnCopy,
    panNo: vendor.panNo,
    panCardCopy: vendor.panCardCopy,
    ifPanCardCopy: vendor.ifPanCardCopy,
    msmeNo: vendor.msmeNo,
    msmeCopy: vendor.msmeCopy,
    ifMsmeCopy: vendor.ifMsmeCopy,

    // --- Contact Person (Vendor Sale Info) ---
    vendorSaleInfo: vendor.vendorSaleInfo
      ? {
          contactFName: vendor.vendorSaleInfo.contactFName,
          contactMName: vendor.vendorSaleInfo.contactMName,
          contactLName: vendor.vendorSaleInfo.contactLName,
          directContactNumber: vendor.vendorSaleInfo.directContactNumber,
          mobileNumber: vendor.vendorSaleInfo.mobileNumber,
          email: vendor.vendorSaleInfo.email,
        }
      : null,

    // --- Bank Details ---
    vendorBankDetails: vendor.vendorBankDetails
      ? {
          beneficiaryFName: vendor.vendorBankDetails.beneficiaryFName,
          beneficiaryMName: vendor.vendorBankDetails.beneficiaryMName,
          beneficiaryLName: vendor.vendorBankDetails.beneficiaryLName,
          bankName: vendor.vendorBankDetails.bankName,
          typeOfAcc: vendor.vendorBankDetails.typeOfAcc,
          ifscCode: vendor.vendorBankDetails.ifscCode,
          swiftNo: vendor.vendorBankDetails.swiftNo,
          invoiceCurrency: vendor.vendorBankDetails.invoiceCurrency,
          cancelledChequeCopy: vendor.vendorBankDetails.cancelledChequeCopy,
          ifCancelledCheque: vendor.vendorBankDetails.ifCancelledCheque,
          branchAddress: vendor.vendorBankDetails.branchAddress
            ? {
                address1: vendor.vendorBankDetails.branchAddress.address1,
                address2: vendor.vendorBankDetails.branchAddress.address2,
                location: vendor.vendorBankDetails.branchAddress.location,
                city: vendor.vendorBankDetails.branchAddress.city,
                state: vendor.vendorBankDetails.branchAddress.state,
                pincode: vendor.vendorBankDetails.branchAddress.pincode,
              }
            : null,
        }
      : null,

    // --- Reference 1 ---
    
      ref1FName: vendor.ref1FName,
      ref1MName: vendor.ref1MName,
      ref1LName: vendor.ref1LName,
     ref1PrimaryCNumb: vendor.ref1PrimaryCNumb,
      ref1AltrCNumb :vendor.ref1AltrCNumb,
      ref1Email: vendor.ref1Email,
      ref1Address: vendor.ref1Address
        ? {
            address1: vendor.ref1Address.address1,
            address2: vendor.ref1Address.address2,
            location: vendor.ref1Address.location,
            city: vendor.ref1Address.city,
            state: vendor.ref1Address.state,
            pincode: vendor.ref1Address.pincode,
          }
        : null,
  

    // --- Reference 2 ---
    
      ref2FName: vendor.ref2FName,
      ref2MName: vendor.ref2MName,
      ref2LName: vendor.ref2LName,
      ref2PrimaryCNumb: vendor.ref2PrimaryCNumb,
      ref2AltrCNumb: vendor.ref2AltrCNumb,
      ref2Email: vendor.ref2Email,
      ref2Address: vendor.ref2Address
        ? {
            address1: vendor.ref2Address.address1,
            address2: vendor.ref2Address.address2,
            location: vendor.ref2Address.location,
            city: vendor.ref2Address.city,
            state: vendor.ref2Address.state,
            pincode: vendor.ref2Address.pincode,
          }
        : null,
  

    createdBy: vendor.createdBy?.id,
    createdTime:formatDateTime(vendor.createdAt).createdTime,
    createdDate: formatDateTime(vendor.createdAt).createdDate,
      // ? {
      //     id: vendor.createdBy.id,
      //     username: vendor.createdBy.username,
      //     email: vendor.createdBy.email,
      //   }
      // : null,
  };

  return formattedResult;
}
async createVendorWithExcel(fileUrl: string): Promise<any> {
  try {
    console.log("in create vendor with Excel, fileUrl:", fileUrl);
    
    // First, download the file from DigitalOcean Spaces
    let fileBuffer: Buffer;
    
    if (fileUrl.startsWith('https://')) {
      // Extract the key from the URL
      const urlParts = fileUrl.split('/');
      const key = urlParts.slice(-2).join('/'); // Gets "single/filename"
      console.log('Downloading file from Spaces with key:', key);
      
      // Download file from Spaces
      fileBuffer = await this.getExcelFromSpaces(key);
    } else {
      // If it's already a local path or key, try to get it from Spaces
      fileBuffer = await this.getExcelFromSpaces(fileUrl);
    }
    
    // Read the Excel file from buffer instead of file path
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetNames = workbook.SheetNames;
    console.log("Sheet names found:", sheetNames);

    // const vendorRepository = AppDataSource.getRepository(Vendor);

    for (const sheetName of sheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      console.log("Processing sheet:", sheetName);

      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

      if (jsonData.length < 2) {
        console.warn("Sheet does not have enough rows:", sheetName);
        continue;
      }

      const headers: string[] = (jsonData[0] as any[]).map((h: any) =>
        h ? String(h).trim() : `UNKNOWN`
      );
      console.log("Headers found:", headers);

      const dataRows = jsonData.slice(1); // Skip header row

      for (const rowUntyped of dataRows) {
        if (!Array.isArray(rowUntyped) || rowUntyped.length === 0) continue;

        const rowData: Record<string, any> = {};
        headers.forEach((header, index) => {
          rowData[header] = rowUntyped[index];
        });

        console.log("Mapped Row:", rowData);

        if (!rowData["Company Name"] || !rowData["Vendor Category"]) {
          console.warn("Skipping incomplete row:", rowData);
          continue;
        }


        //Checking category and subcategory
        let categoryEntity: any = null;
        let subCategoryEntity: any = null;
        
        const categoryName = rowData["Vendor Category"];
        console.log("Category name:", categoryName);
        
        const subCategoryName = rowData["Vendor Subcategory"];
        const isCategoryPresent = await this.vendorCategoryRepository.findOne({
          where: { name: categoryName },
        });
        
        if (!isCategoryPresent) {
          const createNewCategory = this.vendorCategoryRepository.create({
            name: rowData["Vendor Category"],
          });
          const saveCategory = await this.vendorCategoryRepository.save(createNewCategory);
          console.log("Created new category:", createNewCategory);
          categoryEntity = saveCategory;

          const createSubCategory = await this.vendorSubcategoryRepository.create({
            name: rowData["Vendor Subcategory"],
            category: saveCategory,
          });
          const saveSubCategory = await this.vendorSubcategoryRepository.save(createSubCategory);
          subCategoryEntity = saveSubCategory;

        } else {
          categoryEntity = isCategoryPresent;
          console.log("Existing category:", categoryEntity.name);
          
          const isSubCategoryPresent = await this.vendorSubcategoryRepository.findOne({
            where: { name: subCategoryName, category: { id: categoryEntity.id } },
          });

          if (!isSubCategoryPresent) {
            const createSubCategory = await this.vendorSubcategoryRepository.create({
              name: rowData["Vendor Subcategory"],
              category: categoryEntity,
            });
            const saveSubCategory = await this.vendorSubcategoryRepository.save(createSubCategory);
            subCategoryEntity = saveSubCategory;
          } else {
            subCategoryEntity = isSubCategoryPresent;
            console.log("Existing subcategory:", subCategoryEntity.name);
          }
        }



      let sequenceNumber = await this.vendorRepository.count();
      const vendorCode = `VENDOR${new Date().getFullYear()}${String(++sequenceNumber).padStart(4, '0')}`;

        // --- Vendor Base ---
        const vendor = new Vendor();
        vendor.companyName = rowData["Company Name"];
        vendor.vendorCode = vendorCode;
        vendor.category = categoryEntity; // Assign the actual entity object
        vendor.subcategory = subCategoryEntity; // Assign the actual entity object
        vendor.inFandVBusinessSince = rowData["In FandV Business Since"];
        if (rowData["Date Of Incorporation"])
          vendor.dateOfIncorporation = new Date(rowData["Date Of Incorporation"]);
        
        // Handle Main Product lookup
        if (rowData["Main Product"]) {
          console.log(`Looking up main product: ${rowData["Main Product"]}`);
          const mainProductName = rowData["Main Product"].trim();
          const mainProduct = await this.productRepository
            .createQueryBuilder('product')
            .where('LOWER(product.name) = LOWER(:name)', { name: mainProductName })
            .getOne();
          
          if (mainProduct) {
            vendor.mainProduct = mainProduct;
            console.log(`✅ Found main product: ${mainProduct.name} (ID: ${mainProduct.id})`);
          } else {
            console.warn(`⚠️  Main product not found: ${mainProductName}`);
            // Continue without setting mainProduct - it's nullable
          }
        }
        
        // Handle List of All Products (comma-separated string)
        if (rowData["List Of All Products"]) {
          console.log(`Looking up products list: ${rowData["List Of All Products"]}`);
          const productNames = rowData["List Of All Products"].split(',').map((name: string) => name.trim());
          const products = [];
          
          for (const productName of productNames) {
            if (productName) {
              const product = await this.productRepository
                .createQueryBuilder('product')
                .where('LOWER(product.name) = LOWER(:name)', { name: productName })
                .getOne();
              
              if (product) {
                products.push(product);
                console.log(`✅ Found product: ${product.name} (ID: ${product.id})`);
              } else {
                console.warn(`⚠️  Product not found in list: ${productName}`);
              }
            }
          }
          
          vendor.listOfAllProducts = products;
        }
        
        // Handle createdBy field if provided in Excel
        if (rowData['Created By']) {
          console.log(`Looking up user for createdBy: ${rowData['Created By']}`);
          
          // Find user by name (case-insensitive search)
          const createdByName = rowData['Created By'].trim();
          const user = await this.userRepository
            .createQueryBuilder('user')
            .where('LOWER(CONCAT(user.firstName, \' \', user.lastName)) = LOWER(:name)', { name: createdByName })
            .getOne();
          
          if (user) {
            vendor.createdBy = user;
            console.log(`✅ Found user: ${user.firstName} ${user.lastName} (ID: ${user.id})`);
          } else {
            console.warn(`⚠️  User not found for createdBy: ${createdByName}`);
            // Continue without setting createdBy - it's nullable
          }
        }
        
        vendor.dispatchCenter = rowData["Dispatch Center"];
        vendor.warehouseLocations = rowData["Ware House Locations"];
        vendor.gstn = rowData["GSTN"];
        vendor.gstnCopy = rowData["GSTN_Copy"];
        vendor.ifGstnCopy = rowData["If_GSTN_Copy"];
        vendor.panNo = rowData["Pan_No"];
        vendor.panCardCopy = rowData["Pan_Card_Copy"];
        vendor.ifPanCardCopy = rowData["If_Pan_Card_Copy"];
        vendor.msmeNo = rowData["MSME_No"];
        vendor.msmeCopy = rowData["MSME_Copy"];
        vendor.ifMsmeCopy = rowData["If_MSME_Copy"];
        vendor.tradeLicenseNumber = rowData["Trade_License_Number"];
        vendor.proposedPaymentTerms = rowData["Proposed_Payment_Terms"];
        vendor.creditTerms = rowData["Credit Terms"];
        vendor.anyDetailsTeamAndInfra = rowData["Any Other Details Regarding Team And Infrastructure"];

        // --- Office Address ---
        const officeAddress = new Address();
        officeAddress.address1 = rowData["Office Address1"];
        officeAddress.address2 = rowData["Office Address2"];
        officeAddress.location = rowData["Office Location"];
        officeAddress.city = rowData["Office City"];
        officeAddress.state = rowData["Office State"];
        officeAddress.pincode = rowData["Office Pincode"];
        vendor.officeAddress = officeAddress;

        vendor.officeContactNo = rowData["Office Contact No"];
        vendor.officeEmail = rowData["Office Email"];
        vendor.website = rowData["Website"];

        // --- Contact Person ---
        const contact = new VendorSaleInfo();
        contact.contactFName = rowData["Contact First Name"];
        contact.contactMName = rowData["Contact Mddele Name"];
        contact.contactLName = rowData["Contact Last Name"];
        contact.directContactNumber = rowData["Direct Contact Number"];
        contact.mobileNumber = rowData["Mobile Number"];
        contact.email = rowData["Email"];
        vendor.vendorSaleInfo = contact;

        // --- Bank Details with Branch Address ---
        const bank = new BankDetailsvend();
        bank.beneficiaryFName = rowData["Beneficiary First Name"];
        bank.beneficiaryMName = rowData["Beneficiary Middle Name"];
        bank.beneficiaryLName = rowData["Beneficiary Last Name"];
        bank.bankName = rowData["Bank Name"];
        bank.typeOfAcc = rowData["Type Of Acc"];
        bank.ifscCode = rowData["Ifsc Code"];
        bank.swiftNo = rowData["Swift No"];
        bank.invoiceCurrency = rowData["Invoice Currency"];
        bank.cancelledChequeCopy = rowData["Cancelled Cheque Copy"];
        bank.ifCancelledCheque = rowData["If Cancelled Cheque"];

        const branchAddress = new Address();
        branchAddress.address1 = rowData["Branch Address1"];
        branchAddress.address2 = rowData["Branch Address2"];
        branchAddress.location = rowData["Branch Location"];
        branchAddress.city = rowData["Branch City"];
        branchAddress.state = rowData["Branch State"];
        branchAddress.pincode = rowData["Branch Pincode"];
        bank.branchAddress = branchAddress;

        vendor.vendorBankDetails = bank;

        // --- Reference 1 ---
       // const ref1 = new Reference();
        vendor.ref1FName = rowData["Ref1_First_Name"];
        vendor.ref1MName = rowData["Ref1_Middle_Name"];
        vendor.ref1LName = rowData["Ref1_Last_Name"];
        vendor.ref1PrimaryCNumb = rowData["Ref1_Primary_Contact_Number"];
        vendor.ref1AltrCNumb = rowData["Ref1_Alternative_Contact_Number"];
       // vendor.email = rowData["Ref1_Email"];

        const ref1Address = new Address();
        ref1Address.address1 = rowData["Ref1_Address1"];
        ref1Address.address2 = rowData["Ref1_Address2"];
        ref1Address.location = rowData["Ref1_Location"];
        ref1Address.city = rowData["Ref1_City"];
        ref1Address.state = rowData["Ref1_State"];
        ref1Address.pincode = rowData["Ref1_Pincode"];
        vendor.ref1Address = ref1Address;

        // --- Reference 2 ---
    //    const ref2 = new Reference();
        vendor.ref2FName = rowData["Ref2_First_Name"];
        vendor.ref2MName = rowData["Ref2_Middle_Name"];
        vendor.ref2LName = rowData["Ref2_Last_Name"];
        vendor.ref2PrimaryCNumb = rowData["Ref2_Primary_Contact_Number"];
        vendor.ref2AltrCNumb = rowData["Ref2_Alternative_Contact_Number"];
       // vendor.email = rowData["Ref2_Email"];

        const ref2Address = new Address();
        ref2Address.address1 = rowData["Ref2_Address1"];
        ref2Address.address2 = rowData["Ref2_Address2"];
        ref2Address.location = rowData["Ref2_Location"];
        ref2Address.city = rowData["Ref2_City"];
        ref2Address.state = rowData["Ref2_State"];
        ref2Address.pincode = rowData["Ref2_Pincode"];
        vendor.ref2Address = ref2Address;

      //  vendor.references = [ref1, ref2];

        console.log("Saving vendor:", vendor.companyName);
        const result = await this.vendorRepository.save(vendor);
        console.log("Saved vendor with ID:", result.id);
      }
    }

    // 🗑️ Delete the file from DigitalOcean Spaces after successful processing
    await this.deleteFileFromSpaces(fileUrl);
    
  } catch (error) {
    console.error('Error processing vendor upload:', error);
    
    // 🗑️ Still attempt to delete the file even if processing failed
    try {
      await this.deleteFileFromSpaces(fileUrl);
    } catch (deleteError) {
      console.error('Error deleting file after failed processing:', deleteError);
    }
    
    throw error;
  }
}

  /**
   * Get Excel file from DigitalOcean Spaces
   * @param key - Spaces key/path to the Excel file
   * @returns Buffer containing the file data
   */
  private async getExcelFromSpaces(key: string): Promise<Buffer> {
    try {
      console.log('📂 Reading Excel file from Spaces:', key);

      const { GetObjectCommand } = await import('@aws-sdk/client-s3');
      const { s3 } = await import('../middleware/spaces.config');
      const command = new GetObjectCommand({
        Bucket: process.env.DO_SPACES_BUCKET!,
        Key: key,
      });

      const response = await s3.send(command);

      if (!response.Body) {
        throw new Error('No file content found in Spaces response');
      }

      const bytes = await response.Body.transformToByteArray();
      const fileBuffer = Buffer.from(bytes);

      console.log('✅ Excel file read successfully, size:', fileBuffer.length, 'bytes');
      return fileBuffer;
    } catch (error) {
      console.error('❌ Error reading Excel file from Spaces:', error);
      throw new Error(`Failed to read Excel file: ${key}`);
    }
  }

  /**
   * Delete file from DigitalOcean Spaces
   * @param fileUrl - The full URL or key of the file to delete
   */
  private async deleteFileFromSpaces(fileUrl: string): Promise<void> {
    try {
      // Extract the key from the full URL
      // URL format: https://bucket-name.sgp1.digitaloceanspaces.com/documents/filename
      const urlParts = fileUrl.split('/');
      const key = urlParts.slice(-2).join('/'); // Gets "documents/filename"
      
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
      const { s3 } = await import('../middleware/spaces.config');
      const deleteCommand = new DeleteObjectCommand({
        Bucket: process.env.DO_SPACES_BUCKET!,
        Key: key,
      });

      await s3.send(deleteCommand);
      console.log(`Successfully deleted file: ${key}`);
    } catch (error) {
      console.error(`Failed to delete file from spaces: ${fileUrl}`, error);
      // Don't throw error here to avoid breaking the main flow
    }
  }

  /**
   * Get available vendor categories for reference when uploading vendor data
   */
  async getAvailableVendorCategories(): Promise<{ id: string; name: string }[]> {
    const categories = await this.vendorCategoryRepository
      .createQueryBuilder('category')
      .select(['category.id', 'category.name'])
      .orderBy('category.name', 'ASC')
      .getMany();
    
    return categories.map(category => ({
      id: category.id,
      name: category.name
    }));
  }

  /**
   * Get available vendor subcategories for reference when uploading vendor data
   */
  async getAvailableVendorSubcategories(categoryId?: string): Promise<{ id: string; name: string; categoryName: string }[]> {
    const queryBuilder = this.vendorSubcategoryRepository
      .createQueryBuilder('subcategory')
      .leftJoinAndSelect('subcategory.category', 'category')
      .select(['subcategory.id', 'subcategory.name', 'category.name'])
      .orderBy('category.name', 'ASC')
      .addOrderBy('subcategory.name', 'ASC');
    
    if (categoryId) {
      queryBuilder.where('category.id = :categoryId', { categoryId });
    }
    
    const subcategories = await queryBuilder.getMany();
    
    return subcategories.map(subcategory => ({
      id: subcategory.id,
      name: subcategory.name,
      categoryName: subcategory.category?.name || 'Unknown'
    }));
  }

  /**
   * Get available products for reference when uploading vendor data
   */
  async getAvailableProducts(): Promise<{ id: string; name: string }[]> {
    const products = await this.productRepository
      .createQueryBuilder('product')
      .select(['product.id', 'product.name'])
      .orderBy('product.name', 'ASC')
      .getMany();
    
    return products.map(product => ({
      id: product.id,
      name: product.name
    }));
  }

  /**
   * Get available users for reference when uploading vendor data
   */
  async getAvailableUsers(): Promise<{ id: string; name: string }[]> {
    const users = await this.userRepository
      .createQueryBuilder('user')
      .select(['user.id', 'user.firstName', 'user.lastName'])
      .orderBy('user.firstName', 'ASC')
      .getMany();
    
    return users.map(user => ({
      id: user.id,
      name: `${user.firstName} ${user.lastName}`
    }));
  }


//  public async getAllVendors1(queryOptions: PaginationOptions): Promise<any> {
//   const queryBuilder = this.vendorRepository
//     .createQueryBuilder('vendor')
//     .leftJoinAndSelect('vendor.createdBy', 'createdBy') // ✅ include who created
//     .leftJoinAndSelect('vendor.officeAddress', 'officeAddress')
//     .leftJoinAndSelect('vendor.vendorSaleInfo', 'vendorSaleInfo')
//     .leftJoinAndSelect('vendor.vendorBankDetails', 'vendorBankDetails')
//     .leftJoinAndSelect('vendor.ref1Address', 'ref1Address')
//     .leftJoinAndSelect('vendor.ref2Address', 'ref2Address')
//     .leftJoinAndSelect('vendor.subcategory', 'subcategory')
//     .leftJoinAndSelect('vendor.category', 'category')
//     .orderBy('vendor.createdAt', 'DESC');

//   const vendors = await buildQuery(queryBuilder, queryOptions, 'vendor');

  
//   const formattedData = vendors.data.map((vendor: any) => {
//     const { createdDate, createdTime } = formatDateTime(vendor.createdAt);

//     return {
//       ...vendor,
//       createdBy: `${vendor.createdBy?.firstName ?? ''} ${vendor.createdBy?.lastName ?? ''}`.trim(),
        
//       createdDate,
//       createdTime,
//       //createdAt: createdDate && createdTime ? `${createdDate} ${createdTime}` : null,
//     };
//   });

//   return {
//     ...vendors,
//     data: formattedData,
//   };
// }

public async getAllVendors1(queryOptions: PaginationOptions): Promise<any> {
  const queryBuilder = this.vendorRepository
    .createQueryBuilder('vendor')
    .leftJoinAndSelect('vendor.createdBy', 'createdBy') // ✅ include who created
    .leftJoinAndSelect('vendor.officeAddress', 'officeAddress')
    .leftJoinAndSelect('vendor.vendorSaleInfo', 'vendorSaleInfo')
    //.leftJoinAndSelect('vendor.vendorBankDetails', 'vendorBankDetails')
   // .leftJoinAndSelect('vendor.ref1Address', 'ref1Address')
    //.leftJoinAndSelect('vendor.ref2Address', 'ref2Address')
    .leftJoinAndSelect('vendor.mainProduct','product')
    .leftJoinAndSelect('vendor.listOfAllProducts','listOfAllProducts')
    // .leftJoinAndSelect('vendor.mainPackingMaterial','mainPackingMaterial')
    // .leftJoinAndSelect('vendor.listOfPackingMaterial','listOfPackingMaterial')
    .leftJoinAndSelect('vendor.subcategory', 'subcategory')
    .leftJoinAndSelect('vendor.category', 'category')
    .orderBy('vendor.createdAt', 'DESC');

  const vendors = await buildQuery(queryBuilder, queryOptions, 'vendor');

  
  const formattedData = vendors.data.map((vendor) => {
    const { createdDate, createdTime } = formatDateTime(vendor.createdAt);

    return {
      //...vendor,
      createdBy: `${vendor.createdBy?.firstName ?? ''} ${vendor.createdBy?.lastName ?? ''}`.trim(),
      id:vendor.id,
      status:vendor.status,
      vendorCode:`${vendor.vendorCode}`.toUpperCase(),
      companyName:vendor.companyName,
      category:{
        id:vendor.category.id,
        name:vendor.category.name},
      subcategory:{
        id:vendor.subcategory.id,
        name:vendor.subcategory.name},
      officeAddress:{
        id:vendor.officeAddress.id,
        address:vendor.officeAddress? formatAddress(vendor.officeAddress) : ''},
      officeContactNo:vendor.officeContactNo,
      listOfAllProducts:vendor.listOfAllProducts? vendor.listOfAllProducts
                        .map((product:Product)=>product?.name)
                        .join(','):'',
      mainProduct:vendor.mainProduct?.name || '', 
      dispatchCenter:vendor.dispatchCenter,
      wareHouseLocation:vendor.warehouseLocations,
      packingCenterLocation:vendor.packingCenterLocation,
      createdDate,
      createdTime,
     // classification:vendor.classification,
      //officeEmail:vendor.officeEmail,
      //gstn:`${vendor.gstn}`.toUpperCase(),
      // panNo:`${vendor.panNo}`.toUpperCase() ,
      // msmeNo:`${vendor.msmeNo}`.toUpperCase(),
      // tradeLicenseNumber:`${vendor.tradeLicenseNumber}`.toUpperCase(),
      // paymentMode:vendor.paymentMode,
      // proposedPaymentTerms:vendor.proposedPaymentTerms,
      //creditTerms:vendor.creditTerms,
      // listOfAllPackingMaterials:vendor.listOfPackingMaterial? vendor.listOfPackingMaterial
      //                            .map((material:PackingMaterial)=>material?.packagingMaterialName)
      //                            .join(',') : '',
      // mainPackingMaterial:vendor.mainPackingMaterial?.packagingMaterialName || '',
      // vendorSalesInfo:{
      //   contactFName:vendor.vendorSaleInfo.contactFName ,
      //   contactMName:vendor.vendorSaleInfo.contactMName ,
      //   contactLName:vendor.vendorSaleInfo.contactLName ,
      //   directContactNumber:vendor.vendorSaleInfo.directContactNumber ,
      //   mobileNumber:vendor.vendorSaleInfo.mobileNumber,
      //   email:vendor.vendorSaleInfo.email
      // }, 
    };
  });

  return {
    ...vendors,
    data: formattedData,
  };
}


  
  public async getAllVendor(subcategoryId?: string): Promise<any> {
    const queryBuilder = this.vendorRepository
      .createQueryBuilder("vendor")
      .leftJoinAndSelect("vendor.officeAddress", "officeAddress")
      .leftJoinAndSelect("vendor.vendorSaleInfo", "vendorSaleInfo")

      .leftJoinAndSelect("vendor.category", "category") // Fixed extra space
      .leftJoin("vendor.subcategory", "subcategory")
      .select([
        "vendor.id",
        "vendor.companyName",
        "vendor.officeContactNo",
        "vendor.email",
        "category.id",
        "subcategory.id",
        "vendor.vendorCode",
        "officeAddress.id",
        "officeAddress.address1",
        "officeAddress.address2",
        "officeAddress.location",
        "officeAddress.city",
        "officeAddress.state",
        "officeAddress.pincode",
        "vendorSaleInfo.contactFName",
        "vendorSaleInfo.contactMName",
        "vendorSaleInfo.contactLName",
      ]);

    // Add the filter condition if subcategoryId is provided
    if (subcategoryId) {
      queryBuilder.where("subcategory.id = :subcategoryId", { subcategoryId });
    }

    // Fetch data from the database
    const vendors = await queryBuilder.getMany();

    // Map the results to the desired format
    return vendors.map((vendor) => ({
      id: vendor.id,
      companyName: vendor.companyName,
      vendorCode: vendor.vendorCode,
      officeContactNo: vendor.officeContactNo,
      email: vendor.officeEmail,
      subcategory: vendor.subcategory?.id || null,
      category: vendor.category?.id || null,
      contactPersonName: vendor.vendorSaleInfo
        ? `${vendor.vendorSaleInfo.contactFName || ""} ${
            vendor.vendorSaleInfo.contactMName || ""
          } ${vendor.vendorSaleInfo.contactLName || ""}`.trim()
        : null,
      officeAddress: vendor.officeAddress
        ? {
            address1: vendor.officeAddress.address1,
            address2: vendor.officeAddress.address2,
            location: vendor.officeAddress.location,
            city: vendor.officeAddress.city,
            state: vendor.officeAddress.state,
            pincode: vendor.officeAddress.pincode,
          }
        : null,
    }));
  }
  public async getvendorwithid(id?: string): Promise<any> {
    const queryBuilder = this.vendorRepository
      .createQueryBuilder("vendor")
      .leftJoinAndSelect("vendor.officeAddress", "officeAddress")
      .leftJoinAndSelect("vendor.vendorSaleInfo", "vendorSaleInfo")
      .leftJoinAndSelect("vendor.category", "category")
      .leftJoinAndSelect("vendor.subcategory", "subcategory")
      .select([
        "vendor.id",
        "vendor.companyName",
        "vendor.officeContactNo",
        "vendor.email",
        "vendor.vendorCode",
        "officeAddress.id",
        "officeAddress.address1",
        "officeAddress.address2",
        "officeAddress.location",
        "officeAddress.city",
        "officeAddress.state",
        "officeAddress.pincode",
        "vendorSaleInfo.contactFName",
        "vendorSaleInfo.contactMName",
        "vendorSaleInfo.contactLName",
        "category.id",
        "subcategory.id",
      ]);

    // Add the filter condition if id is provided
    if (id) {
      queryBuilder.where("vendor.id = :id", { id });
    }

    // Fetch the data from the database
    const vendor = await queryBuilder.getOne();

    if (!vendor) {
      return null; // Handle case where no vendor is found
    }

    // Map the result to the desired format
    return {
      id: vendor.id,
      companyName: vendor.companyName,
      officeContactNo: vendor.officeContactNo,
      email: vendor.officeEmail,
      vendorCode: vendor.vendorCode,
      officeAddress: vendor.officeAddress
        ? {
            id: vendor.officeAddress.id,
            address1: vendor.officeAddress.address1,
            address2: vendor.officeAddress.address2,
            location: vendor.officeAddress.location,
            city: vendor.officeAddress.city,
            state: vendor.officeAddress.state,
            pincode: vendor.officeAddress.pincode,
          }
        : null,
      contactPersonName: vendor.vendorSaleInfo
        ? `${vendor.vendorSaleInfo.contactFName || ""} ${
            vendor.vendorSaleInfo.contactMName || ""
          } ${vendor.vendorSaleInfo.contactLName || ""}`.trim()
        : null,
      category: vendor.category?.id || null,
      subcategory: vendor.subcategory?.id || null,
    };
  }

  async getVendorByVendorCode(vendorCode: string): Promise<Vendor | null> {
    const vendor = await this.vendorRepository.findOne({
      where: { vendorCode },
      relations: [
        "officeAddress",
        "vendorSaleInfo",
        "vendorBankDetails",
        "ref1Address",
        "ref2Address",
        "subcategory",
        "category",
      ],
    });

    if (!vendor) {
      throw new AppError(404, "Vendor not found");
    }

    return vendor;
  }

  async getVendorByVendorName(companyName: string): Promise<Vendor | null> {
    const vendor = await this.vendorRepository.findOne({
      where: { companyName },
      relations: [
        "officeAddress",
        "vendorSaleInfo",
        "vendorBankDetails",
        "ref1Address",
        "ref2Address",
        "subcategory",
        "category",
      ],
    });
    if (!vendor) {
      throw new AppError(404, "Vendor not found");
    }

    return vendor;
  }

  async getAllVendors(): Promise<Vendor[]> {
    return await this.vendorRepository.find({
      relations: ["officeAddress", "vendorSaleInfo"],
      order: {
        createdAt: "DESC", // Assuming createdAt is a timestamp field
      },
    });
  }

  // async createVendor(vendorDto: any): Promise<any> {
  //   // Create the new Vendor entity
  //   console.log("in the service", vendorDto);
  //   //vendorDto.officeAddress = JSON.parse(vendorDto.officeAddress);
  //   const newVendor = this.vendorRepository.create(vendorDto);
  //   // Save the new Vendor to the database
  //   console.log("new vendor is", newVendor);
  //   return await this.vendorRepository.save(newVendor);
  // }

  // async updateVendor(
  //   id: string,
  //   vendorData: UpdateVendor,
  //   updatedBy: string
  // ): Promise<Vendor | null> {
  //   // Step 1: Retrieve the existing vendor to capture the original data
  //   const vendor = await this.vendorRepository.findOne({
  //     where: { id },
  //     relations: [
  //       "officeAddress",
  //       "vendorSaleInfo",
  //       "vendorBankDetails",
  //       "ref1Address",
  //       "ref2Address",
  //       "subcategory",
  //       "category",
  //     ],
  //   });

  //   if (!vendor) {
  //     throw new AppError(404, "Vendor not found");
  //   }

  //   // Step 2: Capture the original vendor data for audit purposes
  //   const originalVendor = { ...vendor };

  //   // Step 3: Update the address if provided
  //   if (vendorData.address) {
  //     if (vendor.officeAddress) {
  //       // Update existing address
  //       const updatedAddress = await this.addressService.update(
  //         vendor.officeAddress.id,
  //         vendorData.address
  //       );
  //       console.log("updated address is ", updatedAddress);
  //     }
  //   }

  //   // Step 4: Update vendor fields
  //   Object.assign(vendor, vendorData);

  //   // Step 5: Save the updated vendor
  //   const updatedVendor = await this.vendorRepository.save(vendor);

  //   // Step 6: Log the change using the audit log service
  //   await this.auditLogService.logChange(
  //     "Vendor", // Entity name
  //     id, // Entity ID
  //     originalVendor, // Original data (before update)
  //     updatedVendor, // Updated data (after update)
  //     updatedBy // User who made the update
  //   );

  //   // Step 7: Return the updated vendor
  //   return updatedVendor;
  // }


  public async updateVendor(
    id: string,
    vendorData: Partial<Vendor>,
    updateBy: string
  ): Promise<Vendor | null> {
    const vendor = await this.vendorRepository.findOne({
      where: { id },
      relations: [
        "officeAddress",
        "ref1Address",
        "ref2Address",
        "vendorSaleInfo",
        "vendorBankDetails",
        "mainProduct",
        "listOfAllProducts",
        "subcategory",
        "category",
      ],
    });

    if (!vendor) return null;

    // ---- Addresses ----
    if (vendorData.officeAddress) {
      vendor.officeAddress = {
        ...vendor.officeAddress,
        ...vendorData.officeAddress,
      } as Address;
    }

    if (vendorData.ref1Address) {
      vendor.ref1Address = {
        ...vendor.ref1Address,
        ...vendorData.ref1Address,
      } as Address;
    }

    if (vendorData.ref2Address) {
      vendor.ref2Address = {
        ...vendor.ref2Address,
        ...vendorData.ref2Address,
      } as Address;
    }

    // ---- Sale Info ----
    if (vendorData.vendorSaleInfo) {
      vendor.vendorSaleInfo = {
        ...vendor.vendorSaleInfo,
        ...vendorData.vendorSaleInfo,
      } as VendorSaleInfo;
    }

    // ---- Bank Details ----
    if (vendorData.vendorBankDetails) {
      vendor.vendorBankDetails = {
        ...vendor.vendorBankDetails,
        ...vendorData.vendorBankDetails,
      } as BankDetailsvend;
    }

    // ---- Main Product ----
    if (vendorData.mainProduct?.id) {
      const foundProduct = await this.productRepository.findOneBy({
        id: vendorData.mainProduct.id,
      });
      if (foundProduct) {
        vendor.mainProduct = foundProduct;
      }
    }

    // ---- List of All Products ----
    if (vendorData.listOfAllProducts?.length) {
      const productIds = vendorData.listOfAllProducts.map((p: any) => p.id);
      vendor.listOfAllProducts = await this.productRepository.findBy({
        id: In(productIds),
      });
    }

    // ---- Simple fields ----
    Object.assign(vendor, vendorData);

    // Save everything
    return await this.vendorRepository.save(vendor);
  }


  async deleteVendor(id: string): Promise<boolean> {
    // Step 1: Find the vendor by ID
    const vendor = await this.vendorRepository.findOne({ where: { id } });

    // Step 2: If the vendor doesn't exist, return false
    if (!vendor) {
      throw new AppError(404, "Vendor not found");
    }

    // Step 3: Calculate the date 6 months ahead
    const now = new Date();
    const sixMonthsFromNow = new Date(now);
    sixMonthsFromNow.setMonth(now.getMonth() + 6); // Adds 6 months to the current date
    sixMonthsFromNow.setHours(0, 0, 0, 0); // Optionally, set the time to midnight (00:00:00)

    // Log the scheduled deletion
    console.log(
      `Vendor with ID ${id} marked for deletion in 6 months at ${sixMonthsFromNow}`
    );

    // Step 4: Set the deletionScheduledAt field for the vendor
    vendor.deletionScheduledAt = sixMonthsFromNow;

    // Step 5: Save the updated vendor with the scheduled deletion date
    await this.vendorRepository.save(vendor);

    // Step 6: Return true to indicate the deletion was scheduled
    console.log(`Vendor with ID ${id} marked for deletion in 6 months.`);
    return true;
  }

  // async getAllVendorsbyfilter(): Promise<any[]> {
  //   const vendors = await this.vendorRepository
  //     .createQueryBuilder("vendor")
  //     .leftJoinAndSelect("vendor.vendorSaleInfo", "vendorSaleInfo") // Fixed alias
  //     .leftJoinAndSelect("vendor.officeAddress", "officeAddress") // Fixed alias
  //     .leftJoinAndSelect("vendor.category", "category") // Fixed alias
  //     .leftJoinAndSelect("vendor.subcategory", "subcategory") // Fixed alias
  //     .select([
  //       "vendor.id",
  //       "vendor.companyName",
  //       "vendor.vendorCode",
  //       "vendor.officeContactNo",
  //       "vendor.officeEmail",
  //       "category.name",
  //       "subcategory.name",
  //       "vendorSaleInfo.contactFName",
  //       "vendorSaleInfo.contactMName",
  //       "vendorSaleInfo.contactLName",
  //       "officeAddress.id", // Ensure this alias matches the join
  //       "officeAddress.address1",
  //       "officeAddress.address2",
  //       "officeAddress.location",
  //       "officeAddress.city",
  //       "officeAddress.state",
  //       "officeAddress.pincode",
  //     ])
  //     .getMany();

  //   return vendors.map((vendor) => ({
  //     id: vendor.id,
  //     companyName: vendor.companyName,
  //     vendorCode: vendor.vendorCode,
  //     officeContactNo: vendor.officeContactNo,
  //     officeEmail: vendor.officeEmail,
  //     contactPersonName: vendor.vendorSaleInfo
  //       ? `${vendor.vendorSaleInfo.contactFName || ""} ${
  //           vendor.vendorSaleInfo.contactMName || ""
  //         } ${vendor.vendorSaleInfo.contactLName || ""}`.trim()
  //       : null,
  //     officeAddress: vendor.officeAddress,
  //     category: vendor.category || null,
  //     subcategory: vendor.subcategory?.name || null,
  //   }));
  // }


  async getAllVendorsbyfilter(queryOptions: PaginationOptions): Promise<any> {
  const queryBuilder = this.vendorRepository
    .createQueryBuilder("vendor")
    .leftJoinAndSelect("vendor.vendorSaleInfo", "vendorSaleInfo")
    .leftJoinAndSelect("vendor.officeAddress", "officeAddress")
    .leftJoinAndSelect("vendor.category", "category")
    .leftJoinAndSelect("vendor.subcategory", "subcategory")
    .select([
      "vendor.id",
      "vendor.companyName",
      "vendor.vendorCode",
      "vendor.officeContactNo",
      "vendor.officeEmail",
      "category.name",
      "subcategory.name",
      "vendorSaleInfo.contactFName",
      "vendorSaleInfo.contactMName",
      "vendorSaleInfo.contactLName",
      "officeAddress.id",
      "officeAddress.address1",
      "officeAddress.address2",
      "officeAddress.location",
      "officeAddress.city",
      "officeAddress.state",
      "officeAddress.pincode",
    ]);

  // Use your reusable buildQuery function
  const result = await buildQuery(queryBuilder, queryOptions, "vendor");

  // Map final result with custom formatting
  const transformed = result.data.map((vendor: any) => ({
    id: vendor.id,
    companyName: vendor.companyName,
    vendorCode: vendor.vendorCode,
    officeContactNo: vendor.officeContactNo,
    officeEmail: vendor.officeEmail,
    contactPersonName: vendor.vendorSaleInfo
      ? `${vendor.vendorSaleInfo.contactFName || ""} ${vendor.vendorSaleInfo.contactMName || ""} ${vendor.vendorSaleInfo.contactLName || ""}`.trim()
      : null,
    officeAddress: vendor.officeAddress,
    category: vendor.category || null,
    subcategory: vendor.subcategory?.name || null,
  }));

  return {
    data: transformed,
    meta: result.meta, // includes total, page, totalPages
  };
}


  async getVendorByIdWithFilter(id: string): Promise<any> {
    const vendor = await this.vendorRepository
      .createQueryBuilder("vendor")
      .leftJoinAndSelect("vendor.vendorSaleInfo", "vendorSaleInfo")
      .leftJoinAndSelect("vendor.officeAddress", "officeAddress")
      .leftJoinAndSelect("vendor.category", "category")
      .leftJoinAndSelect("vendor.subcategory", "subcategory")
      .select([
        "vendor.id",
        "vendor.companyName",
        "vendor.vendorCode",
        "vendor.officeContactNo",
        "vendor.officeEmail",
        "category.name",
        "subcategory.name",
        "vendorSaleInfo.contactFName",
        "vendorSaleInfo.contactMName",
        "vendorSaleInfo.contactLName",
        "officeAddress.id",
        "officeAddress.address1",
        "officeAddress.address2",
        "officeAddress.location",
        "officeAddress.city",
        "officeAddress.state",
        "officeAddress.pincode",
      ])
      .where("vendor.id = :id", { id })
      .getOne();

    // If vendor is null, return null
    if (!vendor) {
        return null;
    }

    return {
      id: vendor.id,
      companyName: vendor.companyName,
      vendorCode: vendor.vendorCode,
      officeContactNo: vendor.officeContactNo,
      officeEmail: vendor.officeEmail,
      contactPersonName: vendor.vendorSaleInfo
        ? `${vendor.vendorSaleInfo.contactFName || ""} ${
            vendor.vendorSaleInfo.contactMName || ""
          } ${vendor.vendorSaleInfo.contactLName || ""}`.trim()
        : null,
      officeAddress: vendor.officeAddress,
      category: vendor.category?.name || null,
      subcategory: vendor.subcategory?.name || null,
    };
}




  async getAllVendorsbyquery(filter: string): Promise<any[]> {
    const query = this.vendorRepository
      .createQueryBuilder("vendor")
      .leftJoinAndSelect("vendor.vendorSaleInfo", "vendorSaleInfo")
      .leftJoinAndSelect("vendor.officeAddress", "officeAddress")
      .leftJoinAndSelect("vendor.category", "category")
      .leftJoinAndSelect("vendor.subcategory", "subcategory")
      .select([
        "vendor.id",
        "vendor.companyName",
        "vendor.vendorCode",
        "vendor.officeContactNo",
        "vendor.officeEmail",
        "category.name",
        "subcategory.name",
        "vendorSaleInfo.contactFName",
        "vendorSaleInfo.contactMName",
        "vendorSaleInfo.contactLName",
        "officeAddress.id",
        "officeAddress.address1",
        "officeAddress.address2",
        "officeAddress.location",
        "officeAddress.city",
        "officeAddress.state",
        "officeAddress.pincode",
      ]);
  
    // Apply filtering only if 'filter' is provided
    if (filter) {
      query.where("vendor.companyName ILIKE :filter", { filter: `%${filter}%` });
    }
  
    const vendors = await query.getMany();
  
    return vendors.map((vendor) => ({
      id: vendor.id,
      companyName: vendor.companyName,
      vendorCode: vendor.vendorCode,
      officeContactNo: vendor.officeContactNo,
      officeEmail: vendor.officeEmail,
      contactPersonName: vendor.vendorSaleInfo
        ? `${vendor.vendorSaleInfo.contactFName || ""} ${
            vendor.vendorSaleInfo.contactMName || ""
          } ${vendor.vendorSaleInfo.contactLName || ""}`.trim()
        : null,
      officeAddress: vendor.officeAddress,
      category: vendor.category?.name || null,
      subcategory: vendor.subcategory?.name || null,
    }));
  }
  async filterVendors(filters: any) {
  const {
    classification,
    categoryId,
    subcategoryId,
    pincode,
    city,
    state,
    productId,
    page,
    limit,
  } = filters;

  const query = this.vendorRepository
    .createQueryBuilder('vendor')
    .leftJoinAndSelect('vendor.category', 'category')
    .leftJoinAndSelect('vendor.subcategory', 'subcategory')
    .leftJoinAndSelect('vendor.officeAddress', 'officeAddress')
    .leftJoinAndSelect('vendor.mainProduct', 'mainProduct')
    .leftJoinAndSelect('vendor.listOfAllProducts', 'listOfAllProducts')
    .where('1=1');

  // ✅ Apply filters dynamically
  if (classification) query.andWhere('vendor.classification = :classification', { classification });
  if (categoryId) query.andWhere('category.id = :categoryId', { categoryId });
  if (subcategoryId) query.andWhere('subcategory.id = :subcategoryId', { subcategoryId });
  if (pincode) query.andWhere('officeAddress.pincode ILIKE :pincode', { pincode: `%${pincode}%` });
  if (city) query.andWhere('officeAddress.city ILIKE :city', { city: `%${city}%` });
  if (state) query.andWhere('officeAddress.state ILIKE :state', { state: `%${state}%` });
  if (productId) {
    query.andWhere('(mainProduct.id = :productId OR listOfAllProducts.id = :productId)', { productId });
  }

  query.orderBy('vendor.createdAt', 'DESC');

  // ✅ If pagination params are provided
  if (page && limit) {
    const skip = (page - 1) * limit;
    const [vendors, total] = await query.skip(skip).take(limit).getManyAndCount();

    return {
      data: vendors,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  
}

async softDeleteVendors(vendorIds: string[]) {
  const result = await this.vendorRepository.softDelete({
    id: In(vendorIds)
  });
  return result;
}



}

