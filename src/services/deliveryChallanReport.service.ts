import { inject, injectable } from 'inversify';
import { TYPES } from '../types';
import { CustomerDeliveryChallanRepository } from '../repositories/customerDeliveryChallan.repository';
import { IDeliveryChallanReportFilters } from '../interfaces/deliveryChallan-report.interface';

@injectable()
export class DeliveryChallanReportService {
  constructor(
    @inject(TYPES.CustomerDeliveryChallanRepository) 
    private readonly customerDeliveryChallanRepository: CustomerDeliveryChallanRepository
  ) {}

  public async getReport(filters: IDeliveryChallanReportFilters): Promise<any> {
    const queryBuilder = this.customerDeliveryChallanRepository
      .createQueryBuilder('dc')
      .leftJoinAndSelect('dc.companyName', 'companyName')
      .leftJoinAndSelect('dc.offices', 'offices')
      .leftJoinAndSelect('dc.customerName', 'customerName')
      .leftJoinAndSelect('dc.fromLocation', 'fromLocation')
      .leftJoinAndSelect('dc.billingAddress', 'billingAddress')
      .leftJoinAndSelect('dc.deliveryAddress', 'deliveryAddress')
      .leftJoinAndSelect('dc.grnNo', 'grnNo')
      .leftJoinAndSelect('dc.deliveryChallanProducts', 'deliveryChallanProducts')
      .leftJoinAndSelect('deliveryChallanProducts.productName', 'productName')
      .leftJoinAndSelect('deliveryChallanProducts.variant', 'variant')
      .leftJoinAndSelect('deliveryChallanProducts.uom', 'uom')
      .leftJoinAndSelect('dc.invoices', 'invoices')
      .leftJoinAndSelect('dc.returns', 'returns')
      .leftJoinAndSelect('dc.createdBy', 'createdBy')
      .where('dc.isDeleted = :isDeleted', { isDeleted: false });

    // Apply all filters
    this.applyFilters(queryBuilder, filters);

    queryBuilder.orderBy('dc.createdAt', 'DESC');

    const result = await queryBuilder.getMany();

    return this.formatDeliveryChallanReport(result);
  }

