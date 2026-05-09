import { inject, injectable } from "inversify";
import { TYPES } from "../types";
import { DataSource } from "typeorm";
import { Invoice } from "../entities/invoice.entity";
import { WorkflowHierarchy } from "../entities/workflowClosure.entity";
import { GRN } from "../entities/grn.entity";
import { Documentb, DocumentStatus, DocumentTypeEnum } from "../entities/docuemnt.entity";

@injectable()
export class DashboardService {
  constructor(
    @inject(TYPES.DataSource) private readonly dataSource: DataSource
  ) {}

  // ─── helper: get descendant employee IDs for a team leader ────────────────
  private async getEmployeeIds(teamLeaderId: string): Promise<string[]> {
    const rows = await this.dataSource
      .getRepository(WorkflowHierarchy)
      .createQueryBuilder("wh")
      .select("wh.descendant_id", "descendantId")
      .where("wh.ancestor_id = :teamLeaderId", { teamLeaderId })
      .andWhere("wh.depth > 0")
      .andWhere("wh.isDeleted = false")
      .getRawMany();

    return rows.map((r) => r.descendantId);
  }

  /**
   * Top 5 customers by highest sales (final invoices with COMPLETE document status).
   *
   * Query params:
   *  - teamLeaderId (optional): scopes to employees under that team leader.
   */
  public async getTop5Customer(query: any): Promise<any> {
    const teamLeaderId: string | undefined = query.teamLeaderId as string | undefined;

    let employeeIds: string[] | null = null;

    if (teamLeaderId) {
      employeeIds = await this.getEmployeeIds(teamLeaderId);

      if (employeeIds.length === 0) {
        return {
          teamLeaderId,
          top5Customers: [],
          message: "No employees found under this team leader",
        };
      }
    }

    // Subquery: Invoice IDs whose document status is COMPLETE
    const completedInvoiceIds = this.dataSource
      .getRepository(Documentb)
      .createQueryBuilder("doc")
      .select("doc.document_type_id")
      .where("doc.type = :invType", { invType: DocumentTypeEnum.FINAL_INVOICE })
      .andWhere("doc.status = :invStatus", { invStatus: DocumentStatus.COMPLETE })
      .andWhere("doc.isDeleted = false");

    const invoiceQuery = this.dataSource
      .getRepository(Invoice)
      .createQueryBuilder("invoice")
      .innerJoin("invoice.customerName", "customer")
      .select([
        "customer.id                           AS \"customerId\"",
        "customer.organisationName             AS \"customerName\"",
        "customer.customerCode                 AS \"customerCode\"",
        "customer.primaryContactNo             AS \"primaryContactNo\"",
        "COALESCE(SUM(invoice.totalAmount), 0) AS \"totalSalesAmount\"",
        "COUNT(invoice.id)                     AS \"totalInvoices\"",
      ])
      .where("invoice.isDeleted = false")
      .andWhere("customer.isDeleted = false")
      .andWhere("customer.id IS NOT NULL")
      .andWhere(`CAST(invoice.id AS varchar) IN (${completedInvoiceIds.getQuery()})`)
      .setParameters(completedInvoiceIds.getParameters());

    if (employeeIds) {
      invoiceQuery.andWhere("invoice.createdBy IN (:...employeeIds)", { employeeIds });
    }

    const results = await invoiceQuery
      .groupBy("customer.id, customer.organisationName, customer.customerCode, customer.primaryContactNo")
      .orderBy("\"totalSalesAmount\"", "DESC")
      .limit(5)
      .getRawMany();

    const top5 = results.map((row) => ({
      customerId: row.customerId,
      customerName: row.customerName,
      customerCode: row.customerCode,
      primaryContactNo: row.primaryContactNo,
      totalSalesAmount: Number(row.totalSalesAmount),
      totalInvoices: Number(row.totalInvoices),
    }));

    return {
      teamLeaderId: teamLeaderId || null,
      top5Customers: top5,
    };
  }

