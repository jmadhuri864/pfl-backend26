import { Container } from "inversify";
import { UserController } from "./controllers/user.controller";
import { UserService } from "./services/user.service";
import { UserRepository } from "./repositories/user.repository";
import { TYPES } from "./types";
import { AuthController } from "./controllers/auth.controller";

import { DataSource } from "typeorm";
import { AppDataSource } from "./utils/data-source";

import { VendorService } from "./services/vendor.service";
import { VendorRepository } from "./repositories/vendor.repository";
import { VendorController } from "./controllers/vendor.controller";
import { VendorSubcategoryService } from "./services/vendorSubcategory.service";
import { VendorSubcategoryRepository } from "./repositories/vendorSubcategory.repository";
import { VendorSubcategoryController } from "./controllers/vendorSubcategory.controller";

import { VendorCategoryRepository } from "./repositories/vendorCategory.repository";
import { VendorCategoryController } from "./controllers/vendorCategory.controller";
import { CustomerService } from "./services/customer.service";

import { CustomerRepository } from "./repositories/customer.repository";
import { CustomerController } from "./controllers/customer.controller";
import { CustomerTypeService } from "./services/customerType.service";
import { CustomerTypeRepository } from "./repositories/customerType.repository";
import { CustomerTypeController } from "./controllers/customerType.controller";
import { CustomerCategoryRepository } from "./repositories/customerCategory.repository";
import { CustomerCategoryController } from "./controllers/customerCategory.controller";
import { CustomerCategoryService } from "./services/customerCategory.service";
import { FarmerService } from "./services/farmer.service";
import { FarmerRepository } from "./repositories/farmer.repository";
import { FarmerController } from "./controllers/farmer.controller";
import { UOMRepository } from "./repositories/uom.repository";
import { UOMConversionMatrixRepository } from "./repositories/uomMatrix.repository";
import { UOMConversionMatrixController } from "./controllers/UOMconversionMatrix.controller";
import { UOMConversionMatrixService } from "./services/UOMconversionMatrix.service";
import { UOMService } from "./services/UOM.service";
import { UOMController } from "./controllers/UOM.controller";
import { ProductCategoryService } from "./services/product_category.service";
import { ProductCategoryRepository } from "./repositories/product_category.repository";
import { ProductCategoryController } from "./controllers/productCategory.controller";
import { ProductSubcategoryService } from "./services/product_subcategory";
import { ProductSubcategoryRepository } from "./repositories/product_subcategory.repository";
import { ProductSubcategoryController } from "./controllers/productSubcategory.controller";
import { ProductController } from "./controllers/product.controller";

import { ProductService } from "./services/product.service";

import { AddressRepository } from "./repositories/address.repository";
import { AddressService } from "./services/address.service";
import { VendorCategoryService } from "./services/vendorCategory.service";


import { DriverController } from "./controllers/drivers.controller";
import { DriverRepository } from "./repositories/driver.repository";
import { DriversService } from "./services/driver.service";
import { ProductClassificationService } from "./services/product_classification.service";
import { ProductClassificationController } from "./controllers/productClassification.controller";
import { ProductRepository } from "./repositories/product.repository";

import { BankDetailsCustRepository } from "./repositories/bank-detailsCust.repository";

import { BankDetailsCust } from "./entities/bankDetailsCust.entity";

import { BillingDetailsCustRepository } from "./repositories/billingDetailsCust.repository";
import { BillingDetailsCust } from "./entities/billingdetailsCust.entity";

import { BranchessRepository } from "./repositories/branches.repository";
import { Branches } from "./entities/branches.entity";
import { BranchessService } from "./services/branches.service";
import { BranchessController } from "./controllers/branches.controller";
import { Address } from "./entities/address.entity";
import { OfficesRepository } from "./repositories/offices.repository";
import { OfficesData } from "./entities/offices.entity";
import { OfficesService } from "./services/office.service";
import { OfficesController } from "./controllers/offices.controller";
import { Vendor } from "./entities/vendor.entity";

import { Crop } from "./entities/crop.entity";
import { CropRepository } from "./repositories/crop.repository";
import { Farmer } from "./entities/farmer.entity";
import { DeliveryDetails } from "./entities/deliveryDetailsCust.entity";
import { DeliveryDetailsCustRepository } from "./repositories/deliveryDetailsCust.repository";
import { DeliveryDetailsCustService } from "./services/DeliveryDetailsCust.service";

import { StatutoryDetails } from "./entities/statutoryCust.entity";
import { StatutoryDetailsCustRepository } from "./repositories/statutoryDetails.repository";
import { StatutoryDetailsCustService } from "./services/statutoryDetails.service";
import { StatutoryDetailsCustController } from "./controllers/statutoryDetails.controller";
import { ProductSpecification} from "./entities/productSpecificationCust.entity";
import { ProductSpecificationCustRepository } from "./repositories/productspecification.repository";

import { BankDetailsvendRepository } from "./repositories/vendorBankDetails.repository";
import { BankDetailsvend } from "./entities/bankDetailsVend.entity";
import { VendorSaleInfo } from "./entities/vendorsaleinfo.entity";
import { VendorSaleInfoRepository } from "./repositories/vendorSaleInfo.repository";
import { DeliveryDetailsCustController } from "./controllers/deliverydetailsCust.controller";
import { BankDetailsvendService } from "./services/vendorBankDetails.service";
import { VendorSaleInfoService } from "./services/vendorsaleinfo.service";
import { PaymentTermsRepository } from "./repositories/paymentTermsCust.repository";
import { PaymentTerms } from "./entities/paymentDetailsCust.entity";
import { PaymentTermsService } from "./services/paymentTerms.service";
import { keyMobileNoData } from "./entities/keyMobileNoCust.entity";
import { KeyMobileNoDataRepository } from "./repositories/keyMobileNoDataCust.repository";
import { KeyMobileNoDataService } from "./services/keymobilenocust.service";
import { RFPA } from "./entities/rfpa.entity";
import { RfpaRepository } from "./repositories/rfpa.repository";
import { RfpaService } from "./services/rfpa.service";
import { RfpaController } from "./controllers/rfpa.controller";
import { DealSlip } from "./entities/dealSlip.entity";
import { DealSlipRepository } from "./repositories/dealSlip.repository";
import { DealSlipService } from "./services/dealSlip.service";
import { DealSlipController } from "./controllers/dealSlip.controller";

import { UOM } from "./entities/uom.entity";
import { Product } from "./entities/product.entity";
import { GRN } from "./entities/grn.entity";
import { GrnRepository } from "./repositories/grn.repository";
import { GrnService } from "./services/grn.service";
import { GrnController } from "./controllers/grn.controller";
import { GrnReportService } from "./services/grnReport.service";
import { GrnReportController } from "./controllers/grnReport.controller";
import { DeliveryChallanReportService } from "./services/deliveryChallanReport.service";
import { DeliveryChallanReportController } from "./controllers/deliveryChallanReport.controller";
import { GrnProduct } from "./entities/grnProduct.entity";
import { GrnProductRepository } from "./repositories/grnProduct.repository";
import { GrnProductService } from "./services/grnProduct.service";
import {  NotificationRepository } from "./repositories/notification.repository";
import { Notification } from "./entities/notifications.entity";
import { NotificationService } from "./services/notification.service";
import { TPVoucher } from "./entities/transportPaymentvoucher.entity";
import { TPVoucherRepository } from "./repositories/transportPaymentV.repository";
import { TPVoucherService } from "./services/transportPaymentV.service";
import { TPVoucherController } from "./controllers/transportPaymentV.controller";
import { PMPVoucherRepository } from "./repositories/pmpvoucher.repository";
import { PMPVoucher } from "./entities/packingMaterialVoucher.entity";
import { PMPVoucherService } from "./services/pmpvoucher.service";
import { PMPVoucherController } from "./controllers/pmpVoucher.controller";
import { CashVoucher } from "./entities/mCashVoucher.entity";
import { MultiCashVoucherService } from "./services/multiCashVoucher.service";
import { MultiCashVoucherController } from "./controllers/multiCashVoucher.controller";
import { LPVoucher } from "./entities/labourPaymentVoucher.entity";
import { LabourPaymentVoucherRepository } from "./repositories/labourPaymentVoucher.repository";
import { LabourPaymentVoucherService } from "./services/labourPaymentVoucher.service";
import { LabourPaymentVoucherController } from "./controllers/labourPaymentVoucher.controller";
import { MultiCashVoucherRepository } from "./repositories/multicashVoucher.repository";
import { ApprovalLevel } from "./entities/approvalLevel.entity";
import { ApprovalLevelRepository } from "./repositories/approvalLevel.repository";
import { ApprovalLevelService } from "./services/approvalLevel.service";
import { ApprovalLevelController } from "./controllers/approvalLevel.controller";
import { DeliveryChallanPurchase } from "./entities/deliveryChallan.entity";
import { DeliveryChallanRepository } from "./repositories/deliveryChallan.repository";
import { DeliveryChallanController } from "./controllers/deliveryChallan.controller";
import { DeliveryChallanService } from "./services/deliveryChallan.service";
import { ProductCategory } from "./entities/product_category.entity";
import { ProductClassificationRepository } from "./repositories/product_classification.repository";
import { ProductClassification } from "./entities/product_classification.entity";
import { PaymentRequestRepository } from "./repositories/paymentRequest.repository";
import { PaymentRequestService } from "./services/paymentRequest.service";
import { PaymentRequest } from "./entities/paymentRequest.entity";
import { PaymentRequestController } from "./controllers/paymentRequest.controller";
import { VendorSubcategory } from "./entities/vendorSubcategory.entity";
import { VendorCategory } from "./entities/vendorCategory.entity";
import { DitemRepository } from "./repositories/dItem.repository";
import { Item } from "./entities/dItem.entity";
import { AuditLog } from "./entities/auditLog.entity";
import { AuditLogRepository } from "./repositories/AuditLog.repository";
import { AuditLogService } from "./services/auditLog.service";
import { AuditLogController } from "./controllers/auditLog.controller";
import { SystemLog} from "./entities/userSystemInfo.entity";
import { UserSystemInfoRepository } from "./repositories/userSystemInfo.repository";