  private applyFilters(queryBuilder: any, filters: IDeliveryChallanReportFilters): void {
    // Date range filter
    if (filters.startDate && filters.endDate) {
      queryBuilder.andWhere('dc.createdAt BETWEEN :startDate AND :endDate', {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
    }

    // Entity filters
    if (filters.company && filters.company.length > 0) {
      queryBuilder.andWhere('dc.companyName IN (:...companyIds)', { companyIds: filters.company });
    }

    if (filters.office && filters.office.length > 0) {
      queryBuilder.andWhere('dc.offices IN (:...officeIds)', { officeIds: filters.office });
    }

    if (filters.customer && filters.customer.length > 0) {
      queryBuilder.andWhere('dc.customerName IN (:...customerIds)', { customerIds: filters.customer });
    }

    if (filters.fromLocation && filters.fromLocation.length > 0) {
      queryBuilder.andWhere('dc.fromLocation IN (:...fromLocationIds)', { 
        fromLocationIds: filters.fromLocation 
      });
    }

    if (filters.createdBy && filters.createdBy.length > 0) {
      queryBuilder.andWhere('dc.createdBy IN (:...createdByIds)', { createdByIds: filters.createdBy });
    }

    // Delivery Challan specific filters
    if (filters.challanNo) {
      queryBuilder.andWhere('dc.challanNo ILIKE :challanNo', { challanNo: `%${filters.challanNo}%` });
    }

    if (filters.grnNo) {
      queryBuilder.andWhere('grnNo.grnNo ILIKE :grnNo', { grnNo: `%${filters.grnNo}%` });
    }

    if (filters.approvalStatus) {
      queryBuilder.andWhere('dc.approvalStatus = :approvalStatus', { 
        approvalStatus: filters.approvalStatus 
      });
    }

    if (filters.requestingDepartment) {
      queryBuilder.andWhere('dc.requestingDepartment = :requestingDepartment', {
        requestingDepartment: filters.requestingDepartment,
      });
    }

    // Driver and vehicle filters
    if (filters.driverName) {
      queryBuilder.andWhere('dc.driverName ILIKE :driverName', { 
        driverName: `%${filters.driverName}%` 
      });
    }

    if (filters.vehicleNo) {
      queryBuilder.andWhere('dc.vehicleNo ILIKE :vehicleNo', { vehicleNo: `%${filters.vehicleNo}%` });
    }

    if (filters.licenseNo) {
      queryBuilder.andWhere('dc.licenseNo ILIKE :licenseNo', { 
        licenseNo: `%${filters.licenseNo}%` 
      });
    }

    if (filters.rmn) {
      queryBuilder.andWhere('dc.rmn ILIKE :rmn', { rmn: `%${filters.rmn}%` });
    }

    if (filters.receiverName) {
      queryBuilder.andWhere('dc.receiverName ILIKE :receiverName', { 
        receiverName: `%${filters.receiverName}%` 
      });
    }

    // Product filters
    if (filters.product && filters.product.length > 0) {
      queryBuilder.andWhere('deliveryChallanProducts.productName IN (:...productIds)', { 
        productIds: filters.product 
      });
    }

    // Amount filter with operator
    if (filters.totalProductAmount !== undefined && filters.totalProductAmountOperator) {
      const operator = filters.totalProductAmountOperator;
      if (operator === '>') {
        queryBuilder.andWhere('dc.totalProductAmount > :totalProductAmount', { 
          totalProductAmount: filters.totalProductAmount 
        });
      } else if (operator === '<') {
        queryBuilder.andWhere('dc.totalProductAmount < :totalProductAmount', { 
          totalProductAmount: filters.totalProductAmount 
        });
      } else if (operator === '=') {
        queryBuilder.andWhere('dc.totalProductAmount = :totalProductAmount', { 
          totalProductAmount: filters.totalProductAmount 
        });
      }
    }

    // Weight filter with operator
    if (filters.netProductWeight !== undefined && filters.netProductWeightOperator) {
      const operator = filters.netProductWeightOperator;
      if (operator === '>') {
        queryBuilder.andWhere('dc.netProductWeight > :netProductWeight', { 
          netProductWeight: filters.netProductWeight 
        });
      } else if (operator === '<') {
        queryBuilder.andWhere('dc.netProductWeight < :netProductWeight', { 
          netProductWeight: filters.netProductWeight 
        });
      } else if (operator === '=') {
        queryBuilder.andWhere('dc.netProductWeight = :netProductWeight', { 
          netProductWeight: filters.netProductWeight 
        });
      }
    }

    // Invoice generated filter
    if (filters.invoiceGenerated === 'yes') {
      queryBuilder.andWhere('invoices.id IS NOT NULL');
    } else if (filters.invoiceGenerated === 'no') {
      queryBuilder.andWhere('invoices.id IS NULL');
    }

    // Invoice type filter
    if (filters.invoiceType && filters.invoiceType !== 'all') {
      queryBuilder.andWhere('invoices.type = :invoiceType', { invoiceType: filters.invoiceType });
    }

    // Return status filter
    if (filters.isReturned !== undefined) {
      queryBuilder.andWhere('dc.isReturned = :isReturned', { isReturned: filters.isReturned });
    }
  }

  private formatDeliveryChallanReport(deliveryChallans: any[]): any[] {
    return deliveryChallans.map((dc) => {
      // Calculate totals
      const productCount = dc.deliveryChallanProducts?.length || 0;
      const totalQty = dc.deliveryChallanProducts?.reduce(
        (sum: number, p: any) => sum + (parseFloat(p.quantity) || 0), 
        0
      ) || 0;

      // Check invoice status
      const hasInvoice = dc.invoices && dc.invoices.length > 0;
      const invoiceInfo = hasInvoice ? dc.invoices[0] : null;

      return {
        id: dc.id,
        challanNo: dc.challanNo ? dc.challanNo.toUpperCase() : null,
        grnNo: dc.grnNo?.grnNo ? dc.grnNo.grnNo.toUpperCase() : null,
        companyName: dc.companyName?.name || null,
        officeName: dc.offices?.name || null,
        customerName: dc.customerName?.organisationName || null,
        fromLocation: dc.fromLocation?.name || null,
        poNumber: dc.poNumber || null,
        
        // Product details
        productCount,
        totalQty,
        totalProductAmount: dc.totalProductAmount || 0,
        netProductWeight: dc.netProductWeight || 0,
        netPackagingMaterialWeight: dc.netPackagingMaterialWeight || 0,
        totalPackagingMaterialAmount: dc.totalPackagingMaterialAmount || 0,
        totalAmtInWords: dc.totalAmtInWords || null,

        // Driver and vehicle details
        driverName: dc.driverName || null,
        contactNo: dc.contactNo || null,
        altContactNo: dc.altContactNo || null,
        vehicleNo: dc.vehicleNo ? dc.vehicleNo.toUpperCase() : null,
        licenseNo: dc.licenseNo ? dc.licenseNo.toUpperCase() : null,
        rmn: dc.rmn ? dc.rmn.toUpperCase() : null,
        receiverName: dc.receiverName || null,
        transitInsuranceNo: dc.transitInsuranceNo || null,

        // Status and approval
        approvalStatus: dc.approvalStatus || null,
        requestingDepartment: dc.requestingDepartment || null,
        remark: dc.remark || null,
        isReturned: dc.isReturned || false,

        // Invoice information
        invoiceGenerated: hasInvoice ? 'Yes' : 'No',
        invoiceNo: invoiceInfo?.invoiceNo || null,
        invoiceDate: invoiceInfo?.invoiceDate || null,
        invoiceType: invoiceInfo?.type || null,
        invoiceAmount: invoiceInfo?.totalAmount || null,

        // Addresses
        billingAddress: dc.billingAddress ? this.formatAddress(dc.billingAddress) : null,
        deliveryAddress: dc.deliveryAddress ? this.formatAddress(dc.deliveryAddress) : null,

        // User info
        createdBy: dc.createdBy
          ? `${dc.createdBy.firstName} ${dc.createdBy.lastName}`
          : null,

        // Products
        deliveryChallanProducts: dc.deliveryChallanProducts?.map((product: any) => ({
          id: product.id,
          productName: product.productName?.name || null,
          variant: product.variant?.variantName || null,
          quantity: product.quantity,
          unitPrice: product.unitPrice,
          uom: product.uom?.unit || null,
          amount: product.amount,
          grossWeight: product.grossWeight,
          packingMaterialWeight: product.packingMaterialWeight,
          netWeight: product.netWeight,
        })) || [],

        // Timestamps
        createdAt: dc.createdAt,
        updatedAt: dc.updatedAt,
      };
    });
  }

  private formatAddress(address: any): string {
    if (!address) return '';
    const parts = [
      address.addressLine1,
      address.addressLine2,
      address.city,
      address.state,
      address.pincode,
    ].filter(Boolean);
    return parts.join(', ');
  }

  async generateDeliveryChallanExcelReport(
    filters: IDeliveryChallanReportFilters, 
    loggedInUser?: any
  ): Promise<Buffer | null> {
    try {
      const reportData = await this.getReport(filters);

      if (!reportData || reportData.length === 0) {
        return null;
      }

      // Helper function to get status color
      const getStatusColor = (status: string): string => {
        const statusLower = status?.toLowerCase() || '';
        switch (statusLower) {
          case 'hold':
          case 'pending':
            return 'FFFF5700'; // Orange
          case 'verified':
            return 'FF6A00FF'; // Indigo
          case 'approved':
            return 'FF40BF40'; // Light Green
          case 'finalizing':
            return 'FF0063B1'; // Blue
          case 'complete':
            return 'FF006600'; // Dark Green
          case 'reject':
          case 'rejected':
            return 'FFAF0606'; // Red
          default:
            return 'FFFFFFFF'; // White (no color)
        }
      };

      const formatDate = (dateValue: any): string => {
        if (!dateValue) return '';
        try {
          const date = new Date(dateValue);
          if (isNaN(date.getTime())) return '';
          const day = String(date.getDate()).padStart(2, '0');
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const year = date.getFullYear();
          return `${day}/${month}/${year}`;
        } catch (error) {
          return '';
        }
      };

      const toExcelDate = (dateValue: any): Date | null => {
        if (!dateValue) return null;
        try {
          if (typeof dateValue === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(dateValue)) {
            const [day, month, year] = dateValue.split('-').map(Number);
            const date = new Date(year, month - 1, day);
            if (isNaN(date.getTime())) return null;
            return date;
          }
          const date = new Date(dateValue);
          if (isNaN(date.getTime())) return null;
          return date;
        } catch (error) {
          return null;
        }
      };

      const ExcelJS = require('exceljs');
      const workbook = new ExcelJS.Workbook();

      // ==================== SHEET 1: REPORT SUMMARY ====================
      const filterSheet = workbook.addWorksheet('Report_Summary');
      let filterRow = 1;

      // Title
      filterSheet.mergeCells(`A${filterRow}:B${filterRow}`);
      const titleCell = filterSheet.getCell(`A${filterRow}`);
      titleCell.value = 'Delivery Challan Report for Customer';
      titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0070C0' },
      };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      filterRow++;

      const addParameter = (label: string, value: any, isBold = false) => {
        const labelCell = filterSheet.getCell(`A${filterRow}`);
        const valueCell = filterSheet.getCell(`B${filterRow}`);
        
        labelCell.value = label;
        labelCell.font = { bold: true, size: 11 };
        
        valueCell.value = value || 'All';
        valueCell.font = { bold: isBold, size: 11 };
        valueCell.alignment = { wrapText: true };
        
        labelCell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
        valueCell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
        
        filterRow++;
      };

      const addSectionHeader = (title: string) => {
        filterSheet.mergeCells(`A${filterRow}:B${filterRow}`);
        const headerCell = filterSheet.getCell(`A${filterRow}`);
        headerCell.value = title;
        headerCell.font = { bold: true, size: 12 };
        headerCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD9E1F2' },
        };
        headerCell.alignment = { horizontal: 'left', vertical: 'middle' };
        headerCell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
        filterRow++;
      };

      // Report Header Information
      const companies = [...new Set(reportData.map((r: any) => r.companyName).filter(Boolean))];
      const companyName = companies.length > 0 ? companies[0] : 'All Companies';
      addParameter('Company Name:', companyName);
      
      const periodText = `${formatDate(filters.startDate)} to ${formatDate(filters.endDate)}`;
      addParameter('Reporting Period:', periodText);

      const generatedByName = loggedInUser 
        ? `${loggedInUser.firstName || ''} ${loggedInUser.lastName || ''}`.trim() || 'Admin User'
        : 'Admin User';
      addParameter('Generated By:', generatedByName);
      
      const generatedDate = new Date().toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric'
      });
      addParameter('Generated Date:', generatedDate);
      
