# Bulk Controller Logging Update Guide

This guide shows how to quickly add logging to all controllers in the system.

## Controllers to Update

Based on your list, here are all the controllers that need logging:

1. ✅ **auth.controller.ts** - COMPLETED
2. ✅ **company.controller.ts** - COMPLETED  
3. ✅ **customer.controller.ts** - COMPLETED
4. ✅ **postReturnByCustomer.controller.ts** - COMPLETED
5. **branches.controller.ts**
6. **customerCategory.controller.ts**
7. **customerSubCategory.controller.ts**
8. **customerType.controller.ts**
9. **dealSlip.controller.ts**
10. **dumpRegister.controller.ts**
11. **eodStock.controller.ts**
12. **farmer.controller.ts**
13. **inwardRegister.controller.ts**
14. **labor.controller.ts**
15. **labourAttendances.controller.ts**
16. **labourPaymentVoucher.controller.ts**
17. **labourRegister.controller.ts**
18. **multiCashVoucher.controller.ts**
19. **offices.controller.ts**
20. **otherDeliveryChallan.controller.ts**
21. **stockTransferDeliveryChallan.controller.ts**
22. **customerDeliveryChallan.controller.ts**
23. **pmpVoucher.controller.ts**
24. **product.controller.ts**
25. **productCategory.controller.ts**
26. **productClassification.controller.ts**
27. **productSubCategory.controller.ts**
28. **rfpa.controller.ts**
29. **secondSale.controller.ts**
30. **transportPaymentVoucher.controller.ts**
31. **uom.controller.ts**
32. **uomConversionMatrix.controller.ts**
33. **user.controller.ts**
34. **vehicleDispatch.controller.ts**
35. **vendor.controller.ts**
36. **vendorCategory.controller.ts**
37. **vendorSubCategory.controller.ts**

## Quick Update Template

For each controller, follow these 4 steps:

### Step 1: Add Import
```typescript
// Add this import at the top
import { ControllerLogger } from '../utils/controllerLogger';
```

### Step 2: Ensure @request() Parameter
```typescript
// Make sure all methods have @request() req: Request
public async someMethod(
  @requestParam("id") id: string,
  @request() req: Request,  // ← Add this if missing
  @response() res: Response,
  @next() next: NextFunction
) {
```

### Step 3: Add Success Logging
```typescript
// For GET list operations
const results = await this.service.getAll();
ControllerLogger.logList('EntityName', req, res);
res.status(200).json({ status: 'success', data: results });

// For GET single item
const item = await this.service.getById(id);
ControllerLogger.logView('EntityName', id, req, res);
res.status(200).json({ status: 'success', data: item });

// For POST create operations
const newItem = await this.service.create(data);
ControllerLogger.logSuccess('EntityName created', newItem.id, req, res);
res.status(201).json({ status: 'success', data: newItem });

// For PATCH/PUT update operations
const updatedItem = await this.service.update(id, data);
ControllerLogger.logSuccess('EntityName updated', id, req, res);
res.status(200).json({ status: 'success', message: 'Updated successfully' });

// For DELETE operations
await this.service.delete(id);
ControllerLogger.logSuccess('EntityName deleted', id, req, res);
res.status(200).json({ status: 'success', message: 'Deleted successfully' });
```

### Step 4: Add Error Logging
```typescript
} catch (error) {
  ControllerLogger.logError('EntityName operation', error, req, res);
  next(error);
}
```

## Entity Name Mapping

Use these entity names for consistent logging:

