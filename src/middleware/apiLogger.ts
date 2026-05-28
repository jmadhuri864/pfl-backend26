import { Request, Response, NextFunction } from 'express';
import { UserLogger } from '../utils/logger';
import { container } from '../inversify.config';
import { TYPES } from '../types';
import { UserActivityLogService } from '../services/userActivityLog.service';
import { ActivityAction, ActivityModule } from '../entities/userActivityLog.entity';

/**
 * Map HTTP method + URL path → ActivityAction + ActivityModule
 */
const resolveActivity = (
  method: string,
  url: string,
  statusCode: number,
): { action: ActivityAction; module: ActivityModule; description: string } => {
  const path = url.split('?')[0].toLowerCase();

  // ── Module detection — exact route prefix match ───────────────────────────
  let module = ActivityModule.OTHER;

  if      (path.startsWith('/grns') || path.startsWith('/grn-report'))
    module = ActivityModule.GRN;
  else if (path.startsWith('/rfpa'))
    module = ActivityModule.RFPA;
  else if (path.startsWith('/aqr'))
    module = ActivityModule.AQR;
  else if (path.startsWith('/dealslip'))
    module = ActivityModule.DEAL_SLIP;
  else if (path.startsWith('/final-invoice') || path.startsWith('/saleorders') || path.startsWith('/invoice'))
    module = ActivityModule.INVOICE;
  else if (path.startsWith('/secondsales'))
    module = ActivityModule.SECOND_SALE;
  else if (path.startsWith('/returns'))
    module = ActivityModule.RETURN;
  else if (path.startsWith('/return-to-vendor'))
    module = ActivityModule.RETURN_TO_VENDOR;
  else if (path.startsWith('/customers') || path.startsWith('/customer-bank') || path.startsWith('/customer-billing') || path.startsWith('/customer-delivery') || path.startsWith('/delivery-details') || path.startsWith('/statutory-details'))
    module = ActivityModule.CUSTOMER;
  else if (path.startsWith('/vendors') || path.startsWith('/vendor-categories') || path.startsWith('/vendor-subcategories'))
    module = ActivityModule.VENDOR;
  else if (path.startsWith('/products') || path.startsWith('/productvarient') || path.startsWith('/varients') || path.startsWith('/packingmaterial') || path.startsWith('/productcategory') || path.startsWith('/productsubcategory') || path.startsWith('/productclassification') || path.startsWith('/productspecification') || path.startsWith('/crops'))
    module = ActivityModule.PRODUCT;
  else if (path.startsWith('/uoms') || path.startsWith('/uom-conversion'))
    module = ActivityModule.UOM;
  else if (path.startsWith('/employee') || path.startsWith('/user') || path.startsWith('/roles') || path.startsWith('/super-admin'))
    module = ActivityModule.USER;
  else if (path.startsWith('/reports') || path.startsWith('/registration-reports') || path.startsWith('/new-registration-reports') || path.startsWith('/sales-reports') || path.startsWith('/procurement-reports') || path.startsWith('/procurement-report') || path.startsWith('/delivery-challan-report') || path.startsWith('/final-invoice-report') || path.startsWith('/crystalreports') || path.startsWith('/userreport'))
    module = ActivityModule.REPORT;
  else if (path.startsWith('/dashboard') || path.startsWith('/admin/dashboard') || path.startsWith('/api/management') || path.startsWith('/api/procurment'))
    module = ActivityModule.DASHBOARD;
  else if (path.startsWith('/deliverychallan') || path.startsWith('/other-delivery-challan') || path.startsWith('/tranfer-delivery-challan') || path.startsWith('/customer-delivery-challan'))
    module = ActivityModule.OTHER_DELIVERY_CHALLAN;
  else if (path.startsWith('/multicashvoucher'))
    module = ActivityModule.MULTI_CASH_VOUCHER;
  else if (path.startsWith('/lpvoucher'))
    module = ActivityModule.LABOUR_PAYMENT;
  else if (path.startsWith('/labors') || path.startsWith('/templabour') || path.startsWith('/labourregister'))
    module = ActivityModule.LABOUR_REGISTER;
  else if (path.startsWith('/laborattendances') || path.startsWith('/labourattendance'))
    module = ActivityModule.LABOUR_ATTENDANCE;
  else if (path.startsWith('/tpvoucher'))
    module = ActivityModule.TRANSPORT_PAYMENT;
  else if (path.startsWith('/pmpvoucher'))
    module = ActivityModule.VOUCHER;
  else if (path.startsWith('/location-offices'))
    module = ActivityModule.OFFICE;
  else if (path.startsWith('/inwardregister'))
    module = ActivityModule.INWARD_REGISTER;
  else if (path.startsWith('/eodstock') || path.startsWith('/skueodstock') || path.startsWith('/stock-correction') || path.startsWith('/inventorystock'))
    module = ActivityModule.INVENTORY;
  else if (path.startsWith('/dumpregister'))
    module = ActivityModule.DUMP_REGISTER;
  else if (path.startsWith('/approval-flow') || path.startsWith('/document') || path.startsWith('/departments') || path.startsWith('/levels') || path.startsWith('/location-branches') || path.startsWith('/company') || path.startsWith('/workflow') || path.startsWith('/approval'))
    module = ActivityModule.SETTINGS;

  // ── Action detection ──────────────────────────────────────────────────────
  let action = ActivityAction.VIEW;
  if (method === 'POST')
    action = ActivityAction.CREATE;
  else if (method === 'PATCH' || method === 'PUT')
    action = ActivityAction.UPDATE;
  else if (method === 'DELETE')
    action = ActivityAction.DELETE;
  else if (path.includes('/export') || path.includes('/download') || path.includes('/report'))
    action = ActivityAction.EXPORT;
  else if (path.includes('/approve'))
    action = ActivityAction.APPROVE;
  else if (path.includes('/reject'))
    action = ActivityAction.REJECT;

  // ── Human-readable description ────────────────────────────────────────────
  const description = getReadableMessage(method, url, statusCode);

  return { action, module, description };
};