      filterRow++;

      // Applied Filters Section
      addSectionHeader('Applied Filters');
      
      addParameter('Start Date', formatDate(filters.startDate));
      addParameter('End Date', formatDate(filters.endDate));
      addParameter('Period', periodText);
      
      addParameter('Company', 
        (filters.company && filters.company.length > 0) ? companies.join(', ') : 'All');
      
      const offices = [...new Set(reportData.map((r: any) => r.officeName).filter(Boolean))];
      addParameter('Office', 
        (filters.office && filters.office.length > 0) ? offices.join(', ') : 'All');
      
      const customers = [...new Set(reportData.map((r: any) => r.customerName).filter(Boolean))];
      addParameter('Customer', 
        (filters.customer && filters.customer.length > 0) ? customers.join(', ') : 'All');
      
      const fromLocations = [...new Set(reportData.map((r: any) => r.fromLocation).filter(Boolean))];
      addParameter('From Location', 
        (filters.fromLocation && filters.fromLocation.length > 0) ? fromLocations.join(', ') : 'All');
      
      const employees = [...new Set(reportData.map((r: any) => r.createdBy).filter(Boolean))];
      addParameter('Created By', 
        (filters.createdBy && filters.createdBy.length > 0) ? employees.join(', ') : 'All');
      
      const products = [...new Set(reportData.flatMap((r: any) => 
        r.deliveryChallanProducts?.map((p: any) => p.productName).filter(Boolean) || []
      ))];
      addParameter('Product', 
        (filters.product && filters.product.length > 0) ? products.join(', ') : 'All');