| Controller | Entity Name |
|------------|-------------|
| branches.controller.ts | Branch |
| customerCategory.controller.ts | Customer Category |
| customerSubCategory.controller.ts | Customer Sub Category |
| customerType.controller.ts | Customer Type |
| dealSlip.controller.ts | Deal Slip |
| dumpRegister.controller.ts | Dump Register |
| eodStock.controller.ts | EOD Stock |
| farmer.controller.ts | Farmer |
| inwardRegister.controller.ts | Inward Register |
| labor.controller.ts | Labor |
| labourAttendances.controller.ts | Labour Attendance |
| labourPaymentVoucher.controller.ts | Labour Payment Voucher |
| labourRegister.controller.ts | Labour Register |
| multiCashVoucher.controller.ts | Multi Cash Voucher |
| offices.controller.ts | Office |
| otherDeliveryChallan.controller.ts | Other Delivery Challan |
| stockTransferDeliveryChallan.controller.ts | Stock Transfer Delivery Challan |
| customerDeliveryChallan.controller.ts | Customer Delivery Challan |
| pmpVoucher.controller.ts | PMP Voucher |
| product.controller.ts | Product |
| productCategory.controller.ts | Product Category |
| productClassification.controller.ts | Product Classification |
| productSubCategory.controller.ts | Product Sub Category |
| rfpa.controller.ts | RFPA |
| secondSale.controller.ts | Second Sale |
| transportPaymentVoucher.controller.ts | Transport Payment Voucher |
| uom.controller.ts | UOM |
| uomConversionMatrix.controller.ts | UOM Conversion Matrix |
| user.controller.ts | User |
| vehicleDispatch.controller.ts | Vehicle Dispatch |
| vendor.controller.ts | Vendor |
| vendorCategory.controller.ts | Vendor Category |
| vendorSubCategory.controller.ts | Vendor Sub Category |

## Business-Specific Methods Available

For specific business entities, you can use these specialized methods:

```typescript
// For Delivery Challan controllers
ControllerLogger.logDeliveryChallanCreated(challanId, req, res);
ControllerLogger.logDeliveryChallanUpdated(challanId, req, res);

// For GRN controllers  
ControllerLogger.logGrnCreated(grnId, req, res);
ControllerLogger.logGrnUpdated(grnId, req, res);

// For Invoice controllers
ControllerLogger.logInvoiceCreated(invoiceId, req, res);
ControllerLogger.logInvoiceUpdated(invoiceId, req, res);

// For EOD Stock controllers
ControllerLogger.logEodStockCreated(eodId, req, res);
ControllerLogger.logEodStockUpdated(eodId, req, res);

// For RFPA controllers
ControllerLogger.logRfpaCreated(rfpaId, req, res);
ControllerLogger.logRfpaUpdated(rfpaId, req, res);
ControllerLogger.logRfpaViewed(rfpaId, req, res);

// For approval operations
ControllerLogger.logApprovalAction('approved', 'EntityName', entityId, req, res);

// For export operations
ControllerLogger.logDataExport('EntityName Export', req, res);

// For report generation
ControllerLogger.logReportGenerated('EntityName Report', req, res);
```

## Example: Complete Controller Update

Here's a complete example showing how to update the `branches.controller.ts`:

