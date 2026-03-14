import { inject, injectable } from 'inversify';
import { TYPES } from '../types';
import { CustomerDeliveryChallanRepository } from '../repositories/customerDeliveryChallan.repository';
import { IDeliveryChallanReportFilters } from '../interfaces/deliveryChallan-report.interface';
import { DocumentbService } from './documentb.service';
import { CompanyRepository } from '../repositories/company.repository';
import { In } from 'typeorm';
import { BranchessRepository } from '../repositories/branches.repository';
import { CustomerRepository } from '../repositories/customer.repository';
import { UserRepository } from '../repositories/user.repository';
import { ProductRepository } from '../repositories/product.repository';
import * as ExcelJS from 'exceljs';
import { GrnRepository } from '../repositories/grn.repository';

@injectable()
export class DeliveryChallanReportService {
  constructor(
    @inject(TYPES.CustomerDeliveryChallanRepository) 
    private readonly challanRepository: CustomerDeliveryChallanRepository,
        @inject(TYPES.DocumentbService) 
    private readonly documentbService: DocumentbService,
      @inject(TYPES.CompanyRepository) 
    private readonly companyRepository: CompanyRepository,
      @inject(TYPES.BranchessRepository) 
    private readonly branchesRepository: BranchessRepository,
     @inject(TYPES.CustomerRepository) 
    private readonly customerRepo: CustomerRepository,
     @inject(TYPES.UserRepository) 
    private readonly userRepository: UserRepository,
     @inject(TYPES.ProductRepository) 
    private readonly productRepository: ProductRepository,
    @inject(TYPES.GrnRepository) 
    private readonly grnRepository: GrnRepository,


     
    
    

  ) {}

  
async generateDeliveryChallanReport(filter: any): Promise<Buffer> {
    /*
      ==========================
      1) BUILD QUERY WITH FILTERS
      ==========================
    */

let companyNames = 'All';
let locationNames = 'All';
let customerNames = 'All';
let createdByNames = 'All';
let productNames = 'All';
let grnNos='All';

    const qb = this.challanRepository
      .createQueryBuilder('dc')
      .leftJoinAndSelect('dc.customerName', 'customer')
      .leftJoinAndSelect('dc.companyName', 'company')
      .leftJoinAndSelect('dc.fromLocation', 'branch')
      .leftJoinAndSelect('dc.grnNo', 'grn')
      .leftJoinAndSelect('dc.createdBy', 'createdBy')
      .leftJoinAndSelect('dc.deliveryChallanProducts', 'item')
        .leftJoinAndSelect('item.productName', 'itemProduct')
        .leftJoinAndSelect('item.variant', 'itemVariant')
        .leftJoinAndSelect('item.saleUoM', 'itemSaleUoM')
        

    // Date filters
    if (filter.startDate && filter.endDate) {
      qb.andWhere('dc.createdAt BETWEEN :start AND :end', {
        start: filter.startDate,
        end: filter.endDate,
      });
    }


    // Referred GRN
    if (filter.referredGrn) {

      const ids = Array.isArray(filter.referredGrn)
        ? filter.company
        : String(filter.company).split(',');
      qb.andWhere('grn.id IN (:...grn)', { grn: ids });
     // qb.andWhere('grn.id = :grnId', { grnId: filter.referredGrn });

     const grns = await this.grnRepository.findBy({
        id: In(ids),
      });
      grnNos = grns.map((g) => g.grnNo).join(', ');

    }
if (filter.minQuantity && filter.maxQuantity) {

  qb.andWhere(
    'item.quantity BETWEEN :minQty AND :maxQty',
    {
      minQty: filter.minQuantity,
      maxQty: filter.maxQuantity
    }
  );

} else if (filter.minQuantity) {

  qb.andWhere(
    'item.quantity >= :minQty',
    { minQty: filter.minQuantity }
  );

} else if (filter.maxQuantity) {

  qb.andWhere(
    'item.quantity <= :maxQty',
    { maxQty: filter.maxQuantity }
  );

}




if (filter.minTotalAmount && filter.maxTotalAmount) {

  qb.andWhere(
    'dc.totalProductAmount BETWEEN :minAmt AND :maxAmt',
    {
      minAmt: filter.minTotalAmount,
      maxAmt: filter.maxTotalAmount
    }
  );

} else if (filter.minTotalAmount) {

  qb.andWhere(
    'dc.totalProductAmount >= :minAmt',
    { minAmt: filter.minTotalAmount }
  );

} else if (filter.maxTotalAmount) {

  qb.andWhere(
    'dc.totalProductAmount <= :maxAmt',
    { maxAmt: filter.maxTotalAmount }
  );

}
    // Company
    if (filter.company) {
      //we send multiple company name

      //qb.andWhere('company.id = :companyId', { companyId: filter.company });
      const ids = Array.isArray(filter.company)?filter.company
        : String(filter.company).split(',');

        console.log("Company IDs for filter: ", ids);
      qb.andWhere('company.id IN (:...comp)', { comp: ids });

      //after getting the company names we will prepare the display value for filter summary
        const companies = await this.companyRepository.findBy({
          id: In(ids)
        });
        companyNames = companies.map(c => c.name).join(', ');

    }

    // Deliver From Location
    if (filter.deliverFromLocation) {

      const ids = Array.isArray(filter.deliverFromLocation) ? filter.deliverFromLocation
        : String(filter.deliverFromLocation).split(',');

      qb.andWhere('branch.id IN (:...branch)', { branch: ids });

      //after getting the location names we will prepare the display value for filter summary
     const locations = await this.branchesRepository.findBy({
        id: In(ids)
      });
      locationNames = locations.map(l => l.name).join(', ');

    }

    // PO Number
    if (filter.poNumber) {
      const poNo = String(filter.poNumber).trim();
      qb.andWhere('dc.poNumber ILIKE :po', { po: `%${poNo}%` });
    }

    // Customers
    if (filter.customers) {
      const ids = Array.isArray(filter.customers)
        ? filter.customers
        : String(filter.customers).split(',');
      qb.andWhere('customer.id IN (:...cust)', { cust: ids });

      //after getting the customer names we will prepare the display value for filter summary
      const customers = await this.customerRepo.findBy({
        id: In(ids)
      });
      customerNames = customers.map(c => c.organisationName).join(', ');

    }

    // Created By
    if (filter.createdBy) {
      qb.andWhere('createdBy.id = :createdBy', {
        createdBy: filter.createdBy,
      });

      //after getting the user names we will prepare the display value for filter summary
      const users = await this.userRepository.findBy({
        id: In(Array.isArray(filter.createdBy) ? filter.createdBy : String(filter.createdBy).split(','))
      });
      createdByNames = users.map(u => u.firstName + ' ' + u.lastName).join(', ');
    }

    // Product
    if (filter.product) {
      const ids = Array.isArray(filter.product)
        ? filter.product
        : String(filter.product).split(',');
      qb.andWhere('item.product_id IN (:...p)', { p: ids });

      //after getting the product names we will prepare the display value for filter summary
      const products = await this.productRepository.findBy({
        id: In(ids)
      });
      productNames = products.map(p => p.name).join(', ');

    }

    // Total Quantity (>=)
    if (filter.totalQuantity) {
      qb.andWhere('item.quantity >= :qty', { qty: filter.totalQuantity });
    }

    // Total Amount (>=)
    if (filter.totalAmount) {
      qb.andWhere('dc.totalProductAmount >= :amt', { amt: filter.totalAmount });
    }

    // have multiple Driver Name 
    if (filter.driverName) {
      const diverName = Array.isArray(filter.driverName) ? filter.driverName : String(filter.driverName).split(',');
      qb.andWhere('dc.driverName IN (:...driver)', { driver: diverName });
    }

    //have multiple Driver License Number
    if (filter.driverLicenseNumber) {
      const licenseNumbers = Array.isArray(filter.driverLicenseNumber) ? filter.driverLicenseNumber : String(filter.driverLicenseNumber).split(',');
      qb.andWhere('dc.licenseNo IN (:...lic)', { lic: licenseNumbers });
    }

    //have multiple Vehicle Number
    if (filter.vehicleNumber) {
      const vehicleNumbers = Array.isArray(filter.vehicleNumber) ? filter.vehicleNumber : String(filter.vehicleNumber).split(',');
      qb.andWhere('dc.vehicleNo IN (:...veh)', { veh: vehicleNumbers });
    }
    

    //have multiple Receiver Name
    if (filter.receiverName) {
      const receiverNames = Array.isArray(filter.receiverName) ? filter.receiverName : String(filter.receiverName).split(',');
      qb.andWhere('dc.receiverName IN (:...rec)', { rec: receiverNames });
    }

    //have multiple Status
    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : String(filter.status).split(',');
      qb.andWhere('dc.approvalStatus IN (:...status)', { status: statuses });
    }