      addParameter('Challan No', filters.challanNo || 'All');
      addParameter('GRN No', filters.grnNo || 'All');
      addParameter('Approval Status', filters.approvalStatus || 'All');
      addParameter('Requesting Department', filters.requestingDepartment || 'All');
      addParameter('Driver Name', filters.driverName || 'All');
      addParameter('Vehicle No', filters.vehicleNo || 'All');
      addParameter('License No', filters.licenseNo || 'All');
      addParameter('RMN', filters.rmn || 'All');
      addParameter('Receiver Name', filters.receiverName || 'All');

      if (filters.totalProductAmount !== undefined && filters.totalProductAmountOperator) {
        addParameter('Total Product Amount', 
          `${filters.totalProductAmountOperator} ${filters.totalProductAmount}`);
      } else {
        addParameter('Total Product Amount', 'All');
      }
      
      if (filters.netProductWeight !== undefined && filters.netProductWeightOperator) {
        addParameter('Net Product Weight', 
          `${filters.netProductWeightOperator} ${filters.netProductWeight}`);
      } else {
        addParameter('Net Product Weight', 'All');
      }

      addParameter('Invoice Generated', filters.invoiceGenerated || 'All');
      addParameter('Invoice Type', filters.invoiceType || 'All');
      addParameter('Is Returned', filters.isReturned !== undefined ? (filters.isReturned ? 'Yes' : 'No') : 'All');
      