// import { Server } from "socket.io";
import { NotificationController } from "./controllers/notification.controller";
import { RequestsRepository } from "./repositories/requests.repository";
import { Requests } from "./entities/request.entity";

import { LevelsController } from "./controllers/levels.controller";
import { LevelsRepository } from "./repositories/levels.repository";
import { Levels } from "./entities/levels.entity";
import { LevelsService } from "./services/levels.service";
import { User } from "./entities/user.entity";
import { RequestsService } from "./services/request.service";
import { InwardRegister } from "./entities/inwardRegister.entity";
import { InwardRepository } from "./repositories/inwardRegister.repository";
import { InwardRegisterService } from "./services/inwardRegister.service";
import { InwardRegisterController } from "./controllers/inwardRegister.controller";
import { DepartmentforApproveRepository } from "./repositories/departmentforapprove.repository";
import { Departments } from "./entities/deparmentforapproval.entity";
import { DepartmentforApproveService } from "./services/deparment.service";
import { DepartmentforApproveController } from "./controllers/departments.controller";
import { LaborRegister } from "./entities/labourregister.entity";
import { LaborRegisterRepository } from "./repositories/labourRegister.repository";
import { LaborRegisterService } from "./services/labourRegister.service";
import { LaborRegisterController } from "./controllers/labourRegister.controller";
import { LaborAttendance } from "./entities/laborattendance.entity";
import { LaborAttendancesRepository } from "./repositories/labourAttendances.repository";
import { LaborAttendancesService } from "./services/labourAttendence.service";
import { LaborAttendancesController } from "./controllers/labourAttendances.controller";
import { LaborRepository } from "./repositories/labor.repository";
import { Labor } from "./entities/labor.entity";
import { LaborService } from "./services/labor.service";
import { LaborController } from "./controllers/labor.controller";
import { DumpRegisterRepository } from "./repositories/dumpRegister.repository";
import { DumpRegister } from "./entities/dumpRegister.entity";
import { DumpRegisterService } from "./services/dumpRegister.service";
import { DumpRegisterController } from "./controllers/dumpRegister.controller";
import { SkuEodRepository } from "./repositories/skuEod.repository";
import { SkuEodReport } from "./entities/skuStock.entity";
import { SKUEodStockService } from "./services/skuEodStock.service";
import { EodRepository } from "./repositories/eodstockreport.repository";

import { EodStockService } from "./services/eodStock.service";
import { SkuEodStockController } from "./controllers/skuEodStock.controller";
import { EodStockController } from "./controllers/eodStock.controller";
import { VehicleDispatch } from "./entities/vehicleDispatch.entity";
import { VehicleDispatchRepository } from "./repositories/vehicleDispatch.repository";
import { VehicleDispatchService } from "./services/vehicleDispatch.service";
import { VehicleDispatchController } from "./controllers/vehicleDispatch.controller";
import { Aqr } from "./entities/aqr.entity";
import { AqrRepository } from "./repositories/aqr.repository";
import { AqrService } from "./services/aqr.service";
import { AqrController } from "./controllers/aqr.contoller";
import { QualityParameter } from "./entities/quantityParameter.entity";
import { QualityParameterRepository } from "./repositories/qualityParameter.repository";
import { SecondSale } from "./entities/secondSale.entity";
import { SecondSaleService } from "./services/secondSale.service";
import { SecondSaleRepository } from "./repositories/secondSale.repository";
import { SecondSaleController } from "./controllers/secondSale.controller";

import { DumpProductRepository } from "./repositories/dumpProduct.repository";
import { DumpProduct } from "./entities/dumpProduct.entity";


import { SecondSaleProduct } from "./entities/secondSaleProduct.entity";
import { SecondSaleProductRepository } from "./repositories/secondSaleProduct.repository";



import { SaleOrder } from "./entities/saleOrder.entity";
import { SaleOrderRepository } from "./repositories/saleOrder.repository";
import { SaleOrderService } from "./services/saleOrder.service";
import { SaleOrderController } from "./controllers/saleOrder.controller";
import { Invoice } from "./entities/invoice.entity";
import { InvoiceProduct } from "./entities/invoiceProduct.entity";
import { InvoiceRepository } from "./repositories/invoice.repository";
import { InvoiceProductRepository } from "./repositories/invoiceProduct.repository";

import { PostReturnByCustomer } from "./entities/postReturnByCustomer.entity";
import { PostReturnByCustomerRepository } from "./repositories/postReturnByCustomer.repository";
import { PostReturnByCustomerService } from "./services/postReturnByCustomer.service";
import { PostReturnByCustomerController } from "./controllers/postReturnByCustomer.controller";
import { PdfGeneratorService } from "./utils/pdfGenerator";
import { CompanyRepository } from "./repositories/company.repository";
import { Company } from "./entities/company.entity";
import { CompanyController } from "./controllers/company.controller";
import { CompanyService } from "./services/company.service";
import { Customer } from "./entities/customer.entity";
import { ProcurmentDashController } from "./controllers/procurmentDashboard.controller";
import { ProcurmentDashService } from "./services/procurmentDashbord.service"
import { ManagementDashService } from "./services/managementDashboard.service";
import { ManagementDashController } from "./controllers/managementDashboard.controller";
import { ReturnedProducts } from "./entities/returnProduct.entity";
import { ReturnedProductsRepository } from "./repositories/returnProduct.repository";

import { StockReportEod } from "./entities/eodReportforinvendtory.entity";
import { ProductVarientsRepository } from "./repositories/productVarients.repository";

import { ProductVarientService } from "./services/productVarient.service";
import { ProductVarientController } from "./controllers/productVarient.controller";
import { InventoryStockRepository } from "./repositories/inventoryStock.repository";
import { InventoryStock } from "./entities/inventoryStock.entity";
import { InventoryStockController } from "./controllers/inventoryStock.controller";
import { InventoryStockService } from "./services/inventoryStock.service";
import { PackingMaterial } from "./entities/packingMaterial.entity";
import { PackingMaterialRepository } from "./repositories/packingMaterial.repository";
import { PackingMaterialService } from "./services/packingMaterial.service";
import { PackingMaterialController } from "./controllers/packingMaterial.controller";
import { DocumentDefinition } from "./entities/documentdef.entity";
import { DocumentDefinitionRepository } from "./repositories/documentDefination.repository";
import { DocumentDefinitionService } from "./services/documentDefinition.service";
import { DocumentDefinitionController } from "./controllers/documentDefination.controller";
import { DocumentPermission } from "./entities/permission.entity";
import { DocumentPermissionRepository } from "./repositories/documentPermission.repository";
import { DocumentPermissionService } from "./services/documentPermission.service";
import { DocumentPermissionController } from "./controllers/documentPermission.controller";