    const challans = await qb.getMany();

    // Fetch Documentb for each challan by document_type_id (which is challan.id)
    // and cache results to avoid duplicate DB calls if needed
    const documentbMap: Record<string, any> = {};
    for (const dc of challans) {
      try {
        const documentb = await this.documentbService.getDocumentByTypeId(dc.id);
        if (documentb) {
          documentbMap[dc.id] = documentb;
        }
      } catch (e) {
        // Optionally log error
      }
    }

    /*
      ==========================
      2) CALCULATE SUMMARY
      ==========================
    */

    const totalDeliveryChallans = challans.length;
    let totalQuantity = 0;
    let totalProcurementAmount = 0;

    for (const dc of challans) {
      totalProcurementAmount += Number(dc.totalProductAmount || 0);

      if (dc.deliveryChallanProducts?.length) {
        for (const item of dc.deliveryChallanProducts) {
          totalQuantity += Number(item.quantity || 0);
        }
      }
    }




    /*
      ==========================
      3) CREATE EXCEL
      ==========================
    */

    const workbook = new ExcelJS.Workbook();

/*
---- Sheet 1 : Report_Summary ----
*/

const summarySheet = workbook.addWorksheet("Report_Summary");

summarySheet.columns = [
  { width: 30 },
  { width: 40 }
];

/*
TITLE
*/

summarySheet.mergeCells("A1:B1");

const titleCell = summarySheet.getCell("A1");

titleCell.value = "Delivery Challan Detailed Report";

titleCell.font = {
  bold: true,
  size: 14,
  color: { argb: "FFFFFFFF" }
};

titleCell.alignment = {
  horizontal: "center",
  vertical: "middle"
};

titleCell.fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF00B050" }
};


