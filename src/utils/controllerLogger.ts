import { Request, Response } from 'express';
import { UserLogger } from './logger';
import { UserActivityLogService } from '../services/userActivityLog.service';
import { ActivityAction, ActivityModule } from '../entities/userActivityLog.entity';
import { container } from '../inversify.config';
import { TYPES } from '../types';

/**
 * Controller logging utility to standardize logging across all controllers
 * Now integrated with database logging for frontend access
 */
export class ControllerLogger {
  
  /**
   * Get activity log service instance
   */
  private static getActivityLogService(): UserActivityLogService {
    return container.get<UserActivityLogService>(TYPES.UserActivityLogService);
  }

  /**
   * Extract IP address from request
   */
  private static getClientIp(req: Request): string {
    return req.ip || req.socket.remoteAddress || 'Unknown';
  }

  /**
   * Extract user from response locals
   */
  private static getUser(res: Response): any {
    return res.locals.user || res.locals.updatedBy;
  }

  /**
   * Determine module from request path
   */
  private static getModuleFromPath(req: Request): ActivityModule {
    const path = req.path.toLowerCase();
    
    console.log('path', path);

    if (path.includes('grn')) return ActivityModule.GRN;
    if (path.includes('rfpa')) return ActivityModule.RFPA;
    if (path.includes('customer-delivery-challan')) return ActivityModule.CUSTOMER_DELIVERY_CHALLAN;
    if (path.includes('tranfer-delivery-challan')) return ActivityModule.STOCK_TRANSFER_DELIVERY_CHALLAN;
    if (path.includes('other-delivery-challan')) return ActivityModule.OTHER_DELIVERY_CHALLAN;
  //  if (path.includes('customer-delivery-challan')) return ActivityModule.
    if (path.includes('invoice')) return ActivityModule.INVOICE;
    if (path.includes('office') || path.includes('location')) return ActivityModule.OFFICE;
    if (path.includes('labourpaymentvoucher') || path.includes('lpvoucher')) return ActivityModule.LABOUR_PAYMENT;
    if (path.includes('labourattendances') || path.includes('laborattendances')) return ActivityModule.LABOUR_ATTENDANCE;
    if (path.includes('templabour') || path.includes('labourregister')) return ActivityModule.LABOUR_REGISTER;
    if (path.includes('inward')) return ActivityModule.INWARD_REGISTER;
    if (path.includes('inventory')) return ActivityModule.INVENTORY;
    if (path.includes('multicashvoucher')) return ActivityModule.MULTI_CASH_VOUCHER;
    if (path.includes('levels')) return ActivityModule.LEVELS;
    if (path.includes('tpvoucher')) return ActivityModule.TRANSPORT_PAYMENT;
    if (path.includes('user')) return ActivityModule.USER;
    if (path.includes('aqr')) return ActivityModule.AQR;
    if (path.includes('dumpregister')) return ActivityModule.DUMP_REGISTER;
    if (path.includes('returns')) return ActivityModule.RETURN_BY_CUSTOMER;
    if (path.includes('return-to-vendor')) return ActivityModule.RETURN_TO_VENDOR;
    if (path.includes('vehicledispatches')) return ActivityModule.VEHICAL_DISPATCH;
    if (path.includes('secondsales')) return ActivityModule.SECOND_SALES;
    if (path.includes('eodstock')) return ActivityModule.EOD_STOCK;
    if (path.includes('tpvoucher')) return ActivityModule.TRANSPORT_PAYMENT;
    if (path.includes('packingMaterial')) return ActivityModule.PACKING_MATERIAL;
    if (path.includes('dealslip')) return ActivityModule.DEAL_SLIP;
    if (path.includes('pmpvoucher')) return ActivityModule.PMP_VOUCHER;
    
    return ActivityModule.OTHER;
  }

