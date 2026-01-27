import { controller, httpPost, httpGet, httpDelete, httpPut } from "inversify-express-utils";
import { Request, Response } from "express";
import { inject } from "inversify";
import { TYPES } from "../types";
import { WorkflowHierarchyService } from "../services/workFlowHierarchy.service";
import { NotificationService } from "../services/notification.service";
import { deserializeUser, requireUser } from "../middleware/deserializeUser";
import { DepartmentEnum } from "../entities/workflowClosure.entity";
import { ControllerLogger } from "../utils/controllerLogger";

@controller("/workflow", deserializeUser, requireUser)
export class WorkflowHierarchyController {
  constructor(
    @inject(TYPES.WorkflowHierarchyService) private workflowService: WorkflowHierarchyService,
    @inject(TYPES.NotificationService) private notificationService: NotificationService
  ) {}

 
  @httpPost("/add")
  async addRelation(req: Request, res: Response) {
    try {
      console.log(req.body)
      const { department, managerId,newSubordinate } = req.body;
     
      const subordinateId=newSubordinate
   

      if (!department || !managerId || !subordinateId) {
        return res.status(400).json({
          status: "fail",
          message: "Department, managerId, and subordinateId are required"
        });
      }

      const result = await this.workflowService.addSingleRelation(
        department as DepartmentEnum,
        managerId,
        subordinateId
      );

      ControllerLogger.logSuccess('Workflow relation added', `${managerId} -> ${subordinateId}`, req, res);

      // Send notification for workflow relation addition
      const userId = res.locals.user?.id;
      if (userId) {
        await this.notificationService.createNoti(
          `Workflow relation added successfully: ${managerId} -> ${subordinateId}`,
          userId
        );
      }

      return res.status(201).json({
        status: "success",
        data: result.message
      });
    } catch (error: any) {
        console.log(error)
        ControllerLogger.logError('Workflow relation addition', error, req, res);
      return res.status(500).json({
        status: "error",
        message: error.message
      });
    }
  }

  
  @httpPost("/bulk")
  async addBulkRelations(req: Request, res: Response) {
    try {
      const { department, relations } = req.body;

      if (!department || !relations || !Array.isArray(relations)) {
        return res.status(400).json({
          status: "fail",
          message: "Department and relations array are required"
        });
      }

      const result = await this.workflowService.addBulkRelations(
        department as DepartmentEnum,
        relations
      );

      ControllerLogger.logSuccess('Bulk workflow relations added', `${relations.length} relations`, req, res);

      // Send notification for bulk workflow relations addition
      const userId = res.locals.user?.id;
      if (userId) {
        await this.notificationService.createNoti(
          `Bulk workflow relations added successfully: ${relations.length} relations`,
          userId
        );
      }

      return res.status(201).json({
        status: "success",
        data: result.message
      });
    } catch (error: any) {
      ControllerLogger.logError('Bulk workflow relations addition', error, req, res);
      return res.status(500).json({
        status: "error",
        message: error.message
      });
    }
  }

  
 
 
  @httpGet("/getworkflow/:department")
  async getSubordinates(req: Request, res: Response) {

    try {
      const { managerId } = req.query;
      const { department } = req.params;

      if (!department) {
        return res.status(400).json({
          status: "fail",
          message: "Department is required"
        });
      }

      let result;
      
      if (managerId) {
        // If managerId is provided, get subordinates for that manager
        result = await this.workflowService.getSubordinates(
          managerId as string,
          department as DepartmentEnum
        );
      } else {
        // If no managerId, get complete department tree
        result = await this.workflowService.getWorkflowTree(
          department as DepartmentEnum
        );
      }

      ControllerLogger.logList('Workflow tree', req, res);

      // Send notification for workflow tree access
      const userId = res.locals.user?.id;
      if (userId) {
        await this.notificationService.createNoti(
          `Workflow tree accessed for department: ${department}`,
          userId
        );
      }

      return res.status(200).json({
        status: "success",
        data: result
      });
    } catch (error: any) {
      ControllerLogger.logError('Workflow tree retrieval', error, req, res);
      return res.status(500).json({
        status: "error",
        message: error.message
      });
    }
  }

  
  @httpGet("/managers/:subordinateId/:department")
  async getManagers(req: Request, res: Response) {
    try {
      const { subordinateId, department } = req.params;

      if (!subordinateId || !department) {
        return res.status(400).json({
          status: "fail",
          message: "SubordinateId and department are required"
        });
      }

      const managers = await this.workflowService.getManagers(
        subordinateId,
        department as DepartmentEnum
      );

      ControllerLogger.logList('Workflow managers', req, res);
      return res.status(200).json({
        status: "success",
        data: managers
      });
    } catch (error: any) {
      ControllerLogger.logError('Workflow managers retrieval', error, req, res);
      return res.status(500).json({
        status: "error",
        message: error.message
      });
    }
  }