/*
COMMON ROW STYLING
*/

const styleRow = (row: ExcelJS.Row) => {

  row.eachCell((cell, colNumber) => {

    if (colNumber === 1) {
      cell.font = { bold: true };   // ONLY bold
    }

    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };

    cell.alignment = {
      wrapText: true,
      vertical: "middle"
    };

  });

};


/*
REPORT DETAILS
*/

summarySheet.addRow([]);

const reportDetails = [
  ["Company Name:", companyNames || "All"],
  ["Reporting Period:", `${filter.startDate || ""} to ${filter.endDate || ""}`],
  ["Generated By:", challans[0]?.createdBy?.firstName || "System"],
  ["Generated Date:", new Date().toLocaleDateString()]
];

reportDetails.forEach((r) => {
  const row = summarySheet.addRow(r);
  styleRow(row);
});

summarySheet.addRow([]);


/*
APPLIED FILTERS HEADER
*/

const filterHeader = summarySheet.addRow(["Applied Filters"]);

summarySheet.mergeCells(`A${filterHeader.number}:B${filterHeader.number}`);

filterHeader.font = { bold: true };

filterHeader.eachCell((cell) => {

  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD9E1F2" }
  };

  cell.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" }
  };

});


/*
FILTER VALUES
*/

const filters = [

  ["Start Date", filter.startDate || "All"],
  ["End Date", filter.endDate || "All"],
  ["Period", filter.period || "All"],
  ["Referred GRN", filter.grnNos || "All"],
  ["Company", companyNames || "All"],
  ["Deliver From Location", locationNames || "All"],
  ["PO Number", filter.poNumber || "All"],
  ["Customers", customerNames || "All"],
  ["Created By", createdByNames || "All"],
  ["Product", productNames || "All"],
  ["Total Quantity", filter.totalQuantity || "All"],
  ["Total Amount", filter.totalAmount || "All"],
  ["Driver Name", filter.driverName || "All"],
  ["Driver's License Number", filter.driverLicenseNumber || "All"],
  ["Vehicle Number", filter.vehicleNumber || "All"],
  ["Receiver Name", filter.receiverName || "All"],
  ["RM Name", filter.rmName || "All"],
  ["Approved By", filter.approvedBy || "All"],
  ["Status", filter.status || "All"],
  [
  "Total Quantity",
  filter.minQuantity && filter.maxQuantity
    ? `${filter.minQuantity} - ${filter.maxQuantity}`
    : filter.minQuantity
    ? `>= ${filter.minQuantity}`
    : filter.maxQuantity
    ? `<= ${filter.maxQuantity}`
    : "All"
],
[
  "Total Amount",
  filter.minTotalAmount && filter.maxTotalAmount
    ? `${filter.minTotalAmount} - ${filter.maxTotalAmount}`
    : filter.minTotalAmount
    ? `>= ${filter.minTotalAmount}`
    : filter.maxTotalAmount
    ? `<= ${filter.maxTotalAmount}`
    : "All"
],


];

