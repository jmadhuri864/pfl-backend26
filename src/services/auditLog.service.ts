import { inject, injectable } from 'inversify';

import { AuditLog } from '../entities/auditLog.entity';
import { AuditLogRepository } from '../repositories/AuditLog.repository';
import { TYPES } from '../types';


@injectable()
export class AuditLogService {
 
  constructor(
    @inject(TYPES.AuditLogRepository)
    private readonly auditLogRepo : AuditLogRepository,
  
  ) {}
  // Function to log changes
  async logChange(
    entityName: string,
    entityId: string,
    oldData: any,
    newData: any,
    // date: Date,
    updatedBy: string,
  ): Promise<void> {
    const changes: Record<string, { oldValue: any; newValue: any;  }> = {};

    for (const key of Object.keys(newData)) {
      if (oldData[key] !== newData[key]) {
        changes[key] = {
          oldValue: oldData[key],
          newValue: newData[key],
          // date: new Date,
        };
      }
    }

    if (Object.keys(changes).length > 0) {
      const auditLog = this.auditLogRepo.create({
        entityName,
        entityId,
        changes,
        updatedBy,
      });
      await this.auditLogRepo.save(auditLog);
    }
  }
  async getAllLogs(): Promise<AuditLog[]> {
    
    return this.auditLogRepo.find({
      order: { updatedAt: "DESC" },
    });
  }

  async getAuditLogs(entityName: string, entityId: string): Promise<AuditLog[]> {
    return this.auditLogRepo.find({
      where: { entityName, entityId },
      order: { updatedAt: "DESC" }, // Latest logs first
    });
  }

  
}