  /**
   * Log to both file and database
   */
  private static async logToDatabase(
    action: ActivityAction,
    description: string,
    req: Request,
    res: Response,
    entityId?: string,
    isError: boolean = false,
    errorMessage?: string
  ): Promise<void> {
    try {
      const user = this.getUser(res);
      if (!user || !user.id) return; // Skip if no user context

      const activityLogService = this.getActivityLogService();
      const module = this.getModuleFromPath(req);

      await activityLogService.logActivity({
        userId: user.id,
        userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.email,
        action,
        module,
        entityId,
        description,
        ipAddress: this.getClientIp(req),
        userAgent: req.get('user-agent'),
        endpoint: req.originalUrl,
        httpMethod: req.method,
        statusCode: res.statusCode,
        isError,
        errorMessage,
      });
    } catch (error) {
      // Don't throw - logging should not break the main operation
      console.error('Failed to log to database:', error);
    }
  }

  /**
   * Log successful operations with IP
   */
  static logSuccess(operation: string, entityId: string, req: Request, res: Response) {
    const user = this.getUser(res);
    const ip = this.getClientIp(req);
    const description = `${operation} successfully with ID: ${entityId}`;
    
    console.log('operation', operation);

    // Log to file
    UserLogger.infoWithIp(description, user, ip);
    
    // Determine action based on operation
    let action = ActivityAction.CREATE;
    if (operation.toLowerCase().includes('updated')) action = ActivityAction.UPDATE;
    else if (operation.toLowerCase().includes('deleted')) action = ActivityAction.DELETE;
    else if (operation.toLowerCase().includes('viewed')) action = ActivityAction.VIEW;
    
    // Log to database
    this.logToDatabase(action, description, req, res, entityId);
  }

  /**
   * Log view operations
   */
  static logView(entityName: string, entityId: string, req: Request, res: Response) {
    const user = this.getUser(res);
    const ip = this.getClientIp(req);
    const description = `${entityName} viewed successfully with ID: ${entityId}`;
    
    // Log to file
    UserLogger.infoWithIp(description, user, ip);
    
    // Log to database
    this.logToDatabase(ActivityAction.VIEW, description, req, res, entityId);
  }

  /**
   * Log list/get operations
   */
  static logList(entityName: string, req: Request, res: Response) {
    const user = this.getUser(res);
    const ip = this.getClientIp(req);
    const description = `${entityName} list retrieved successfully`;
    
    // Log to file
    UserLogger.infoWithIp(description, user, ip);
    
    // Log to database
    this.logToDatabase(ActivityAction.VIEW, description, req, res);
  }

  /**
   * Log get all records operations (generic method for any entity)
   */
  static logGetAllRecords(entityName: string, req: Request, res: Response) {
    const user = this.getUser(res);
    const ip = this.getClientIp(req);
    UserLogger.infoWithIp(`${entityName} data retrieved successfully`, user, ip);
    res.locals.skipApiLogging = true;
  }

  /**
   * Log errors with IP
   */
  static logError(operation: string, error: any, req: Request, res: Response) {
    const user = this.getUser(res);
    const ip = this.getClientIp(req);
    const description = `${operation} failed: ${error.message}`;
    
    // Log to file
    UserLogger.errorWithIp(description, user, ip, error);
    
    // Log to database
    this.logToDatabase(ActivityAction.ERROR, description, req, res, undefined, true, error.message);
  }

  /**
   * Log not found errors
   */
  static logNotFound(entityName: string, entityId: string, req: Request, res: Response) {
    const user = this.getUser(res);
    const ip = this.getClientIp(req);
    UserLogger.warnWithIp(`${entityName} not found with ID: ${entityId}`, user, ip);
  }

  /**
   * Log validation errors
   */
  static logValidationError(operation: string, message: string, req: Request, res: Response) {
    const user = this.getUser(res);
    const ip = this.getClientIp(req);
    UserLogger.warnWithIp(`${operation} validation failed: ${message}`, user, ip);
  }

  /**
   * Log operation failures (generic)
   */
  static logOperationFailed(operation: string, entityName: string, reason: string, req: Request, res: Response) {
    const user = this.getUser(res);
    const ip = this.getClientIp(req);
    UserLogger.warnWithIp(`${operation} ${entityName} failed: ${reason}`, user, ip);
  }

  /**
   * Log authentication events
   */
  static logAuth(action: string, req: Request, res: Response, success: boolean = true) {
    const user = this.getUser(res);
    const ip = this.getClientIp(req);
    
    if (success) {
      UserLogger.infoWithIp(`${action} successful`, user, ip);
    } else {
      UserLogger.warnWithIp(`${action} failed`, user, ip);
    }
  }

  
}