/**
 * Convert API endpoints to user-friendly messages
 */
const getReadableMessage = (method: string, url: string, statusCode: number): string => {
  const path = url.split('?')[0]; // Remove query parameters
  
  // Returns/RFPA related endpoints
  if (path.includes('/returns')) {
    if (method === 'GET' && path === '/returns') {
      return statusCode === 200 ? 'RFPA list retrieved successfully' : 'Failed to get RFPA list';
    }
    if (method === 'GET' && path.includes('/returns/view/')) {
      return statusCode === 200 ? 'RFPA details viewed successfully' : 'Failed to view RFPA details';
    }
    if (method === 'GET' && path.includes('/returns/update/')) {
      return statusCode === 200 ? 'RFPA data loaded for editing successfully' : 'Failed to load RFPA for editing';
    }
    if (method === 'POST' && path === '/returns') {
      return statusCode === 201 ? 'RFPA created successfully' : 'Failed to create RFPA';
    }
    if (method === 'PATCH' && path.includes('/returns/')) {
      return statusCode === 200 ? 'RFPA updated successfully' : 'Failed to update RFPA';
    }
    if (method === 'DELETE' && path.includes('/returns/')) {
      return statusCode === 200 ? 'RFPA deleted successfully' : 'Failed to delete RFPA';
    }
  }
  
  // Deal Slip related endpoints
  if (path.includes('/dealSlip') || path.includes('/dealslip') || path.includes('/deal-slip')) {
    if (method === 'GET' && (path === '/dealSlip' || path === '/dealslip' || path === '/deal-slip')) {
      return statusCode === 200 ? 'Deal Slip data retrieved successfully' : 'Failed to get Deal Slip data';
    }
    if (method === 'GET' && (path.includes('/dealSlip/view/') || path.includes('/dealslip/view/') || path.includes('/deal-slip/view/'))) {
      return statusCode === 200 ? 'Deal Slip details viewed successfully' : 'Failed to view Deal Slip details';
    }
    if (method === 'POST' && (path === '/dealSlip' || path === '/dealslip' || path === '/deal-slip')) {
      return statusCode === 201 ? 'Deal Slip created successfully' : 'Failed to create Deal Slip';
    }
    if (method === 'PATCH' && (path.includes('/dealSlip/') || path.includes('/dealslip/') || path.includes('/deal-slip/'))) {
      return statusCode === 200 ? 'Deal Slip updated successfully' : 'Failed to update Deal Slip';
    }
  }

  // EOD Stock related endpoints
  if (path.includes('/eodStock')) {
    if (method === 'GET' && path === '/eodStock') {
      return statusCode === 200 ? 'EOD Stock data retrieved successfully' : 'Failed to get EOD Stock data';
    }
    if (method === 'POST' && path === '/eodStock') {
      return statusCode === 201 ? 'EOD Stock created successfully' : 'Failed to create EOD Stock';
    }
    if (method === 'PATCH' && path.includes('/eodStock/')) {
      return statusCode === 200 ? 'EOD Stock updated successfully' : 'Failed to update EOD Stock';
    }
  }

  // Customer related endpoints
  if (path.includes('/customers')) {
    if (method === 'GET' && path === '/customers') {
      return statusCode === 200 ? 'Customer data retrieved successfully' : 'Failed to get Customer data';
    }
    if (method === 'GET' && path.includes('/customers/view/')) {
      return statusCode === 200 ? 'Customer details viewed successfully' : 'Failed to view Customer details';
    }
    if (method === 'POST' && path === '/customers') {
      return statusCode === 201 ? 'Customer created successfully' : 'Failed to create Customer';
    }
    if (method === 'PATCH' && path.includes('/customers/')) {
      return statusCode === 200 ? 'Customer updated successfully' : 'Failed to update Customer';
    }
  }

  // Company related endpoints
  if (path.includes('/company')) {
    if (method === 'GET' && path === '/company') {
      return statusCode === 200 ? 'Company data retrieved successfully' : 'Failed to get Company data';
    }
    if (method === 'POST' && path === '/company') {
      return statusCode === 201 ? 'Company created successfully' : 'Failed to create Company';
    }
    if (method === 'PATCH' && path.includes('/company/')) {
      return statusCode === 200 ? 'Company updated successfully' : 'Failed to update Company';
    }
  }

  // Farmer related endpoints
  if (path.includes('/farmer')) {
    if (method === 'GET' && path === '/farmer') {
      return statusCode === 200 ? 'Farmer data retrieved successfully' : 'Failed to get Farmer data';
    }
    if (method === 'POST' && path === '/farmer') {
      return statusCode === 201 ? 'Farmer created successfully' : 'Failed to create Farmer';
    }
    if (method === 'PATCH' && path.includes('/farmer/')) {
      return statusCode === 200 ? 'Farmer updated successfully' : 'Failed to update Farmer';
    }
  }

  // Product related endpoints
  if (path.includes('/product')) {
    if (method === 'GET' && path === '/product') {
      return statusCode === 200 ? 'Product data retrieved successfully' : 'Failed to get Product data';
    }
    if (method === 'POST' && path === '/product') {
      return statusCode === 201 ? 'Product created successfully' : 'Failed to create Product';
    }
    if (method === 'PATCH' && path.includes('/product/')) {
      return statusCode === 200 ? 'Product updated successfully' : 'Failed to update Product';
    }
  }

  // Vendor related endpoints
  if (path.includes('/vendor')) {
    if (method === 'GET' && path === '/vendor') {
      return statusCode === 200 ? 'Vendor data retrieved successfully' : 'Failed to get Vendor data';
    }
    if (method === 'POST' && path === '/vendor') {
      return statusCode === 201 ? 'Vendor created successfully' : 'Failed to create Vendor';
    }
    if (method === 'PATCH' && path.includes('/vendor/')) {
      return statusCode === 200 ? 'Vendor updated successfully' : 'Failed to update Vendor';
    }
  }

  // Branches related endpoints
  if (path.includes('/branches')) {
    if (method === 'GET' && path === '/branches') {
      return statusCode === 200 ? 'Branch data retrieved successfully' : 'Failed to get Branch data';
    }
    if (method === 'POST' && path === '/branches') {
      return statusCode === 201 ? 'Branch created successfully' : 'Failed to create Branch';
    }
    if (method === 'PATCH' && path.includes('/branches/')) {
      return statusCode === 200 ? 'Branch updated successfully' : 'Failed to update Branch';
    }
  }

  // Offices related endpoints
  if (path.includes('/offices')) {
    if (method === 'GET' && path === '/offices') {
      return statusCode === 200 ? 'Office data retrieved successfully' : 'Failed to get Office data';
    }
    if (method === 'POST' && path === '/offices') {
      return statusCode === 201 ? 'Office created successfully' : 'Failed to create Office';
    }
    if (method === 'PATCH' && path.includes('/offices/')) {
      return statusCode === 200 ? 'Office updated successfully' : 'Failed to update Office';
    }
  }

  // User related endpoints
  if (path.includes('/user')) {
    if (method === 'GET' && path === '/user') {
      return statusCode === 200 ? 'User data retrieved successfully' : 'Failed to get User data';
    }
    if (method === 'POST' && path === '/user') {
      return statusCode === 201 ? 'User created successfully' : 'Failed to create User';
    }
    if (method === 'PATCH' && path.includes('/user/')) {
      return statusCode === 200 ? 'User updated successfully' : 'Failed to update User';
    }
  }
  
  // Delivery Challan related endpoints
  if (path.includes('/delivery-challan') || path.includes('/challan')) {
    if (method === 'GET') {
      return statusCode === 200 ? 'Delivery Challan retrieved successfully' : 'Failed to get Delivery Challan';
    }
    if (method === 'POST') {
      return statusCode === 201 ? 'Delivery Challan created successfully' : 'Failed to create Delivery Challan';
    }
    if (method === 'PATCH') {
      return statusCode === 200 ? 'Delivery Challan updated successfully' : 'Failed to update Delivery Challan';
    }
  }
  
  // GRN related endpoints
  if (path.includes('/grn')) {
    if (method === 'GET') {
      return statusCode === 200 ? 'GRN retrieved successfully' : 'Failed to get GRN';
    }
    if (method === 'POST') {
      return statusCode === 201 ? 'GRN created successfully' : 'Failed to create GRN';
    }
    if (method === 'PATCH') {
      return statusCode === 200 ? 'GRN updated successfully' : 'Failed to update GRN';
    }
  }
  
  // Invoice related endpoints
  if (path.includes('/invoice')) {
    if (method === 'GET') {
      return statusCode === 200 ? 'Invoice retrieved successfully' : 'Failed to get Invoice';
    }
    if (method === 'POST') {
      return statusCode === 201 ? 'Invoice created successfully' : 'Failed to create Invoice';
    }
    if (method === 'PATCH') {
      return statusCode === 200 ? 'Invoice updated successfully' : 'Failed to update Invoice';
    }
  }
  
  // Authentication endpoints
  if (path.includes('/auth/login')) {
    return statusCode === 200 ? 'User logged in successfully' : 'Login failed';
  }
  if (path.includes('/auth/logout')) {
    return statusCode === 200 ? 'User logged out successfully' : 'Logout failed';
  }
  
  // Generic fallback
  if (method === 'GET') {
    return statusCode === 200 ? 'Data retrieved successfully' : 'Failed to retrieve data';
  }
  if (method === 'POST') {
    return statusCode === 201 ? 'Record created successfully' : 'Failed to create record';
  }
  if (method === 'PATCH' || method === 'PUT') {
    return statusCode === 200 ? 'Record updated successfully' : 'Failed to update record';
  }
  if (method === 'DELETE') {
    return statusCode === 200 ? 'Record deleted successfully' : 'Failed to delete record';
  }
  
  return `${method} operation completed with status ${statusCode}`;
};

