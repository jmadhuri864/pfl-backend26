# Controller Logging Template

This template shows how to add user-friendly logging with IP addresses to any controller.

## 1. Import the ControllerLogger

```typescript
import { ControllerLogger } from "../utils/controllerLogger";
```

## 2. Add @request() parameter to all methods

```typescript
// Before
public async someMethod(
  @requestParam("id") id: string,
  @response() res: Response,
  @next() next: NextFunction
) {

// After
public async someMethod(
  @requestParam("id") id: string,
  @request() req: Request,  // Add this
  @response() res: Response,
  @next() next: NextFunction
) {
```

## 3. Add logging calls based on operation type

### GET List Operations
```typescript
const results = await this.service.getAll(queryOptions, userId);

// Log the successful retrieval
ControllerLogger.logList("EntityName", req, res);

res.status(200).json({
  status: "success",
  data: results.data,
});
```

### GET Single Item (View)
```typescript
const item = await this.service.getById(id);
if (!item) {
  return next(new AppError(404, "Item not found"));
}

// Log the successful view
ControllerLogger.logView("EntityName", id, req, res);

res.status(200).json({
  status: "success",
  data: item,
});
```

### POST (Create) Operations
```typescript
const newItem = await this.service.create(data, requestedBy);

// Log the successful creation
ControllerLogger.logSuccess("EntityName created", newItem.id, req, res);
// OR use specific method:
// ControllerLogger.logDeliveryChallanCreated(newItem.id, req, res);

res.status(201).json({
  status: "success",
  data: newItem.id,
});
```

### PATCH/PUT (Update) Operations
```typescript
const updatedItem = await this.service.update(id, data, updatedBy);

if (!updatedItem) {
  ControllerLogger.logError("EntityName update", new Error("Item not found"), req, res);
  return next(new AppError(404, "Item not found"));
}

// Log the successful update
ControllerLogger.logSuccess("EntityName updated", id, req, res);
// OR use specific method:
// ControllerLogger.logDeliveryChallanUpdated(id, req, res);

res.status(200).json({
  status: "success",
  message: "Item updated successfully",
});
```

### DELETE Operations
```typescript
const deleted = await this.service.delete(id);

if (!deleted) {
  ControllerLogger.logError("EntityName deletion", new Error("Item not found"), req, res);
  return next(new AppError(404, "Item not found"));
}

// Log the successful deletion
ControllerLogger.logSuccess("EntityName deleted", id, req, res);

res.status(200).json({
  status: "success",
  message: "Item deleted successfully",
});
```

### Error Handling
```typescript
} catch (error) {
  ControllerLogger.logError("EntityName operation", error, req, res);
  next(error);
}
```

## 4. Available ControllerLogger Methods

### Generic Methods
- `ControllerLogger.logSuccess(operation, entityId, req, res)`
- `ControllerLogger.logView(entityName, entityId, req, res)`
- `ControllerLogger.logList(entityName, req, res)`
- `ControllerLogger.logError(operation, error, req, res)`
- `ControllerLogger.logAuth(action, req, res, success)`

### Business-Specific Methods
- `ControllerLogger.logRfpaCreated(rfpaId, req, res)`
- `ControllerLogger.logRfpaUpdated(rfpaId, req, res)`
- `ControllerLogger.logRfpaViewed(rfpaId, req, res)`
- `ControllerLogger.logDeliveryChallanCreated(challanId, req, res)`
- `ControllerLogger.logDeliveryChallanUpdated(challanId, req, res)`
- `ControllerLogger.logGrnCreated(grnId, req, res)`
- `ControllerLogger.logGrnUpdated(grnId, req, res)`
- `ControllerLogger.logInvoiceCreated(invoiceId, req, res)`
- `ControllerLogger.logInvoiceUpdated(invoiceId, req, res)`
- `ControllerLogger.logEodStockCreated(eodId, req, res)`
- `ControllerLogger.logEodStockUpdated(eodId, req, res)`
- `ControllerLogger.logApprovalAction(action, documentType, documentId, req, res)`
- `ControllerLogger.logDataExport(exportType, req, res)`
- `ControllerLogger.logReportGenerated(reportType, req, res)`