filters.forEach((f) => {
  const row = summarySheet.addRow(f);
  styleRow(row);
});

summarySheet.addRow([]);


/*
SUMMARY HEADER
*/

const summaryHeader = summarySheet.addRow(["Summary"]);

summarySheet.mergeCells(`A${summaryHeader.number}:B${summaryHeader.number}`);

summaryHeader.font = { bold: true };

summaryHeader.eachCell((cell) => {

  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD9E1F2" }
  };

  cell.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" }
  };

});


/*
SUMMARY VALUES
*/

const summaryRows = [
  ["Total Delivery Challans", totalDeliveryChallans],
  ["Total Quantity (KG)", totalQuantity],
  ["Total Procurement Amount (INR)", totalProcurementAmount]
];

summaryRows.forEach((s) => {
  const row = summarySheet.addRow(s);
  styleRow(row);
});


/*
---- Sheet 2 : Report_Data ----
*/

const dataSheet = workbook.addWorksheet("Report_Data");

dataSheet.columns = [
  { header: "Date", key: "date", width: 12 },
  { header: "Status", key: "status", width: 12 },
  { header: "Created By", key: "createdBy", width: 18 },
  { header: "PO Number", key: "poNumber", width: 15 },
  { header: "Customer Name", key: "customerName", width: 20 },
  { header: "Company Name", key: "companyName", width: 20 },
  { header: "Deliver From Location", key: "location", width: 22 },
  { header: "Referred GRN", key: "grn", width: 18 },
  { header: "Product Name", key: "productName", width: 20 },
  { header: "Variant Name", key: "variant", width: 25 },
  { header: "Sales UoM", key: "salesUom", width: 12 },
  { header: "Qty", key: "qty", width: 10 },
  { header: "Unit Price", key: "unitPrice", width: 12 },
  { header: "Amount", key: "amount", width: 15 },
  { header: "Packing Material", key: "packingMaterial", width: 20 },
  { header: "Material UoM", key: "materialUom", width: 15 },
  { header: "Material Qty", key: "materialQty", width: 15 },
  { header: "Material Weight Per Item", key: "materialWeightPerItem", width: 20 },
  { header: "Material Weight", key: "materialWeight", width: 18 },
  { header: "Material Unit Price", key: "materialUnitPrice", width: 18 },
  { header: "Material Amount", key: "materialAmount", width: 18 },
  { header: "Gross Weight", key: "grossWeight", width: 15 },
  { header: "Net Weight", key: "netWeight", width: 15 },
  { header: "Total Packing", key: "totalPacking", width: 15 },
  { header: "Total Packing Amount", key: "totalPackingAmount", width: 20 },
  { header: "Total Net Product", key: "totalNetProduct", width: 18 },
  { header: "Total Product", key: "totalProduct", width: 18 },
  { header: "Driver Name", key: "driverName", width: 18 },
  { header: "License No", key: "licenseNo", width: 18 },
  { header: "Contact No", key: "contactNo", width: 18 },
  { header: "Vehicle No", key: "vehicleNo", width: 15 },
  { header: "Receiver Name", key: "receiverName", width: 18 },
  { header: "RM Name", key: "rmName", width: 18 },
  { header: "Approved By", key: "approvedBy", width: 18 }
];

/*
HEADER STYLE
*/

const headerRow = dataSheet.getRow(1);

headerRow.eachCell((cell) => {
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFDE21" }
  };

  cell.font = { bold: true, size: 11 };

  cell.alignment = {
    horizontal: "center",
    vertical: "middle"
  };

  cell.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" }
  };
});

headerRow.height = 20;


