import { Request, Response, NextFunction } from 'express';
import { UserLogger } from '../utils/logger';

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