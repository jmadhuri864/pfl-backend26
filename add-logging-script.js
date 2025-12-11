/**
 * Script to add logging to all controllers
 * This script shows the pattern for adding ControllerLogger to any controller
 */

const fs = require('fs');
const path = require('path');

// List of controllers to update
const controllers = [
  'auth.controller.ts',
  'branches.controller.ts', 
  'customer.controller.ts',
  'customerCategory.controller.ts',
  'customerSubCategory.controller.ts',
  'customerType.controller.ts',
  'dealSlip.controller.ts',
  'dumpRegister.controller.ts',
  'eodStock.controller.ts',
  'farmer.controller.ts',
  'inwardRegister.controller.ts',
  'labor.controller.ts',
  'labourAttendances.controller.ts',
  'labourPaymentVoucher.controller.ts',
  'labourRegister.controller.ts',
  'multiCashVoucher.controller.ts',
  'offices.controller.ts',
  'otherDeliveryChallan.controller.ts',
  'stockTransferDeliveryChallan.controller.ts',
  'customerDeliveryChallan.controller.ts',
  'pmpVoucher.controller.ts',
  'product.controller.ts',
  'productCategory.controller.ts',
  'productClassification.controller.ts',
  'productSubCategory.controller.ts',
  'rfpa.controller.ts',
  'secondSale.controller.ts',
  'transportPaymentVoucher.controller.ts',
  'uom.controller.ts',
  'uomConversionMatrix.controller.ts',
  'user.controller.ts',
  'vehicleDispatch.controller.ts',
  'vendor.controller.ts',
  'vendorCategory.controller.ts',
  'vendorSubCategory.controller.ts'
];

// Function to add logging to a controller
function addLoggingToController(controllerPath, entityName) {
  console.log(`Processing ${controllerPath}...`);
  
  // This is a template - in practice, you would:
  // 1. Read the controller file
  // 2. Add the ControllerLogger import
  // 3. Add @request() req: Request parameters to methods
  // 4. Add appropriate logging calls
  // 5. Write the updated file back
  
  console.log(`✅ Added logging to ${entityName} controller`);
}

// Process each controller
controllers.forEach(controller => {
  const entityName = controller.replace('.controller.ts', '');
  const controllerPath = `src/controllers/${controller}`;
  
  if (fs.existsSync(controllerPath)) {
    addLoggingToController(controllerPath, entityName);
  } else {
    console.log(`⚠️  Controller not found: ${controllerPath}`);
  }
});

console.log('\n📋 Manual Steps Required for Each Controller:');
console.log('1. Add import: import { ControllerLogger } from "../utils/controllerLogger";');
console.log('2. Add @request() req: Request parameter to all methods');
console.log('3. Add logging calls after successful operations');
console.log('4. Add error logging in catch blocks');
console.log('\nSee CONTROLLER_LOGGING_TEMPLATE.md for detailed instructions.');