```typescript
import { inject } from 'inversify';
import { controller, httpGet, httpPost, httpPatch, httpDelete, request, response, requestParam, requestBody, next } from 'inversify-express-utils';
import { Request, Response, NextFunction } from 'express';
import { TYPES } from '../types';
import { BranchService } from '../services/branch.service';
import { ControllerLogger } from '../utils/controllerLogger';  // ← Step 1: Add import
import AppError from '../utils/appError';

@controller('/branches')
export class BranchController {
  constructor(
    @inject(TYPES.BranchService)
    private branchService: BranchService
  ) {}

  @httpGet('/')
  public async getAllBranches(
    @request() req: Request,  // ← Step 2: Ensure @request() parameter
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const branches = await this.branchService.getAll();
      
      ControllerLogger.logList('Branch', req, res);  // ← Step 3: Add success logging
      
      res.status(200).json({
        status: 'success',
        data: branches,
      });
    } catch (error) {
      ControllerLogger.logError('Branch list retrieval', error, req, res);  // ← Step 4: Add error logging
      next(error);
    }
  }

  @httpPost('/')
  public async createBranch(
    @requestBody() data: any,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const newBranch = await this.branchService.create(data);
      
      ControllerLogger.logSuccess('Branch created', newBranch.id, req, res);
      
      res.status(201).json({
        status: 'success',
        data: newBranch,
      });
    } catch (error) {
      ControllerLogger.logError('Branch creation', error, req, res);
      next(error);
    }
  }

  @httpGet('/:id')
  public async getBranchById(
    @requestParam('id') id: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const branch = await this.branchService.getById(id);
      
      if (!branch) {
        return next(new AppError(404, 'Branch not found'));
      }
      
      ControllerLogger.logView('Branch', id, req, res);
      
      res.status(200).json({
        status: 'success',
        data: branch,
      });
    } catch (error) {
      ControllerLogger.logError('Branch view', error, req, res);
      next(error);
    }
  }

  @httpPatch('/:id')
  public async updateBranch(
    @requestParam('id') id: string,
    @requestBody() data: any,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const updatedBranch = await this.branchService.update(id, data);
      
      if (!updatedBranch) {
        ControllerLogger.logError('Branch update', new Error('Branch not found'), req, res);
        return next(new AppError(404, 'Branch not found'));
      }
      
      ControllerLogger.logSuccess('Branch updated', id, req, res);
      
      res.status(200).json({
        status: 'success',
        message: 'Branch updated successfully',
      });
    } catch (error) {
      ControllerLogger.logError('Branch update', error, req, res);
      next(error);
    }
  }

  @httpDelete('/:id')
  public async deleteBranch(
    @requestParam('id') id: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const deleted = await this.branchService.delete(id);
      
      if (!deleted) {
        ControllerLogger.logError('Branch deletion', new Error('Branch not found'), req, res);
        return next(new AppError(404, 'Branch not found'));
      }
      
      ControllerLogger.logSuccess('Branch deleted', id, req, res);
      
      res.status(200).json({
        status: 'success',
        message: 'Branch deleted successfully',
      });
    } catch (error) {
      ControllerLogger.logError('Branch deletion', error, req, res);
      next(error);
    }
  }
}
```

## Expected Log Output

After updating all controllers, you'll see logs like:

```
2025-12-05 12:27:16 PM [info-sagar pagar]: Branch list retrieved successfully [IP: 182.156.141.17]
2025-12-05 12:28:30 PM [info-madhuri]: Customer created successfully with ID: cust123 [IP: 192.168.1.100]
2025-12-05 12:29:45 PM [info-john doe]: Product viewed successfully with ID: prod456 [IP: 10.0.0.50]
2025-12-05 12:30:15 PM [info-admin]: Vendor updated successfully with ID: vend789 [IP: 203.0.113.45]
2025-12-05 12:31:00 PM [info-user]: EOD Stock created successfully with ID: eod101 [IP: 172.16.0.1]
```

## Automation Script

You can use this PowerShell script to help automate the import addition:

```powershell
# PowerShell script to add ControllerLogger import to all controllers
$controllers = @(
    "branches.controller.ts",
    "customerCategory.controller.ts",
    "customerSubCategory.controller.ts",
    # ... add all controller names
)

foreach ($controller in $controllers) {
    $path = "src/controllers/$controller"
    if (Test-Path $path) {
        $content = Get-Content $path -Raw
        if ($content -notmatch "ControllerLogger") {
            $content = $content -replace "(import.*from.*logger.*)", "`$1`nimport { ControllerLogger } from '../utils/controllerLogger';"
            Set-Content $path $content
            Write-Host "✅ Added ControllerLogger import to $controller"
        } else {
            Write-Host "⚠️  ControllerLogger already imported in $controller"
        }
    } else {
        Write-Host "❌ Controller not found: $controller"
    }
}
```

This guide provides everything needed to systematically add logging to all controllers in the system.