  /**
   * Get the tree structure for a specific manager
   * GET /workflow/manager-tree/:managerId/:department
   */
  @httpGet("/manager-tree/:managerId/:department")
  async getManagerTree(req: Request, res: Response) {
    try {
      const { managerId, department } = req.params;

      if (!managerId || !department) {
        return res.status(400).json({
          status: "fail",
          message: "ManagerId and department are required"
        });
      }

      const tree = await this.workflowService.getManagerTree(
        managerId,
        department as DepartmentEnum
      );

      ControllerLogger.logView('Manager tree', managerId, req, res);
      return res.status(200).json({
        status: "success",
        data: tree
      });
    } catch (error: any) {
      ControllerLogger.logError('Manager tree retrieval', error, req, res);
      return res.status(500).json({
        status: "error",
        message: error.message
      });
    }
  }

@httpPut("/update-one")
async updateOneNode(req: Request, res: Response) {
  try {
    const { 
      department, 
      managerId, 
      oldSubordinate, 
      newSubordinate 
    } = req.body;
const oldSubordinateId=oldSubordinate;
const newSubordinateId=newSubordinate;
    // Validate input
    if (!department || !managerId || !oldSubordinateId || !newSubordinateId) {
      return res.status(400).json({
        status: "fail",
        message: "department, managerId, oldSubordinateId, newSubordinateId are required"
      });
    }

    const result = await this.workflowService.updateSingleNode(
      department,
      managerId,
      oldSubordinateId,
      newSubordinateId
    );

    ControllerLogger.logSuccess('Workflow branch updated', managerId, req, res);

    // Send notification for workflow branch update
    const userId = res.locals.user?.id;
    if (userId) {
      await this.notificationService.createNoti(
        `Workflow branch updated successfully: ${managerId}`,
        userId
      );
    }

    return res.status(200).json({
      status: "success",
      message: result.message
    });

  } catch (error: any) {
    ControllerLogger.logError('Workflow branch update', error, req, res);
    return res.status(500).json({
      status: "error",
      message: error.message
    });
  }
}

  /**
   * Delete a single node from the workflow hierarchy
   * DELETE /workflow/delete-node/:department/:nodeId
   */
  @httpDelete("/delete-node/:department/:nodeId")
  async deleteSingleNode(req: Request, res: Response) {
    try {
      const { department, nodeId } = req.params;

      if (!department || !nodeId) {
        return res.status(400).json({
          status: "fail",
          message: "Department and nodeId are required"
        });
      }

      const result = await this.workflowService.deleteSingleNode(
        department as DepartmentEnum,
        nodeId
      );

      ControllerLogger.logSuccess('Workflow node deleted', nodeId, req, res);

      // Send notification for workflow node deletion
      const userId = res.locals.user?.id;
      if (userId) {
        await this.notificationService.createNoti(
          `Workflow node deleted successfully: ${nodeId}`,
          userId
        );
      }

      return res.status(200).json({
        status: "success",
        data: result
      });
    } catch (error: any) {
      console.log(error);
      ControllerLogger.logError('Workflow node deletion', error, req, res);
      return res.status(500).json({
        status: "error",
        message: error.message
      });
    }
  }

  /**
   * Check for duplicate entries in workflow hierarchy
   * GET /workflow/check-duplicates/:department? (department is optional)
   */
  @httpGet("/check-duplicates/:department?")
  async checkDuplicates(req: Request, res: Response) {
    try {
      const { department } = req.params;

      const result = await this.workflowService.checkDuplicates(
        department as DepartmentEnum | undefined
      );

      ControllerLogger.logList('Workflow duplicates check', req, res);

      return res.status(200).json({
        status: "success",
        data: result
      });
    } catch (error: any) {
      ControllerLogger.logError('Workflow duplicates check', error, req, res);
      return res.status(500).json({
        status: "error",
        message: error.message
      });
    }
  }

  /**
   * Clean duplicate entries from workflow hierarchy
   * DELETE /workflow/clean-duplicates/:department? (department is optional)
   */
  @httpDelete("/clean-duplicates/:department?")
  async cleanDuplicates(req: Request, res: Response) {
    try {
      const { department } = req.params;

      const result = await this.workflowService.cleanDuplicates(
        department as DepartmentEnum | undefined
      );

      ControllerLogger.logSuccess('Workflow duplicates cleaned', `${result.deletedCount} removed`, req, res);

      // Send notification for workflow duplicates cleanup
      const userId = res.locals.user?.id;
      if (userId) {
        await this.notificationService.createNoti(
          `Workflow duplicates cleaned: ${result.deletedCount} entries removed`,
          userId
        );
      }

      return res.status(200).json({
        status: "success",
        data: result
      });
    } catch (error: any) {
      ControllerLogger.logError('Workflow duplicates cleanup', error, req, res);
      return res.status(500).json({
        status: "error",
        message: error.message
      });
    }
  }

}