  /**
   * Top 5 farmers by highest purchase quantity (netWeight).
   * Only GRNs whose document status is COMPLETE are counted.
   *
   * Query params:
   *  - teamLeaderId (optional): scopes to employees under that team leader.
   */
  public async getTop5Farmer(query: any): Promise<any> {
    const teamLeaderId: string | undefined = query.teamLeaderId as string | undefined;

    let employeeIds: string[] | null = null;

    if (teamLeaderId) {
      employeeIds = await this.getEmployeeIds(teamLeaderId);

      if (employeeIds.length === 0) {
        return {
          teamLeaderId,
          top5Farmers: [],
          message: "No employees found under this team leader",
        };
      }
    }

    const completedGrnIds = this.dataSource
      .getRepository(Documentb)
      .createQueryBuilder("doc")
      .select("doc.document_type_id")
      .where("doc.type = :type", { type: DocumentTypeEnum.GRN })
      .andWhere("doc.status = :status", { status: DocumentStatus.COMPLETE })
      .andWhere("doc.isDeleted = false");

    const grnQuery = this.dataSource
      .getRepository(GRN)
      .createQueryBuilder("grn")
      .innerJoin("grn.grnProducts", "grnProduct")
      .innerJoin("grn.selectedFarmer", "farmer")
      .select([
        "farmer.id                                                                        AS \"farmerId\"",
        "CONCAT(farmer.farmerfName, ' ', farmer.farmermName, ' ', farmer.farmerlName)     AS \"farmerName\"",
        "farmer.farmerCode                                                                AS \"farmerCode\"",
        "farmer.primaryMobileNo                                                           AS \"primaryMobileNo\"",
        "COALESCE(SUM(grnProduct.netWeight), 0)                                           AS \"totalQuantity\"",
        "COUNT(DISTINCT grn.id)                                                           AS \"totalGRNs\"",
        "COALESCE(SUM(grn.totalAmt), 0)                                                   AS \"totalPurchaseAmount\"",
      ])
      .where("grn.isDeleted = false")
      .andWhere("farmer.isDeleted = false")
      .andWhere("farmer.id IS NOT NULL")
      .andWhere("grn.source = :source", { source: "farmer" })
      .andWhere("grn.grnType = :grnType", { grnType: "purchase" })
      .andWhere(`CAST(grn.id AS varchar) IN (${completedGrnIds.getQuery()})`)
      .setParameters(completedGrnIds.getParameters());

    if (employeeIds) {
      grnQuery.andWhere("grn.createdBy IN (:...employeeIds)", { employeeIds });
    }

    const results = await grnQuery
      .groupBy("farmer.id, farmer.farmerfName, farmer.farmermName, farmer.farmerlName, farmer.farmerCode, farmer.primaryMobileNo")
      .orderBy("\"totalQuantity\"", "DESC")
      .limit(5)
      .getRawMany();

    const top5 = results.map((row) => ({
      farmerId: row.farmerId,
      farmerName: row.farmerName?.trim() || "Unknown",
      farmerCode: row.farmerCode,
      primaryMobileNo: row.primaryMobileNo,
      totalQuantity: Number(row.totalQuantity),
      totalGRNs: Number(row.totalGRNs),
      totalPurchaseAmount: Number(row.totalPurchaseAmount),
    }));

    return {
      teamLeaderId: teamLeaderId || null,
      top5Farmers: top5,
    };
  }

  /**
   * Top 5 vendors by highest purchase quantity (netWeight).
   * Only GRNs whose document status is COMPLETE are counted.
   *
   * Query params:
   *  - teamLeaderId (optional): scopes to employees under that team leader.
   */
  public async getTop5Vendor(query: any): Promise<any> {
    const teamLeaderId: string | undefined = query.teamLeaderId as string | undefined;

    let employeeIds: string[] | null = null;

    if (teamLeaderId) {
      employeeIds = await this.getEmployeeIds(teamLeaderId);

      if (employeeIds.length === 0) {
        return {
          teamLeaderId,
          top5Vendors: [],
          message: "No employees found under this team leader",
        };
      }
    }

    const completedGrnIds = this.dataSource
      .getRepository(Documentb)
      .createQueryBuilder("doc")
      .select("doc.document_type_id")
      .where("doc.type = :type", { type: DocumentTypeEnum.GRN })
      .andWhere("doc.status = :status", { status: DocumentStatus.COMPLETE })
      .andWhere("doc.isDeleted = false");

    const grnQuery = this.dataSource
      .getRepository(GRN)
      .createQueryBuilder("grn")
      .innerJoin("grn.grnProducts", "grnProduct")
      .innerJoin("grn.selectedVendor", "vendor")
      .select([
        "vendor.id                              AS \"vendorId\"",
        "vendor.companyName                     AS \"vendorName\"",
        "vendor.vendorCode                      AS \"vendorCode\"",
        "vendor.officeContactNo                 AS \"officeContactNo\"",
        "COALESCE(SUM(grnProduct.netWeight), 0)  AS \"totalQuantity\"",
        "COUNT(DISTINCT grn.id)                 AS \"totalGRNs\"",
        "COALESCE(SUM(grn.totalAmt), 0)         AS \"totalPurchaseAmount\"",
      ])
      .where("grn.isDeleted = false")
      .andWhere("vendor.isDeleted = false")
      .andWhere("vendor.id IS NOT NULL")
      .andWhere("grn.source = :source", { source: "vendor" })
      .andWhere("grn.grnType = :grnType", { grnType: "purchase" })
      .andWhere(`CAST(grn.id AS varchar) IN (${completedGrnIds.getQuery()})`)
      .setParameters(completedGrnIds.getParameters());

    if (employeeIds) {
      grnQuery.andWhere("grn.createdBy IN (:...employeeIds)", { employeeIds });
    }

    const results = await grnQuery
      .groupBy("vendor.id, vendor.companyName, vendor.vendorCode, vendor.officeContactNo")
      .orderBy("\"totalQuantity\"", "DESC")
      .limit(5)
      .getRawMany();

    const top5 = results.map((row) => ({
      vendorId: row.vendorId,
      vendorName: row.vendorName || "Unknown",
      vendorCode: row.vendorCode,
      officeContactNo: row.officeContactNo,
      totalQuantity: Number(row.totalQuantity),
      totalGRNs: Number(row.totalGRNs),
      totalPurchaseAmount: Number(row.totalPurchaseAmount),
    }));

    return {
      teamLeaderId: teamLeaderId || null,
      top5Vendors: top5,
    };
  }
}