      filterRow++;

      // Summary Section
      addSectionHeader('Summary');
      
      const totalDCs = reportData.length;
      const totalQuantity = reportData.reduce((sum: number, r: any) => sum + (parseFloat(r.totalQty) || 0), 0);
      const totalAmount = reportData.reduce((sum: number, r: any) => sum + (parseFloat(r.totalProductAmount) || 0), 0);
      const totalWithInvoice = reportData.filter((r: any) => r.invoiceGenerated === 'Yes').length;
      const totalReturned = reportData.filter((r: any) => r.isReturned).length;
      
      addParameter('Total Delivery Challans', totalDCs);
      addParameter('Total Quantity (KG)', totalQuantity.toFixed(2));
      addParameter('Total Amount (INR)', totalAmount.toFixed(2));
      addParameter('Delivery Challans with Invoice', totalWithInvoice);
      addParameter('Returned Delivery Challans', totalReturned);

      filterSheet.getColumn(1).width = 35;
      filterSheet.getColumn(2).width = 60;

      // ==================== SHEET 2: REPORT DATA ====================
      const recordSheet = workbook.addWorksheet('Report_Data');
      let currentRow = 1;

      const headerRow = currentRow;
      const headers = [
        'Date',
        'Challan No',
        'GRN No',
        'Company',
        'Office',
        'Customer Name',
        'From Location',
        'PO Number',
        'Product Name',
        'Variant',
        'UOM',
        'Quantity',
        'Unit Price',
        'Amount',
        'Total Quantity',
        'Total Product Amount',
        'Net Product Weight',
        'Approval Status',
        'Invoice Generated',
        'Invoice No',
        'Invoice Date',
        'Invoice Type',
        'Invoice Amount',
        'Driver Name',
        'Vehicle No',
        'License No',
        'RMN',
        'Receiver Name',
        'Is Returned',
        'Created By',
        'Billing Address',
        'Delivery Address'
      ];

      headers.forEach((header, index) => {
        const cell = recordSheet.getCell(headerRow, index + 1);
        cell.value = header;
        cell.font = { bold: true };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFFF00' },
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });

      currentRow++;

