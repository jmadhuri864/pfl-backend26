import { controller, httpPost, httpGet, httpDelete, httpPut } from "inversify-express-utils";
import { Request, Response } from "express";
import { inject } from "inversify";
import { TYPES } from "../types";
import { WorkflowHierarchyService } from "../services/workFlowHierarchy.service";
import { deserializeUser, requireUser } from "../middleware/deserializeUser";
import { DepartmentEnum } from "../entities/workflowClosure.entity";

@controller("/workflow", deserializeUser, requireUser)
export class WorkflowHierarchyController {
  constructor(
    @inject(TYPES.WorkflowHierarchyService) private workflowService: WorkflowHierarchyService
  ) {}

 
  @httpPost("/add")
  async addRelation(req: Request, res: Response) {
    try {
      const { department, manager, subordinate } = req.body;
      const managerId=manager;
      const subordinateId=subordinate

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

      return res.status(201).json({
        status: "success",
        data: result.message
      });
    } catch (error: any) {
        console.log(error)
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

      return res.status(201).json({
        status: "success",
        data: result.message
      });
    } catch (error: any) {
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

      return res.status(200).json({
        status: "success",
        data: result
      });
    } catch (error: any) {
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

      return res.status(200).json({
        status: "success",
        data: managers
      });
    } catch (error: any) {
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

      return res.status(200).json({
        status: "success",
        data: tree
      });
    } catch (error: any) {
      return res.status(500).json({
        status: "error",
        message: error.message
      });
    }
  }

 @httpPut("/update-subordinates/:department/:manager")
async updateBranch(req: Request, res: Response) {
  try {
    const{department,manager}=req.params;
    const {  subordinates } = req.body;

    if (!department || !manager || !Array.isArray(subordinates)) {
      return res.status(400).json({
        status: "fail",
        message: "department, manager, newSubordinates[] are required"
      });
    }

    const result = await this.workflowService.updateBranch(
      department as DepartmentEnum,
      manager,
      subordinates
    );

    return res.status(200).json({
      status: "success",
      data: result.message
    });
  } catch (error: any) {
    return res.status(500).json({
      status: "error",
      message: error.message
    });
  }
}

}
 