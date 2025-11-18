import { Request, Response, NextFunction } from 'express';
import { inject } from 'inversify';
import { controller, httpGet } from 'inversify-express-utils';
import { AuditLogService } from '../services/auditLog.service';
import { TYPES } from '../types';

@controller('/audit-logs')
export class AuditLogController {
  constructor(
    @inject(TYPES.AuditLogService) private auditLogService: AuditLogService,
  ) {}

  // Get all audit logs
  @httpGet('/')
  public async getAllAuditLogs(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const logs = await this.auditLogService.getAllLogs();
      res.status(200).json({
        status: 'success',
        data: logs,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get audit logs by entity name and ID
  @httpGet('/:entityName/:entityId')
  public async getAuditLogs(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { entityName, entityId } = req.params;
      const logs = await this.auditLogService.getAuditLogs(
        entityName,
        entityId,
      );
      if (logs && logs.length > 0) {
        res.status(200).json({
          status: 'success',
          data: logs,
        });
      } else {
        res.status(404).send('Audit logs not found');
      }
    } catch (error) {
      next(error);
    }
  }
}