/*
STATUS MAPPING (VALUE → LABEL + COLOR)
*/

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  hold: { label: "Hold", color: "FFFF5700" },
  VERIFIED: { label: "Verified", color: "FF6A00FF" },
  approved: { label: "Approved", color: "FF40BF40" },
  FINALIZING: { label: "Finalized", color: "FF0063B1" },
  COMPLETE: { label: "Complete", color: "FF006600" },
  reject: { label: "Reject", color: "FFAF0606" }
};


/*
ADD DATA ROWS (GROUPED BY CHALLAN)
*/

for (const dc of challans) {

  if (!dc.deliveryChallanProducts?.length) continue;

  const challanStartRow = dataSheet.rowCount + 1;

  const documentb = documentbMap[dc.id];

  const statusValue = documentb?.status || '';

  const statusInfo =
    STATUS_MAP[statusValue] || { label: statusValue, color: "FFE7E6E6" };

  const approvedBy = documentb?.lastActionBy?.firstName
    ? documentb.lastActionBy.firstName +
      (documentb.lastActionBy.lastName
        ? " " + documentb.lastActionBy.lastName
        : "")
    : "";

  for (const item of dc.deliveryChallanProducts) {

    const row = dataSheet.addRow({

      date: dc.createdAt?.toISOString().split("T")[0],

      status: statusInfo.label,

      createdBy: dc.createdBy?.firstName,
      poNumber: dc.poNumber,
      customerName: dc.customerName?.organisationName,
      companyName: dc.companyName?.name,
      location: dc.fromLocation?.name,
      grn: dc.grnNo?.grnNo,

      productName: item.productName?.name,
      variant: item.variant?.variantName,
      salesUom: item.saleUoM?.unit,
      qty: item.quantity,
      unitPrice: item.unitPrice,
      amount: item.amount,

      packingMaterial: item.packagingMaterial?.packagingMaterialName,
      materialUom: item.packagingMaterialUoM?.unit,
      materialQty: item.packagingMaterialQuantity,
      materialWeightPerItem:
        item.packagingMaterialTotalWeight /
        item.packagingMaterialQuantity,
      materialWeight: item.packagingMaterialTotalWeight,
      materialUnitPrice: item.packagingMaterialUnitPrice,
      materialAmount: item.packagingMaterialAmount,

      grossWeight: item.grossWeight,
      netWeight: item.netWeight,

      totalPacking: dc.netPackagingMaterialWeight,
      totalPackingAmount: dc.totalPackagingMaterialAmount,
      totalNetProduct: dc.netProductWeight,
      totalProduct: dc.totalProductAmount,

      driverName: dc.driverName,
      licenseNo: dc.licenseNo,
      contactNo: dc.contactNo,
      vehicleNo: dc.vehicleNo,
      receiverName: dc.receiverName,
      rmName: dc.createdBy?.firstName,
      approvedBy: approvedBy
    });

    /*
    STATUS COLOR STYLE
    */

    const statusCell = row.getCell(2);

    statusCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: statusInfo.color }
    };

    statusCell.font = {
      bold: true,
      color: { argb: "FFFFFFFF" }
    };

    statusCell.alignment = {
    //  horizontal: "center",
      vertical: "middle"
    };
  }

  const challanEndRow = dataSheet.rowCount;

  /*
  MERGE CHALLAN LEVEL COLUMNS
  */

  if (challanEndRow > challanStartRow) {

    const columnsToMerge = [
      1,2,3,4,5,6,7,8,
      24,25,26,27,28,29,30,31,32,33,34
    ];

    columnsToMerge.forEach((col) => {

      dataSheet.mergeCells(challanStartRow, col, challanEndRow, col);

      const cell = dataSheet.getRow(challanStartRow).getCell(col);

      cell.alignment = {
       // horizontal: "center",
        vertical: "middle",
        wrapText: true
      };
    });
  }
}

this.autoAdjustColumnWidth(dataSheet);

    const buffer = await workbook.xlsx.writeBuffer();

    return buffer as unknown as Buffer;
  }


autoAdjustColumnWidth(sheet: ExcelJS.Worksheet) {
  sheet.columns?.forEach((column) => {
    let maxLength = 0;

    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const cellValue = cell.value ? cell.value.toString() : "";
      maxLength = Math.max(maxLength, cellValue.length);
    });

    column.width = maxLength + 2; // padding
  });
}

}