      // Data Rows
      reportData.forEach((dc: any) => {
        const dcProducts = dc.deliveryChallanProducts || [];
        
        if (dcProducts.length === 0) {
          const row = recordSheet.getRow(currentRow);
          const createdAtDate = toExcelDate(dc.createdAt);
          const invoiceDate = toExcelDate(dc.invoiceDate);
          
          row.getCell(1).value = createdAtDate;
          row.getCell(2).value = dc.challanNo || '';
          row.getCell(3).value = dc.grnNo || '';
          row.getCell(4).value = dc.companyName || '';
          row.getCell(5).value = dc.officeName || '';
          row.getCell(6).value = dc.customerName || '';
          row.getCell(7).value = dc.fromLocation || '';
          row.getCell(8).value = dc.poNumber || '';
          row.getCell(9).value = '';
          row.getCell(10).value = '';
          row.getCell(11).value = '';
          row.getCell(12).value = '';
          row.getCell(13).value = '';
          row.getCell(14).value = '';
          row.getCell(15).value = dc.totalQty || 0;
          row.getCell(16).value = dc.totalProductAmount || 0;
          row.getCell(17).value = dc.netProductWeight || 0;
          row.getCell(18).value = dc.approvalStatus ? dc.approvalStatus.toUpperCase() : '';
          row.getCell(19).value = dc.invoiceGenerated || 'No';
          row.getCell(20).value = dc.invoiceNo || '';
          row.getCell(21).value = invoiceDate;
          row.getCell(22).value = dc.invoiceType || '';
          row.getCell(23).value = dc.invoiceAmount || '';
          row.getCell(24).value = dc.driverName || '';
          row.getCell(25).value = dc.vehicleNo || '';
          row.getCell(26).value = dc.licenseNo || '';
          row.getCell(27).value = dc.rmn || '';
          row.getCell(28).value = dc.receiverName || '';
          row.getCell(29).value = dc.isReturned ? 'Yes' : 'No';
          row.getCell(30).value = dc.createdBy || '';
          row.getCell(31).value = dc.billingAddress || '';
          row.getCell(32).value = dc.deliveryAddress || '';

          // Apply status color
          const statusColor = getStatusColor(dc.approvalStatus);
          row.getCell(18).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: statusColor },
          };
          // Always use white text for colored backgrounds, black for no color
          row.getCell(18).font = {
            color: { argb: statusColor === 'FFFFFFFF' ? 'FF000000' : 'FFFFFFFF' },
            bold: true,
          };
          row.getCell(18).alignment = { horizontal: 'center', vertical: 'middle' };

          row.getCell(12).numFmt = '#,##0.00';
          row.getCell(13).numFmt = '#,##0.00';
          row.getCell(14).numFmt = '#,##0.00';
          row.getCell(15).numFmt = '#,##0.00';
          row.getCell(16).numFmt = '#,##0.00';
          row.getCell(17).numFmt = '#,##0.00';
          row.getCell(23).numFmt = '#,##0.00';
          
          if (createdAtDate) row.getCell(1).numFmt = 'dd/mm/yyyy';
          if (invoiceDate) row.getCell(21).numFmt = 'dd/mm/yyyy';

          for (let i = 1; i <= 32; i++) {
            row.getCell(i).border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' },
            };
          }
          currentRow++;
        } else {
          const startRow = currentRow;
          const productCount = dcProducts.length;
          
          const createdAtDate = toExcelDate(dc.createdAt);
          const invoiceDate = toExcelDate(dc.invoiceDate);
          
          dcProducts.forEach((product: any, index: number) => {
            const row = recordSheet.getRow(currentRow);
            
            if (index === 0) {
              row.getCell(1).value = createdAtDate;
              row.getCell(2).value = dc.challanNo || '';
              row.getCell(3).value = dc.grnNo || '';
              row.getCell(4).value = dc.companyName || '';
              row.getCell(5).value = dc.officeName || '';
              row.getCell(6).value = dc.customerName || '';
              row.getCell(7).value = dc.fromLocation || '';
              row.getCell(8).value = dc.poNumber || '';
              row.getCell(15).value = dc.totalQty || 0;
              row.getCell(16).value = dc.totalProductAmount || 0;
              row.getCell(17).value = dc.netProductWeight || 0;
              row.getCell(18).value = dc.approvalStatus ? dc.approvalStatus.toUpperCase() : '';
              row.getCell(19).value = dc.invoiceGenerated || 'No';
              row.getCell(20).value = dc.invoiceNo || '';
              row.getCell(21).value = invoiceDate;
              row.getCell(22).value = dc.invoiceType || '';
              row.getCell(23).value = dc.invoiceAmount || '';
              row.getCell(24).value = dc.driverName || '';
              row.getCell(25).value = dc.vehicleNo || '';
              row.getCell(26).value = dc.licenseNo || '';
              row.getCell(27).value = dc.rmn || '';
              row.getCell(28).value = dc.receiverName || '';
              row.getCell(29).value = dc.isReturned ? 'Yes' : 'No';
              row.getCell(30).value = dc.createdBy || '';
              row.getCell(31).value = dc.billingAddress || '';
              row.getCell(32).value = dc.deliveryAddress || '';

              // Apply status color
              const statusColor = getStatusColor(dc.approvalStatus);
              row.getCell(18).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: statusColor },
              };
              // Always use white text for colored backgrounds, black for no color
              row.getCell(18).font = {
                color: { argb: statusColor === 'FFFFFFFF' ? 'FF000000' : 'FFFFFFFF' },
                bold: true,
              };
              row.getCell(18).alignment = { horizontal: 'center', vertical: 'middle' };
            }
            
            row.getCell(9).value = product.productName || '';
            row.getCell(10).value = product.variant || '';
            row.getCell(11).value = product.uom || '';
            row.getCell(12).value = product.quantity || 0;
            row.getCell(13).value = product.unitPrice || 0;
            row.getCell(14).value = product.amount || 0;

            row.getCell(12).numFmt = '#,##0.00';
            row.getCell(13).numFmt = '#,##0.00';
            row.getCell(14).numFmt = '#,##0.00';
            row.getCell(15).numFmt = '#,##0.00';
            row.getCell(16).numFmt = '#,##0.00';
            row.getCell(17).numFmt = '#,##0.00';
            row.getCell(23).numFmt = '#,##0.00';

            for (let i = 1; i <= 32; i++) {
              row.getCell(i).border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' },
              };
            }
            
            currentRow++;
          });

          if (productCount > 1) {
            const endRow = currentRow - 1;
            const mergeCols = [1, 2, 3, 4, 5, 6, 7, 8, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32];
            
            mergeCols.forEach((colIndex) => {
              try {
                const startCell = recordSheet.getCell(startRow, colIndex);
                recordSheet.mergeCells(startRow, colIndex, endRow, colIndex);
                startCell.alignment = { vertical: 'middle', horizontal: 'center' };
                
                if (colIndex === 1 && createdAtDate) {
                  startCell.numFmt = 'dd/mm/yyyy';
                }
                if (colIndex === 21 && invoiceDate) {
                  startCell.numFmt = 'dd/mm/yyyy';
                }
              } catch (error) {
                console.log(`Merge error for column ${colIndex}:`, error);
              }
            });
          }
        }
      });

      // Set column widths
      recordSheet.getColumn(1).width = 12;
      recordSheet.getColumn(2).width = 15;
      recordSheet.getColumn(3).width = 15;
      recordSheet.getColumn(4).width = 20;
      recordSheet.getColumn(5).width = 20;
      recordSheet.getColumn(6).width = 25;
      recordSheet.getColumn(7).width = 20;
      recordSheet.getColumn(8).width = 15;
      recordSheet.getColumn(9).width = 25;
      recordSheet.getColumn(10).width = 15;
      recordSheet.getColumn(11).width = 10;
      recordSheet.getColumn(12).width = 12;
      recordSheet.getColumn(13).width = 12;
      recordSheet.getColumn(14).width = 12;
      recordSheet.getColumn(15).width = 15;
      recordSheet.getColumn(16).width = 18;
      recordSheet.getColumn(17).width = 18;
      recordSheet.getColumn(18).width = 15;
      recordSheet.getColumn(19).width = 15;
      recordSheet.getColumn(20).width = 15;
      recordSheet.getColumn(21).width = 12;
      recordSheet.getColumn(22).width = 12;
      recordSheet.getColumn(23).width = 15;
      recordSheet.getColumn(24).width = 20;
      recordSheet.getColumn(25).width = 15;
      recordSheet.getColumn(26).width = 15;
      recordSheet.getColumn(27).width = 12;
      recordSheet.getColumn(28).width = 20;
      recordSheet.getColumn(29).width = 12;
      recordSheet.getColumn(30).width = 20;
      recordSheet.getColumn(31).width = 35;
      recordSheet.getColumn(32).width = 35;

      const buffer = await workbook.xlsx.writeBuffer();
      return Buffer.from(buffer);
    } catch (error) {
      console.error('Error generating delivery challan Excel report:', error);
      throw error;
    }
  }
}