## 5. Complete Controller Example

```typescript
import { inject } from "inversify";
import { controller, httpGet, httpPost, httpPatch, request, response, requestParam, requestBody, next } from "inversify-express-utils";
import { Request, Response, NextFunction } from "express";
import { TYPES } from "../types";
import { SomeService } from "../services/some.service";
import { ControllerLogger } from "../utils/controllerLogger";
import AppError from "../utils/appError";

@controller("/some-entity")
export class SomeController {
  constructor(
    @inject(TYPES.SomeService)
    private someService: SomeService
  ) {}

  @httpGet("/")
  public async getAll(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const results = await this.someService.getAll();
      
      ControllerLogger.logList("SomeEntity", req, res);
      
      res.status(200).json({
        status: "success",
        data: results,
      });
    } catch (error) {
      ControllerLogger.logError("SomeEntity list retrieval", error, req, res);
      next(error);
    }
  }

  @httpGet("/:id")
  public async getById(
    @requestParam("id") id: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const item = await this.someService.getById(id);
      
      if (!item) {
        return next(new AppError(404, "Item not found"));
      }
      
      ControllerLogger.logView("SomeEntity", id, req, res);
      
      res.status(200).json({
        status: "success",
        data: item,
      });
    } catch (error) {
      ControllerLogger.logError("SomeEntity view", error, req, res);
      next(error);
    }
  }

  @httpPost("/")
  public async create(
    @requestBody() data: any,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const requestedBy = res.locals.user;
      const newItem = await this.someService.create(data, requestedBy);
      
      ControllerLogger.logSuccess("SomeEntity created", newItem.id, req, res);
      
      res.status(201).json({
        status: "success",
        data: newItem.id,
        message: "Item created successfully",
      });
    } catch (error) {
      ControllerLogger.logError("SomeEntity creation", error, req, res);
      next(error);
    }
  }

  @httpPatch("/:id")
  public async update(
    @requestParam("id") id: string,
    @requestBody() data: any,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const updatedBy = res.locals.updatedBy;
      const updatedItem = await this.someService.update(id, data, updatedBy);
      
      if (!updatedItem) {
        ControllerLogger.logError("SomeEntity update", new Error("Item not found"), req, res);
        return next(new AppError(404, "Item not found"));
      }
      
      ControllerLogger.logSuccess("SomeEntity updated", id, req, res);
      
      res.status(200).json({
        status: "success",
        message: "Item updated successfully",
      });
    } catch (error) {
      ControllerLogger.logError("SomeEntity update", error, req, res);
      next(error);
    }
  }
}
```

## 6. Log Output Examples

After implementing this template, you'll get logs like:

```
2025-12-05 12:27:16 PM [info-sagar pagar]: RFPA list retrieved successfully [IP: 182.156.141.17]
2025-12-05 12:28:30 PM [info-madhuri]: RFPA created successfully with ID: rfpa345 [IP: 192.168.1.100]
2025-12-05 12:29:45 PM [info-john doe]: RFPA viewed successfully with ID: rfpa345 [IP: 10.0.0.50]
2025-12-05 12:30:15 PM [info-madhuri]: RFPA updated successfully with ID: rfpa345 [IP: 192.168.1.100]
2025-12-05 12:31:00 PM [info-admin]: Delivery Challan created successfully with ID: dc123 [IP: 203.0.113.45]
```

## 7. Quick Implementation Steps

1. Add import: `import { ControllerLogger } from "../utils/controllerLogger";`
2. Add `@request() req: Request` parameter to all methods
3. Add appropriate logging call after successful operations
4. Add error logging in catch blocks
5. Test to ensure logs appear with user names and IP addresses

This template ensures consistent, user-friendly logging across all controllers with minimal code changes.