/**
 * Middleware to automatically log all API calls with user-friendly messages
 */
export const apiLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  // Store original res.json to intercept response
  const originalJson = res.json;
  
  res.json = function(body: any) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    const statusCode = res.statusCode;
    
    // Skip logging if controller has already logged (indicated by skipApiLogging flag)
    if (res.locals.skipApiLogging) {
      return originalJson.call(this, body);
    }
    
    // Get user from res.locals (set by deserializeUser middleware)
    const user = res.locals.user;
    
    // Get client IP address
    const clientIp = req.ip || req.socket.remoteAddress || 'Unknown';
    
    // Get user-friendly message
    const readableMessage = getReadableMessage(req.method, req.originalUrl, statusCode);
    
    // Log the user-friendly message with IP address
    UserLogger.infoWithIp(readableMessage, user, clientIp);

    // ── DB Activity Log (fire-and-forget, only for authenticated users) ──────
    if (user?.id) {
      setImmediate(() => {
        try {
          const activityLogService = container.get<UserActivityLogService>(TYPES.UserActivityLogService);
          const { action, module, description } = resolveActivity(req.method, req.originalUrl, statusCode);

          activityLogService.logActivity({
            userId: user.id,
            userName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
            action,
            module,
            description,
            metadata: {
              params: req.params,
              query: req.query,
            },
            ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || 'unknown',
            userAgent: req.get('user-agent'),
            endpoint: req.originalUrl,
            httpMethod: req.method,
            statusCode,
            responseTime: duration,
            isError: statusCode >= 400,
          }).catch(() => {});
        } catch (_) {
          // Never break the response
        }
      });
    }
    
    // Call original json method
    return originalJson.call(this, body);
  };
  
  next();
};

/**
 * Middleware to log errors with user context
 */
export const errorLogger = (err: any, req: Request, res: Response, next: NextFunction) => {
  const user = res.locals.user;
  
  UserLogger.error(
    `Error in ${req.method} ${req.originalUrl}: ${err.message}`, 
    user, 
    err
  );
  
  next(err);
};

/**
 * Middleware to log authentication events
 */
export const authLogger = {
  logLogin: (req: Request, res: Response, next: NextFunction) => {
    const user = res.locals.user;
    const clientIp = req.ip || req.socket.remoteAddress || 'Unknown';
    if (user) {
      UserLogger.logUserLogin(user, clientIp);
    }
    next();
  },
  
  logLogout: (req: Request, res: Response, next: NextFunction) => {
    const user = res.locals.user;
    const clientIp = req.ip || req.socket.remoteAddress || 'Unknown';
    if (user) {
      UserLogger.logUserLogout(user, clientIp);
    }
    next();
  },
  
  logFailedLogin: (req: Request, res: Response, next: NextFunction) => {
    const { email, username } = req.body;
    const clientIp = req.ip || req.socket.remoteAddress || 'Unknown';
    UserLogger.warnWithIp(`Failed login attempt for ${email || username}`, undefined, clientIp);
    next();
  }
};