import { CustomerDeliveryChallan } from "./entities/customerDeliveryChallan.entity";
import { CustomerDeliveryChallanRepository } from "./repositories/customerDeliveryChallan.repository";
import { CustomerDeliveryChallanService } from "./services/customerDeliveryChallan.service";
import { CustomerDeliveryChallanController } from "./controllers/customerDeliveryChallan.controller";
import { FinalInvoiceService } from "./services/finalInvoice.service";
import { FinalInvoiceController } from "./controllers/finalInvoice.controller";
import { StockTranferDeliveryChallanController } from "./controllers/stockTransferDeliveryChallan.controllers";
import { StockTransferDeliveryChallan } from "./entities/stockTransferdeliveryChallan.entity";
import { StockTransferDeliveryChallanService } from "./services/stockTransferDeliveryChallan.service";
import { StockTransferDeliveryChallanRepository } from "./repositories/stockTransferDeliveryChallan.repository";
import { OtherDeliveryChallan } from "./entities/otherDeliveryChallan.entity";
import { OtherDeliveryChallanRepository } from "./repositories/otherDeliveryChallan.repository";
import { OtherDeliveryChallanService } from "./services/otherDeliveryChallan.service";
import { OtherDeliveryChallanController } from "./controllers/otherDeliveryChallan.controller";
import { ReportingManagersRepository } from "./repositories/reportingmanager.repository";

import { ApprovalFlowRepository } from "./repositories/approvalFlow.repository";
import { ApprovalFlow } from "./entities/approvalFlow.entity";
import { ApprovalFlowService } from "./services/approvalFlow.service";
import { ApprovalFlowController } from "./controllers/approvalFlow.controller";
import { FinalizerBlockRepository } from "./repositories/finalizerBlock.repository";
import { FinalizerBlock } from "./entities/finalizerBlock.entity";
import { ApproverBlock } from "./entities/approvalBlock.entity";
import { ApproverBlockRepository } from "./entities/approverBlock.entity";
import { DocumentbRepository } from "./repositories/documentb.repository";
import { Documentb } from "./entities/docuemnt.entity";
import { DocumentbController } from "./controllers/documentb.controller";
import { DocumentbService } from "./services/documentb.service";
import { ApprovalStageInfo } from "./entities/approvalname.entity";
import { ApprovalStageInfoRepository } from "./repositories/approvalStageInfoRepository";
import { DocumentApprovalFlowRepository } from "./repositories/DocumentApprovalFlowRepository.repository";
import { DocumentApprove } from "./entities/documentApproval.entity";
import { DocumentApprovalFlow } from "./entities/documentApproveBy.entity";
import { DocDoubleApproverService } from "./services/docDoubleApprover.service";
import { DocSingalApproverService } from "./services/DocSingalApproverService.service";

import { AdminDashboardController } from "./controllers/adminDashboard.controller";
import { AdminDashboardService } from "./services/dashboard/admin/adminDashboardService.service";
import { InwardProduct } from "./entities/inwardProduct.entity";
import { InwardProductRepository } from "./repositories/inwardProduct.repository";
import { AddressController } from "./controllers/address.controller";
import { ProductVarientRepository } from "./repositories/varients.repository";
import { ProductVarient } from "./entities/productVarient.entity";
import { ProductVarientsService } from "./services/varients.service";
import { VarientsController } from "./controllers/varient.controller";
import { ExcelController } from "./controllers/getexcel.controller";
import { ActiveSession } from "./entities/activeSession.entity";
import { ActiveSessionRepository } from "./repositories/activeSession.repository";
import { UserReportController } from "./controllers/userReport.controller";
import { UserReportService } from "./services/userreport.service";
import { SuperAdminService } from "./services/superadmin.service";
import { SuperAdminController } from "./controllers/superAdmin.controller";

// Report imports
import { ReportController } from "./controllers/report.controller";
import { ReportService } from "./services/report.service";
import { SalesReportService } from "./services/salesReport.service";
import { RoleController } from "./controllers/role.controller";
import { RoleService } from "./services/role.service";
import { RoleRepository } from "./repositories/role.repository";
import { Role } from "./entities/role.entity";
import { StockCorrectionRepository } from "./repositories/stockCorrection.repository";
import { StockCorrectionService } from "./services/stockCorrection.service";
import { StockCorrectionController } from "./controllers/stockCorrection.controller";
import { StockCorrection } from "./entities/stockCorrection.entity";
// SSE Service and Controller
import { SSEService } from "./services/sse.service";
import { SSEController } from "./controllers/sse.controller";
import { SSEHelperService } from "./utils/SSE_HELPER_SERVICE";
// Performance optimization services
import { CacheService } from "./services/cache.service";
import { QueryOptimizerService } from "./services/queryOptimizer.service";
import { CrystalReportService } from "./services/crystalReport.service";
// Procurement Crystal Report
import { ProcurementCrystalReportService } from "./services/procurementCrystalReport.service";
import { ProcurementCrystalReportController } from "./controllers/procurementCrystalReport.controller";

// Sales Crystal Report
import { SalesCrystalReportService } from "./services/salesCrystalReport.service";
import { SalesCrystalReportController } from "./controllers/salesCrystalReport.controller";
// User Activity Logging
import { UserActivityLog } from "./entities/userActivityLog.entity";
import { UserActivityLogRepository } from "./repositories/userActivityLog.repository";
import { UserActivityLogService } from "./services/userActivityLog.service";
import { UserActivityLogController } from "./controllers/userActivityLog.controller";
//import { LogCleanupService } from "./services/lo";
import { WorkflowHierarchy } from "./entities/workflowClosure.entity";
import { WorkflowHierarchyRepository } from "./repositories/WorkflowHierarchy.repository";
import { WorkflowHierarchyService } from "./services/workFlowHierarchy.service";
import { WorkflowHierarchyController } from "./controllers/WorkflowHierarchy.controller";
import { ProcurementTargetRepository } from "./repositories/procurementTarget.repository";
import { ProcurementTarget } from "./entities/procurmentTarget.entity";
import { ProcurementTargetService } from "./services/procurementTarget.service";
import { ProcurementTargetController } from "./controllers/procurementTarget.controller";
import { SalesTarget } from "./entities/salesTarget.entity";
import { SalesTargetRepository } from "./repositories/salesTarget.repository";
import { SalesTargetService } from "./services/salesTarget.service";
import { SalesTargetController } from "./controllers/salesTarget.controller";
import { SalesTargetProduct } from "./entities/salesTargetProduct.entity";
import { SalesTargetWeekRepository } from "./repositories/salesTargetWeek.repository";
import { SalesTargetProductRepository } from "./repositories/salesTargetProduct.repository";
import { SalesTargetWeek } from "./entities/salesTargetWeek.entity";
import { SalesAchievementRepository } from "./repositories/salesAchievement.repository";
import { SalesAchievement } from "./entities/salesachivement.entity";
//import { DashboardService } from "./services/dash;

import { ProcurementTargetProduct } from "./entities/procurementTargetProduct.entity";
import { ProcurementTargetProductRepository } from "./repositories/procurmentTargetProduct.repository";
import { ProcurementTargetWeek } from "./entities/procurementTargetWeek.entity";
import { ProcurementTargetWeekRepository } from "./repositories/procurmentTargetWeek.repository";
import { ProcurementTargetAchievementRepository } from "./repositories/procurmentAchievement.repository";
import { ProcurementAchievement } from "./entities/procurementAchievement.entity";
import { PaymentInfoForRFPA } from "./entities/rfpaPayementInfo.entity";
import { RfpaPaymentInfoRepository } from "./repositories/rfpaPaymentInfo.repository";
import { RegistrationReportsController } from "./controllers/registrationReport.controller";
import { RegistrationReportService } from "./services/registrationReport.service";
import { NewRegistrationController } from "./controllers/newRegistration.controller";
import { NewRegistrationService } from "./services/newRegistration.service";
import { ReturnToVendorService } from "./services/retrunToVendor.service";
import { ReturnToVendorRepository } from "./repositories/returnToVendor.repository";
import { ReturnToVendor } from "./entities/returnToVendor.entity";
import { ReturnToVendorController } from "./controllers/returnToVendor.controller";
import { FinalInvoiceReportController } from "./controllers/finalInvoiceReport.controller";
import { FinalInvoiceReportService } from "./services/finalInvoiceReport.service";
// Test Controller
import { TestController } from "./controllers/test.controller";
import { DashboardService } from "./services/dashboard.service";
import { DashboardController } from "./controllers/dashboard.controller";
const container = new Container();
//socket server
// Initialize Socket.IO server
//const io = new Server();
// Bind to the container
//container.bind<Server>(TYPES.SocketIoServer).toConstantValue(io);
// Define a helper function for repository binding
// // Initialize Socket.IO server
// const io = new SocketIOServer();
// // Bind to the container
// container.bind<SocketIOServer>(TYPES.SocketIoServerOne).toConstantValue(io);

container.bind<DataSource>(TYPES.DataSource).toConstantValue(AppDataSource);

// ----- User-related bindings -----


container
  .bind<UserController>(TYPES.UserController)
  .to(UserController)
  .inSingletonScope();
container
  .bind<UserService>(TYPES.UserService)
  .to(UserService)
  .inSingletonScope();

    // Assuming TYPES.BillingDetailsCustRepository is a symbol or string used to identify the repository
container.bind<UserRepository>(TYPES.UserRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(User).extend(UserRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements

container
  .bind<AuthController>(TYPES.AuthController)
  .to(AuthController)
  .inSingletonScope();
 
//-------------------------------------------vendor-Category-----------------------------//
// Bind your services and repositories
// Bind DataSource (make sure to initialize it somewhere in your code)
//container.bind<DataSource>(TYPES.DataSource).toConstantValue(AppDataSource);
//address
// container
//   .bind<AddressRepository>(TYPES.AddressRepository)
//   .to(AddressRepository)
//   .inSingletonScope();
// Assuming TYPES.BankDetailsCustRepository is a symbol or string used to identify the repository
container.bind<AddressRepository>(TYPES.AddressRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(Address).extend(AddressRepository);
}).inRequestScope()
  container
  .bind<AddressController>(TYPES.AddressController)
  .to(AddressController)
  .inSingletonScope();
  container
  .bind<AddressService>(TYPES.AddressService)
  .to(AddressService)
  .inSingletonScope();

  //vendor category
 // Assuming TYPES.BillingDetailsCustRepository is a symbol or string used to identify the repository
 container.bind<VendorCategoryRepository>(TYPES.VendorCategoryRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(VendorCategory).extend(VendorCategoryRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements

container
  .bind<VendorCategoryController>(TYPES.VendorCategoryController)
  .to(VendorCategoryController)
  .inSingletonScope();
  container
  .bind<VendorCategoryService>(TYPES.VendorCategoryService)
  .to(VendorCategoryService)
  .inSingletonScope();

//---------------vendorSubcategory-------------------------------
container
  .bind<VendorSubcategoryService>(TYPES.VendorSubcategoryService)
  .to(VendorSubcategoryService)
  .inSingletonScope();
   // Assuming TYPES.BillingDetailsCustRepository is a symbol or string used to identify the repository
container.bind<VendorSubcategoryRepository>(TYPES.VendorSubcategoryRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(VendorSubcategory).extend(VendorSubcategoryRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements

container
  .bind<VendorSubcategoryController>(TYPES.VendorSubcategoryController)
  .to(VendorSubcategoryController)
  .inSingletonScope();

//------------------Vendor------------------------------------------
container
  .bind<VendorService>(TYPES.VendorService)
  .to(VendorService)
  .inSingletonScope();
// container
//   .bind<VendorRepository>(TYPES.VendorRepository)
//   .to(VendorRepository)
//   .inSingletonScope();
  // Assuming TYPES.BillingDetailsCustRepository is a symbol or string used to identify the repository
container.bind<VendorRepository>(TYPES.VendorRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(Vendor).extend(VendorRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container
  .bind<VendorController>(TYPES.VendorController)
  .to(VendorController)
  .inSingletonScope();

//---------------------------Customer------------------------
container
  .bind<CustomerService>(TYPES.CustomerService)
  .to(CustomerService)
  .inSingletonScope();
// container
//   .bind<CustomerRepository>(TYPES.CustomerRepository)
//   .to(CustomerRepository)
//   .inSingletonScope();

  container.bind<CustomerRepository>(TYPES.CustomerRepository).toDynamicValue((context) => {
    const dataSource = context.container.get<DataSource>(TYPES.DataSource);
    return dataSource.getRepository(Customer).extend(CustomerRepository);
  }).inRequestScope();
container
  .bind<CustomerController>(TYPES.CustomerController)
  .to(CustomerController)
  .inSingletonScope();

//---------------------------CustomerType------------------------
container
  .bind<CustomerTypeService>(TYPES.CustomerTypeService)
  .to(CustomerTypeService)
  .inSingletonScope();
container
  .bind<CustomerTypeRepository>(TYPES.CustomerTypeRepository)
  .to(CustomerTypeRepository)
  .inSingletonScope();
container
  .bind<CustomerTypeController>(TYPES.CustomerTypeController)
  .to(CustomerTypeController)
  .inSingletonScope();

//-----------------CustomerCategory-----------------

container
  .bind<CustomerCategoryService>(TYPES.CustomerCategoryService)
  .to(CustomerCategoryService)
  .inSingletonScope();
container
  .bind<CustomerCategoryRepository>(TYPES.CustomerCategoryRepository)
  .to(CustomerCategoryRepository)
  .inSingletonScope();
container
  .bind<CustomerCategoryController>(TYPES.CustomerCategoryController)
  .to(CustomerCategoryController)
  .inSingletonScope();

//----------------------Farmer-----------------------------

container
  .bind<FarmerService>(TYPES.FarmerService)
  .to(FarmerService)
  .inSingletonScope();

  container.bind<FarmerRepository>(TYPES.FarmerRepository).toDynamicValue((context) => {
    const dataSource = context.container.get<DataSource>(TYPES.DataSource);
    return dataSource.getRepository(Farmer).extend(FarmerRepository);
  }).inRequestScope(); // or .singletonScope() depending on your scope requirements
container
  .bind<FarmerController>(TYPES.FarmerController)
  .to(FarmerController)
  .inSingletonScope();
//----------------------Crop-----------------------------




  container.bind<CropRepository>(TYPES.CropRepository).toDynamicValue((context) => {
    const dataSource = context.container.get<DataSource>(TYPES.DataSource);
    return dataSource.getRepository(Crop).extend(CropRepository);
  }).inRequestScope(); // or .singletonScope() depending on your scope requirements
  


//------------------------UOMconversionMatrix-----------------------------
container
  .bind<UOMConversionMatrixService>(TYPES.UOMConversionMatrixService)
  .to(UOMConversionMatrixService)
  .inSingletonScope();
container
  .bind<UOMConversionMatrixRepository>(TYPES.UOMConversionMatrixRepository)
  .to(UOMConversionMatrixRepository)
  .inSingletonScope();
container
  .bind<UOMConversionMatrixController>(TYPES.UOMConversionMatrixController)
  .to(UOMConversionMatrixController)
  .inSingletonScope();

//------------------------UOM-----------------------------------

container.bind<UOMRepository>(TYPES.UOMRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(UOM).extend(UOMRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<UOMService>(TYPES.UOMService).to(UOMService);
container.bind<UOMController>(TYPES.UOMController).to(UOMController);

//----------------------Product_Category-------------------------
container
  .bind<ProductCategoryService>(TYPES.ProductCategoryService)
  .to(ProductCategoryService)
  .inSingletonScope();

  container.bind<ProductCategoryRepository>(TYPES.ProductCategoryRepository).toDynamicValue((context) => {
    const dataSource = context.container.get<DataSource>(TYPES.DataSource);
    return dataSource.getRepository(ProductCategory).extend(ProductCategoryRepository);
  }).inRequestScope(); // or .singletonScope() depending on your scope requirements
container
  .bind<ProductCategoryController>(TYPES.ProductCategoryController)
  .to(ProductCategoryController)
  .inSingletonScope();

//----------------------------Product_Subcategory------------
container
  .bind<ProductSubcategoryService>(TYPES.ProductSubcategoryService)
  .to(ProductSubcategoryService)
  .inSingletonScope();
container
  .bind<ProductSubcategoryRepository>(TYPES.ProductSubcategoryRepository)
  .to(ProductSubcategoryRepository)
  .inSingletonScope();
container
  .bind<ProductSubcategoryController>(TYPES.ProductSubcategoryController)
  .to(ProductSubcategoryController);

//----------------------------Product---------------------------------------

container.bind<ProductService>(TYPES.ProductService).to(ProductService);



  container.bind<ProductRepository>(TYPES.ProductRepository).toDynamicValue((context) => {
    const dataSource = context.container.get<DataSource>(TYPES.DataSource);
    return dataSource.getRepository(Product).extend(ProductRepository);
  }).inRequestScope(); // or .singletonScope() depending on your scope requirements

container
  .bind<ProductController>(TYPES.ProductController)
  .to(ProductController);


 

//-------------------------driver------------------------------
container.bind<DriversService>(TYPES.DriversService).to(DriversService);
container.bind<DriverRepository>(TYPES.DriverRepository).to(DriverRepository).inSingletonScope();
container.bind<DriverController>(TYPES.DriverController).to(DriverController).inSingletonScope();
//-------------------------------productclassfication------------------------------
container.bind<ProductClassificationService>(TYPES.ProductClassificationService).to(ProductClassificationService);
container.bind<ProductClassificationController>(TYPES.ProductClassificationController).to(ProductClassificationController);

container.bind<ProductClassificationRepository>(TYPES.ProductClassificationRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(ProductClassification).extend(ProductClassificationRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements


//--------------------------bank-detailscust-----------
// container.bind(TYPES.BankDetailsCustRepository).toDynamicValue((context) => {
//   const dataSource = context.container.get<DataSource>(TYPES.DataSource);
//   return dataSource.getRepository(BankDetailsCustRepository);
// });
// Assuming TYPES.BankDetailsCustRepository is a symbol or string used to identify the repository
container.bind<BankDetailsCustRepository>(TYPES.BankDetailsCustRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(BankDetailsCust).extend(BankDetailsCustRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
//container.bind<BankDetailsCustRepository>(TYPES.BankDetailsCustRepository).to(BankDetailsCustRepository);


//-----------------------------------billingDetailsCust----------------------------
// Assuming TYPES.BillingDetailsCustRepository is a symbol or string used to identify the repository
container.bind<BillingDetailsCustRepository>(TYPES.BillingDetailsCustRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(BillingDetailsCust).extend(BillingDetailsCustRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements



// Assuming TYPES.BillingDetailsCustRepository is a symbol or string used to identify the repository
container.bind<BranchessRepository>(TYPES.BranchessRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(Branches).extend(BranchessRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements

container.bind<BranchessService>(TYPES.BranchessService).to(BranchessService);
container.bind<BranchessController>(TYPES.BranchessController).to(BranchessController);

// Assuming TYPES.BillingDetailsCustRepository is a symbol or string used to identify the repository
container.bind<OfficesRepository>(TYPES.OfficesRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(OfficesData).extend(OfficesRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements

container.bind<OfficesService>(TYPES.OfficesService).to(OfficesService);
container.bind<OfficesController>(TYPES.OfficesController).to(OfficesController);
//----------------------------deliveryDetailsCust---------------
container.bind<DeliveryDetailsCustRepository>(TYPES.DeliveryDetailsCustRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(DeliveryDetails).extend(DeliveryDetailsCustRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements

container.bind<DeliveryDetailsCustService>(TYPES.DeliveryDetailsCustService).to(DeliveryDetailsCustService);
container.bind<DeliveryDetailsCustController>(TYPES.DeliveryDetailsCustController).to(DeliveryDetailsCustController);

//----------------------------statutorydetailsCust---------------
container.bind<StatutoryDetailsCustRepository>(TYPES.StatutoryDetailsCustRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(StatutoryDetails).extend(StatutoryDetailsCustRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements

container.bind<StatutoryDetailsCustService>(TYPES.StatutoryDetailsCustService).to(StatutoryDetailsCustService);
container.bind<StatutoryDetailsCustController>(TYPES.StatutoryDetailsCustController).to(StatutoryDetailsCustController);

//---------------------------payment_terms_customer---------------------------------
// Assuming TYPES.paymentTermsRepository is a symbol or string used to identify the repository
container.bind<PaymentTermsRepository>(TYPES.PaymentTermsRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(PaymentTerms).extend(PaymentTermsRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<PaymentTermsService>(TYPES.PaymentTermsService).to(PaymentTermsService)
//----------------------------productSpecificationCust---------------
container.bind<ProductSpecificationCustRepository>(TYPES.ProductSpecificationCustRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(ProductSpecification).extend(ProductSpecificationCustRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements


//--------------------------------keyMobileNumber-----------------------------------------
container.bind<KeyMobileNoDataRepository>(TYPES.KeyMobileNoDataRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(keyMobileNoData).extend(KeyMobileNoDataRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements

container.bind<KeyMobileNoDataService>(TYPES.KeyMobileNoDataService).to(KeyMobileNoDataService);
//---------------------------bankdetailsvend---------------------------------
// Assuming TYPES.BankDetailsvendRepository is a symbol or string used to identify the repository
container.bind<BankDetailsvendRepository>(TYPES.BankDetailsvendRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(BankDetailsvend).extend(BankDetailsvendRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<BankDetailsvendService>(TYPES.BankDetailsvendService).to(BankDetailsvendService)
//-------------------------------------vendor_sale_info----------------------
// Assuming TYPES.VendorSaleInfoRepository is a symbol or string used to identify the repository
container.bind<VendorSaleInfoRepository>(TYPES.VendorSaleInfoRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(VendorSaleInfo).extend(VendorSaleInfoRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<VendorSaleInfoService>(TYPES.VendorSaleInfoService).to(VendorSaleInfoService)

//-------------------------------------rfpa----------------------
// Assuming TYPES.VendorSaleInfoRepository is a symbol or string used to identify the repository
container.bind<RfpaRepository>(TYPES.RfpaRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(RFPA).extend(RfpaRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<RfpaService>(TYPES.RfpaService).to(RfpaService);
container.bind< RfpaController>(TYPES.RfpaController).to( RfpaController);

//-------------------------------------deal-slip----------------------
// Assuming TYPES.VendorSaleInfoRepository is a symbol or string used to identify the repository
container.bind<DealSlipRepository>(TYPES.DealSlipRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(DealSlip).extend(DealSlipRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<DealSlipService>(TYPES.DealSlipService).to(DealSlipService);
container.bind<DealSlipController>(TYPES.DealSlipController).to( DealSlipController);

//----------------------------------Grn---------------------------------
container.bind<GrnRepository>(TYPES.GrnRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(GRN).extend(GrnRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<GrnService>(TYPES.GrnService).to(GrnService);
container.bind<GrnController>(TYPES.GrnController).to(GrnController);
container.bind<GrnReportService>(TYPES.GrnReportService).to(GrnReportService);
container.bind<GrnReportController>(TYPES.GrnReportController).to(GrnReportController);

//----------------------------------Delivery Challan Report---------------------------------
container.bind<DeliveryChallanReportService>(TYPES.DeliveryChallanReportService).to(DeliveryChallanReportService);
container.bind<DeliveryChallanReportController>(TYPES.DeliveryChallanReportController).to(DeliveryChallanReportController);
//------------------------------GrnProduct---------------------------
container.bind<GrnProductRepository>(TYPES.GrnProductRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(GrnProduct).extend(GrnProductRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<GrnProductService>(TYPES.GrnProductService).to(GrnProductService);


//-----------------------------nofication-----------------------------------------
container.bind<NotificationRepository>(TYPES.NotificationRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(Notification).extend(NotificationRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<NotificationService>(TYPES.NotificationService).to(NotificationService);
container.bind<NotificationController>(TYPES.NotificationController).to(NotificationController);

//-------------------------------transport_Payment_Voucher-------------------------------
container.bind<TPVoucherRepository>(TYPES.TPVoucherRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(TPVoucher).extend(TPVoucherRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<TPVoucherService>(TYPES.TPVoucherService).to(TPVoucherService).inSingletonScope();
container.bind<TPVoucherController>(TYPES.TPVoucherController).to(TPVoucherController).inSingletonScope();


//-------------------------------packing_material_Payment_Voucher-------------------------------
container.bind<PMPVoucherRepository>(TYPES.PMPVoucherRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(PMPVoucher).extend(PMPVoucherRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<PMPVoucherService>(TYPES.PMPVoucherService).to(PMPVoucherService).inSingletonScope();
container.bind<PMPVoucherController>(TYPES.PMPVoucherController).to(PMPVoucherController).inSingletonScope();

//-------------------------------multiCash_Payment_Voucher-------------------------------
container.bind<MultiCashVoucherRepository>(TYPES.MultiCashVoucherRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(CashVoucher).extend(MultiCashVoucherRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<MultiCashVoucherService>(TYPES.MultiCashVoucherService).to(MultiCashVoucherService);
container.bind<MultiCashVoucherController>(TYPES.MultiCashVoucherController).to(MultiCashVoucherController);


//--------------------------------------labour payment voucher--------------------
container.bind<LabourPaymentVoucherRepository>(TYPES.LabourPaymentVoucherRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(LPVoucher).extend(LabourPaymentVoucherRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<LabourPaymentVoucherService>(TYPES.LabourPaymentVoucherService).to(LabourPaymentVoucherService);
container.bind<LabourPaymentVoucherController>(TYPES.LabourPaymentVoucherController).to(LabourPaymentVoucherController);


//--------------------------------------Approval level --------------------
container.bind<ApprovalLevelRepository>(TYPES.ApprovalLevelRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(ApprovalLevel).extend(ApprovalLevelRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<ApprovalLevelService>(TYPES.ApprovalLevelService).to(ApprovalLevelService);
container.bind<ApprovalLevelController>(TYPES.ApprovalLevelController).to(ApprovalLevelController);

//--------------------------------------delivery challan --------------------
container.bind<DeliveryChallanRepository>(TYPES.DeliveryChallanRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository( DeliveryChallanPurchase).extend(DeliveryChallanRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<DeliveryChallanService>(TYPES.DeliveryChallanService).to(DeliveryChallanService);
container.bind< DeliveryChallanController>(TYPES. DeliveryChallanController).to( DeliveryChallanController);
container.bind<DitemRepository>(TYPES.DitemRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository( Item).extend(DitemRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements

//------------------customer delivery challan-------------------------
container.bind<CustomerDeliveryChallanRepository>(TYPES.CustomerDeliveryChallanRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(CustomerDeliveryChallan).extend(CustomerDeliveryChallanRepository);
}).inRequestScope(); 
container.bind<CustomerDeliveryChallanService>(TYPES.CustomerDeliveryChallanService).to(CustomerDeliveryChallanService);
container.bind<CustomerDeliveryChallanController>(TYPES.CustomerDeliveryChallanController).to( CustomerDeliveryChallanController);
//-----------------------tranfer delivery challan-----------------------
container.bind< StockTransferDeliveryChallanRepository>(TYPES. StockTransferDeliveryChallanRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(StockTransferDeliveryChallan).extend( StockTransferDeliveryChallanRepository);
}).inRequestScope(); 
container.bind<StockTransferDeliveryChallanService>(TYPES.StockTransferDeliveryChallanService).to(StockTransferDeliveryChallanService);
container.bind<StockTranferDeliveryChallanController>(TYPES.StockTranferDeliveryChallanController).to(StockTranferDeliveryChallanController);
//----------------------------other  delivery challan-------
container.bind< OtherDeliveryChallanRepository>(TYPES.OtherDeliveryChallanRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(OtherDeliveryChallan).extend(OtherDeliveryChallanRepository);
}).inRequestScope(); 
container.bind<OtherDeliveryChallanService>(TYPES.OtherDeliveryChallanService).to(OtherDeliveryChallanService);
container.bind<OtherDeliveryChallanController>(TYPES.OtherDeliveryChallanController).to(OtherDeliveryChallanController);
//--------------------------------------payment request----------------------------------------
container.bind<PaymentRequestRepository>(TYPES.PaymentRequestRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(PaymentRequest).extend(PaymentRequestRepository);
}).inRequestScope(); 
container.bind<PaymentRequestService>(TYPES.PaymentRequestService).to(PaymentRequestService).inSingletonScope();
container.bind<PaymentRequestController>(TYPES.PaymentRequestController ).to(PaymentRequestController ).inSingletonScope();
//-----------------------------auditlog---------------------------------------
container.bind<AuditLogRepository>(TYPES.AuditLogRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(AuditLog).extend(AuditLogRepository);
}).inRequestScope(); 
container.bind< AuditLogService>(TYPES. AuditLogService).to(AuditLogService).inSingletonScope();
container.bind< AuditLogController>(TYPES.AuditLogController ).to(AuditLogController).inSingletonScope();

//-----------------------------userSystemInfo---------------------------------------
container.bind<UserSystemInfoRepository>(TYPES.UserSystemInfoRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository( SystemLog).extend(UserSystemInfoRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
//container.bind<UserSystemInfoService>(TYPES.UserSystemInfoService).to(UserSystemInfoService);

//-----------------------------RequestForApprove---------------------------------------
container.bind<RequestsRepository>(TYPES.RequestsRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(Requests).extend(RequestsRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<RequestsService>(TYPES.RequestsService).to(RequestsService).inSingletonScope();

//--------------------------------levels -----------------------------------------

container.bind<LevelsRepository>(TYPES.LevelsRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(Levels).extend(LevelsRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<LevelsService>(TYPES.LevelsService).to(LevelsService).inSingletonScope();
container.bind<LevelsController>(TYPES.LevelsController ).to(LevelsController ).inSingletonScope();
//------------------------------InwardRegister--------------------------------
container.bind<InwardRepository>(TYPES.InwardRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(InwardRegister).extend(InwardRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<InwardRegisterService>(TYPES.InwardRegisterService).to(InwardRegisterService).inSingletonScope();
container.bind<InwardRegisterController>(TYPES.InwardRegisterController).to(InwardRegisterController).inSingletonScope();
//-----------------------------department for approve -------------------------------
container.bind<DepartmentforApproveRepository>(TYPES.DepartmentforApproveRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(Departments).extend(DepartmentforApproveRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<DepartmentforApproveService>(TYPES.DepartmentforApproveService).to(DepartmentforApproveService).inSingletonScope();
container.bind<DepartmentforApproveController>(TYPES.DepartmentforApproveController).to(DepartmentforApproveController).inSingletonScope();

//------------------------------------labour-register-----------------------------------------
container.bind<LaborRegisterRepository>(TYPES.LaborRegisterRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(LaborRegister).extend(LaborRegisterRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<LaborRegisterService>(TYPES.LaborRegisterService).to(LaborRegisterService).inSingletonScope();
container.bind<LaborRegisterController>(TYPES.LaborRegisterController).to(LaborRegisterController).inSingletonScope();


//------------------------------------labour-Attendances-----------------------------------------
container.bind<LaborAttendancesRepository>(TYPES.LaborAttendancesRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(LaborAttendance).extend(LaborAttendancesRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<LaborAttendancesService>(TYPES.LaborAttendancesService).to(LaborAttendancesService).inSingletonScope();
container.bind<LaborAttendancesController>(TYPES.LaborAttendancesController).to(LaborAttendancesController).inSingletonScope();

///-------------------------------------------------labor main----------------
container.bind<LaborRepository>(TYPES. LaborRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(Labor).extend(LaborRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<LaborService>(TYPES.LaborService).to(LaborService).inSingletonScope();
container.bind< LaborController>(TYPES. LaborController).to( LaborController).inSingletonScope();


//dump register
container.bind<DumpRegisterRepository>(TYPES.DumpRegisterRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(DumpRegister).extend(DumpRegisterRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<DumpRegisterService>(TYPES.DumpRegisterService).to(DumpRegisterService).inSingletonScope();
container.bind< DumpRegisterController>(TYPES.DumpRegisterController).to( DumpRegisterController).inSingletonScope();
//dump product
container.bind<DumpProductRepository>(TYPES.DumpProductRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(DumpProduct).extend(DumpProductRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
// //dump summary
// container.bind<DumpSummaryRepository>(TYPES.DumpSummaryRepository).toDynamicValue((context) => {
//   const dataSource = context.container.get<DataSource>(TYPES.DataSource);
//   return dataSource.getRepository(DumpSummary).extend(DumpSummaryRepository);
// }).inRequestScope(); // or .singletonScope() depending on your scope requirements

//SKU Eod Stock
container.bind<SkuEodRepository>(TYPES.SkuEodRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(SkuEodReport).extend( SkuEodRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<SKUEodStockService>(TYPES.SKUEodStockService).to(SKUEodStockService).inSingletonScope();
container.bind<SkuEodStockController>(TYPES.SkuEodStockController).to(SkuEodStockController).inSingletonScope();


//Eod Stock
container.bind<EodRepository>(TYPES.EodRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(StockReportEod).extend(EodRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<EodStockService>(TYPES.EodStockService).to(EodStockService).inSingletonScope();
container.bind<EodStockController>(TYPES.EodStockController).to(EodStockController).inSingletonScope();
//reportingManager

//vehicle dispatch 
container.bind<VehicleDispatchRepository>(TYPES.VehicleDispatchRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(VehicleDispatch).extend(VehicleDispatchRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<VehicleDispatchService>(TYPES.VehicleDispatchService).to(VehicleDispatchService).inSingletonScope();
container.bind< VehicleDispatchController>(TYPES.VehicleDispatchController).to( VehicleDispatchController).inSingletonScope();

//Aqr
container.bind<AqrRepository>(TYPES. AqrRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(Aqr).extend( AqrRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<AqrService>(TYPES.AqrService).to(AqrService).inSingletonScope();
container.bind<AqrController>(TYPES.AqrController).to( AqrController).inSingletonScope();

//quality parameter
container.bind<QualityParameterRepository>(TYPES.QualityParameterRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(QualityParameter).extend(QualityParameterRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements


//secondSale
container.bind<SecondSaleRepository>(TYPES.SecondSaleRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(SecondSale).extend(SecondSaleRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<SecondSaleService>(TYPES.SecondSaleService).to(SecondSaleService).inSingletonScope();
container.bind<SecondSaleController>(TYPES.SecondSaleController).to(SecondSaleController).inSingletonScope();
//secondsale product
container.bind<SecondSaleProductRepository >(TYPES.SecondSaleProductRepository ).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(SecondSaleProduct).extend(SecondSaleProductRepository );
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
//dailyInwardSummary







//sale order
container.bind<SaleOrderRepository>(TYPES.SaleOrderRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(SaleOrder).extend(SaleOrderRepository);
}).inRequestScope(); 
container.bind<SaleOrderService>(TYPES.SaleOrderService).to(SaleOrderService).inSingletonScope();
container.bind<SaleOrderController>(TYPES.SaleOrderController).to(SaleOrderController).inSingletonScope()

//invoice
container.bind<InvoiceRepository>(TYPES.InvoiceRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(Invoice).extend(InvoiceRepository);
}).inRequestScope(); 
container.bind<InvoiceProductRepository>(TYPES.InvoiceProductRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(InvoiceProduct).extend(InvoiceProductRepository);
}).inRequestScope(); 


//returnByCustomer
container.bind<PostReturnByCustomerRepository>(TYPES.PostReturnByCustomerRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(PostReturnByCustomer).extend(PostReturnByCustomerRepository);
}).inRequestScope(); 
container.bind<PostReturnByCustomerService>(TYPES.PostReturnByCustomerService).to(PostReturnByCustomerService).inSingletonScope();
container.bind<PostReturnByCustomerController>(TYPES.ReturnByCustomerController).to(PostReturnByCustomerController).inSingletonScope();
//return product by customer
container.bind<ReturnedProductsRepository>(TYPES.ReturnedProductsRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(ReturnedProducts).extend(ReturnedProductsRepository);
}).inRequestScope();
//pdfgebnerator
container.bind<PdfGeneratorService>(TYPES.PdfGeneratorService).to(PdfGeneratorService).inSingletonScope();
//company
container.bind<CompanyRepository>(TYPES.CompanyRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(Company).extend(CompanyRepository);
}).inRequestScope(); // or .singletonScope() depending on your scope requirements
container.bind<CompanyService>(TYPES.CompanyService).to(CompanyService).inSingletonScope();
container.bind<CompanyController>(TYPES.CompanyController).to(CompanyController).inSingletonScope();
//procurmentDashboard
container.bind<ProcurmentDashService>(TYPES.ProcurmentDashService).to(ProcurmentDashService).inSingletonScope();
container.bind< ProcurmentDashController >(TYPES. ProcurmentDashController ).to( ProcurmentDashController ).inSingletonScope();

//managementDashboard
container.bind<ManagementDashService>(TYPES.ManagementDashService).to(ManagementDashService).inSingletonScope();
container.bind< ManagementDashController >(TYPES.ManagementDashController ).to( ManagementDashController ).inSingletonScope();
//inventoryStock
container.bind<InventoryStockRepository>(TYPES.InventoryStockRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(InventoryStock).extend(InventoryStockRepository);
}).inRequestScope();


container.bind<InventoryStockController>(TYPES.InventoryStockController).to(InventoryStockController).inSingletonScope();
container.bind<InventoryStockService>(TYPES.InventoryStockService).to(InventoryStockService)


//product varient
container.bind<ProductVarientsRepository>(TYPES.ProductVarientsRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(ProductVarient).extend(ProductVarientsRepository);
}).inRequestScope(); 
container.bind<ProductVarientService>(TYPES.ProductVarientService).to(ProductVarientService).inSingletonScope();
container.bind<ProductVarientController>(TYPES.ProductVarientsController).to(ProductVarientController).inSingletonScope();
//packingmaterial
container.bind<PackingMaterialRepository>(TYPES.PackingMaterialRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(PackingMaterial).extend(PackingMaterialRepository);
}).inRequestScope(); 
container.bind< PackingMaterialService >(TYPES.PackingMaterialService ).to( PackingMaterialService ).inSingletonScope();
container.bind<PackingMaterialController>(TYPES.PackingMaterialController).to(PackingMaterialController).inSingletonScope();


//docuemntType
container.bind<DocumentDefinitionRepository>(TYPES.DocumentDefinitionRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(DocumentDefinition).extend(DocumentDefinitionRepository);
}).inRequestScope(); 
container.bind< DocumentDefinitionService >(TYPES.DocumentDefinitionService ).to( DocumentDefinitionService ).inSingletonScope();
container.bind<DocumentDefinitionController>(TYPES.DocumentDefinitionController).to(DocumentDefinitionController).inSingletonScope();

//documentPermission
container.bind<DocumentPermissionRepository>(TYPES.DocumentPermissionRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(DocumentPermission).extend(DocumentPermissionRepository);
}).inRequestScope(); 
container.bind<DocumentPermissionService>(TYPES.DocumentPermissionService ).to( DocumentPermissionService ).inSingletonScope();
container.bind<DocumentPermissionController>(TYPES.DocumentPermissionController).to(DocumentPermissionController).inSingletonScope();
//docuemnt
container.bind< DocumentbRepository>(TYPES. DocumentbRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository( Documentb ).extend( DocumentbRepository);
}).inRequestScope(); 
container.bind<DocumentbService>(TYPES.DocumentbService ).to(DocumentbService ).inSingletonScope();
container.bind<DocumentbController>(TYPES.DocumentbController).to(DocumentbController).inSingletonScope();


//APProvalFlow
container.bind<ApprovalFlowRepository>(TYPES.ApprovalFlowRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(ApprovalFlow ).extend(ApprovalFlowRepository);
}).inRequestScope(); 
container.bind<ApprovalFlowService>(TYPES.ApprovalFlowService ).to(ApprovalFlowService ).inSingletonScope();
container.bind<ApprovalFlowController>(TYPES.ApprovalFlowController).to(ApprovalFlowController).inSingletonScope();

//FinalizerBlock
container.bind<FinalizerBlockRepository>(TYPES.FinalizerBlockRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(FinalizerBlock ).extend(FinalizerBlockRepository);
}).inRequestScope(); 

//ApproverBlockRepository
container.bind<ApproverBlockRepository>(TYPES.ApproverBlockRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(ApproverBlock ).extend(ApproverBlockRepository);
}).inRequestScope(); 

//ApprovalStageInfoRepository
container.bind<ApprovalStageInfoRepository>(TYPES.ApprovalStageInfoRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(ApprovalStageInfo).extend(ApprovalStageInfoRepository);
}).inRequestScope();

//TODO: DocumentApproval
container.bind<DocumentApprovalFlowRepository>(TYPES.DocumentApprovalFlowRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(DocumentApprovalFlow).extend(DocumentApprovalFlowRepository);
}).inRequestScope();
//TODO: inwardProduct
container.bind<InwardProductRepository>(TYPES.InwardProductRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(InwardProduct).extend(InwardProductRepository);
}).inRequestScope();
//TODO: DocDoubleApproverService
container.bind<DocDoubleApproverService>(TYPES.DocDoubleApproverService).to(DocDoubleApproverService).inSingletonScope();

container.bind<DocSingalApproverService>(TYPES.DocSingalApproverService).to(DocSingalApproverService).inSingletonScope();
container.bind<AdminDashboardService>(TYPES.AdminDashboardService ).to( AdminDashboardService ).inSingletonScope();
container.bind<AdminDashboardController>(TYPES.AdminDashboardController).to(AdminDashboardController).inSingletonScope();

//productVarient

container.bind<ProductVarientRepository>(TYPES.ProductVarientRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(ProductVarient).extend(ProductVarientRepository);
}).inRequestScope();
container.bind<ProductVarientsService>(TYPES.ProductVarientsService).to(ProductVarientsService).inSingletonScope();
container.bind<VarientsController>(TYPES.VarientsController).to(VarientsController).inSingletonScope();
container.bind<ExcelController>(TYPES.ExcelController).to(ExcelController).inSingletonScope();
container.bind<ActiveSessionRepository>(TYPES.ActiveSessionRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(ActiveSession).extend(ActiveSessionRepository);
}).inRequestScope();

container.bind<UserReportService>(TYPES.UserReportService).to(UserReportService).inSingletonScope();
container.bind<UserReportController>(TYPES.UserReportController).to(UserReportController).inSingletonScope();
container.bind<SuperAdminController>(TYPES.SuperAdminController).to(SuperAdminController).inSingletonScope();
container.bind<SuperAdminService>(TYPES.SuperAdminService).to(SuperAdminService).inSingletonScope();


// Bind performance optimization services
container
  .bind<CacheService>(TYPES.CacheService)
  .to(CacheService)
  .inSingletonScope();

container
  .bind<QueryOptimizerService>(TYPES.QueryOptimizerService)
  .to(QueryOptimizerService)
  .inSingletonScope();

// Bind Crystal Report service
container
  .bind<CrystalReportService>(TYPES.CrystalReportService)
  .to(CrystalReportService)
  .inSingletonScope();



container
  .bind<ProcurementCrystalReportService>(TYPES.ProcurementCrystalReportService)
  .to(ProcurementCrystalReportService)
  .inSingletonScope();

container
  .bind<ProcurementCrystalReportController>(TYPES.ProcurementCrystalReportController)
  .to(ProcurementCrystalReportController)
  .inSingletonScope();



container
  .bind<SalesCrystalReportService>(TYPES.SalesCrystalReportService)
  .to(SalesCrystalReportService)
  .inSingletonScope();

container
  .bind<SalesCrystalReportController>(TYPES.SalesCrystalReportController)
  .to(SalesCrystalReportController)
  .inSingletonScope();



container
  .bind<SSEService>(TYPES.SSEService)
  .to(SSEService)
  .inSingletonScope();

container
  .bind<SSEController>(TYPES.SSEController)
  .to(SSEController)
  .inSingletonScope();

container
  .bind<SSEHelperService>(TYPES.SSEHelperService)
  .to(SSEHelperService)
  .inSingletonScope();



container
  .bind<TestController>(TYPES.TestController)
  .to(TestController)
  .inSingletonScope();



// import { RegistrationReportService } from "./services/registrationReport.service";
// import { RegistrationReportController } from "./controllers/registrationReport.controller";

container
  .bind<UserActivityLogRepository>(TYPES.UserActivityLogRepository)
  .toDynamicValue((context) => {
    return AppDataSource.getRepository(UserActivityLog).extend(
      UserActivityLogRepository.prototype
    );
  })
  .inRequestScope();

container
  .bind<UserActivityLogService>(TYPES.UserActivityLogService)
  .to(UserActivityLogService)
  .inSingletonScope();

// container
//   .bind<LogCleanupService>(TYPES.LogCleanupService)
//   .to(LogCleanupService)
//   .inSingletonScope();

container
  .bind<UserActivityLogController>(TYPES.UserActivityLogController)
  .to(UserActivityLogController)
  .inSingletonScope();

//workflow hirachy
  container.bind<WorkflowHierarchyRepository>(TYPES.WorkflowHierarchyRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(WorkflowHierarchy).extend(WorkflowHierarchyRepository);
}).inRequestScope(); 
container.bind< WorkflowHierarchyService>(TYPES.WorkflowHierarchyService ).to( WorkflowHierarchyService ).inSingletonScope();
container.bind<WorkflowHierarchyController>(TYPES.WorkflowHierarchyController).to(WorkflowHierarchyController).inSingletonScope();

//procurmentTarget
  container.bind<ProcurementTargetRepository>(TYPES.ProcurementTargetRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(ProcurementTarget).extend(ProcurementTargetRepository);
}).inRequestScope(); 
container.bind<ProcurementTargetService>(TYPES.ProcurementTargetService).to(ProcurementTargetService).inSingletonScope();
container.bind<ProcurementTargetController>(TYPES.ProcurementTargetController).to(ProcurementTargetController).inSingletonScope();
container.bind<ProcurementTargetProductRepository>(TYPES.ProcurementTargetProductRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(ProcurementTargetProduct).extend(ProcurementTargetProductRepository);
}).inRequestScope();
container.bind<ProcurementTargetWeekRepository>(TYPES.ProcurementTargetWeekRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(ProcurementTargetWeek).extend(ProcurementTargetWeekRepository);
}).inRequestScope();
container.bind<ProcurementTargetAchievementRepository>(TYPES.ProcurementTargetAchievementRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(ProcurementAchievement).extend(ProcurementTargetAchievementRepository);
}).inRequestScope();
//salesTarget
  container.bind<SalesTargetRepository>(TYPES.SalesTargetRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(SalesTarget).extend(SalesTargetRepository);
}).inRequestScope(); 
container.bind<SalesTargetService>(TYPES.SalesTargetService).to(SalesTargetService).inSingletonScope();
container.bind<SalesTargetController>(TYPES.SalesTargetController).to(SalesTargetController).inSingletonScope();
  container.bind<SalesTargetProductRepository>(TYPES.SalesTargetProductRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(SalesTargetProduct).extend(SalesTargetProductRepository);
}).inRequestScope(); 
 container.bind<SalesTargetWeekRepository>(TYPES.SalesTargetWeekRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(SalesTargetWeek).extend(SalesTargetWeekRepository);
}).inRequestScope();
 container.bind<SalesAchievementRepository>(TYPES.SalesAchievementRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(SalesAchievement).extend(SalesAchievementRepository);
}).inRequestScope();

// //dashboard
 container.bind<DashboardService>(TYPES.DashboardService).to(DashboardService).inSingletonScope();
container.bind<DashboardController>(TYPES.DashboardController).to(DashboardController).inSingletonScope();
// //registration report
container.bind<NewRegistrationService>(TYPES.NewRegistrationService).to(NewRegistrationService).inSingletonScope();
 container.bind<NewRegistrationController>(TYPES.NewRegistrationController).to(NewRegistrationController).inSingletonScope();

//report
container.bind<ReportService>(TYPES.ReportService).to(ReportService).inSingletonScope();
container.bind<SalesReportService>(TYPES.SalesReportService).to(SalesReportService).inSingletonScope();
container.bind<ReportController>(TYPES.ReportController).to(ReportController).inSingletonScope();
//paymentinfoforrfpa
container.bind<RfpaPaymentInfoRepository>(TYPES.RfpaPaymentInfoRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(PaymentInfoForRFPA).extend(RfpaPaymentInfoRepository);
}).inRequestScope();
  container.bind<ReturnToVendorService>(TYPES.ReturnToVendorService).to(ReturnToVendorService).inSingletonScope();
  container.bind<ReturnToVendorRepository>(TYPES.ReturnToVendorRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(ReturnToVendor).extend(ReturnToVendorRepository);
}).inRequestScope();
container.bind<ReturnToVendorController>(TYPES.ReturnToVendorController).to(ReturnToVendorController).inSingletonScope();
container.bind<FinalInvoiceService>(TYPES.FinalInvoiceService).to(FinalInvoiceService).inSingletonScope();
container.bind<FinalInvoiceController>(TYPES.FinalInvoiceController).to(FinalInvoiceController).inSingletonScope();
container.bind<FinalInvoiceReportService>(TYPES.FinalInvoiceReportService).to(FinalInvoiceReportService).inSingletonScope();
container.bind<FinalInvoiceReportController>(TYPES.FinalInvoiceReportController).to(FinalInvoiceReportController).inSingletonScope()

// role
container.bind<RoleRepository>(TYPES.RoleRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(Role).extend(RoleRepository);
}).inRequestScope();
container.bind<RoleService>(TYPES.RoleService).to(RoleService).inSingletonScope();
container.bind<RoleController>(TYPES.RoleController).to(RoleController).inSingletonScope();

// stockCorrection
container.bind<StockCorrectionRepository>(TYPES.StockCorrectionRepository).toDynamicValue((context) => {
  const dataSource = context.container.get<DataSource>(TYPES.DataSource);
  return dataSource.getRepository(StockCorrection).extend(StockCorrectionRepository);
}).inRequestScope();
container.bind<StockCorrectionService>(TYPES.StockCorrectionService).to(StockCorrectionService).inSingletonScope();
container.bind<StockCorrectionController>(TYPES.StockCorrectionController).to(StockCorrectionController).inSingletonScope();

export { container };
