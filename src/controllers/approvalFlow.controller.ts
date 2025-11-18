import { NextFunction ,Response,Request} from "express";
import { controller, httpDelete, httpGet, httpPatch, httpPost, next, requestBody, response ,request} from "inversify-express-utils";
import logger from "../utils/logger";
import { inject } from "inversify";
import { TYPES } from "../types";
import { ApprovalFlowService } from "../services/approvalFlow.service";
import { deserializeUser, requireUser } from "../middleware/deserializeUser";

@controller('/approval-flow',deserializeUser,requireUser)
export class ApprovalFlowController {
     constructor(
    @inject(TYPES.ApprovalFlowService )
    private approvalFlowService: ApprovalFlowService ,
  ) {}

    @httpPost("/")
      public async create(
        @request() req:Request,
        @requestBody() data:any,
        @response() res: Response,
        @next() next: NextFunction
      ) {
        try {
          console.log("req",req.body)
          logger.info("Creating a new Approval Flow")
          const category = await this.approvalFlowService.create(data);
          logger.info("Created new Approval Flow");
          res.status(201).json({
            status: "success",
            data: category.id,
            message: "Approval Flow created successfully",
          });
        } catch (err) {
          logger.error("Error creating Approval Flow", {  error: err });
          next(err);
        }
      }

      @httpGet("/")
  public async getAll(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const type = typeof req.query.type === "string" ? req.query.type : undefined;
      const flows = await this.approvalFlowService.getAll(type);
      if(!flows)
      {
        return res.status(404).json({ status: "error", message: "Not found" });
      }
      res.status(200).json({ status: "success", data: flows });
    } catch (err) {
      logger.error("Error fetching approval flows", { error: err });
      next(err);
    }
  }

  @httpGet("/:id/view")
  public async getByIdView(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const id =req.params.id
      const flow = await this.approvalFlowService.getbyidforview(id);
      if (!flow) {
        return res.status(404).json({ status: "error", message: "Not found" });
      }
      res.status(200).json({ status: "success", data: flow });
    } catch (err) {
      logger.error("Error fetching approval flow", { error: err });
      next(err);
    }
  }

   @httpGet("/:id")
  public async getById(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const id =req.params.id
      const flow = await this.approvalFlowService.getByIdForUpdate(id);
      if (!flow) {
        return res.status(404).json({ status: "error", message: "Not found" });
      }
      res.status(200).json({ status: "success", data: flow });
    } catch (err) {
      logger.error("Error fetching approval flow", { error: err });
      next(err);
    }
  }

  @httpPatch("/:id")
  public async update(
    @request() req: Request,
    @requestBody() data: any,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const id = req.params.id;
      //console.log(data)
      const updated = await this.approvalFlowService.update(id, data);
      res.status(200).json({ status: "success", data: updated });
    } catch (err) {
      logger.error("Error updating approval flow", { error: err });
      next(err);
    }
  }

  @httpPost('/replace/user')
  async findreplace(
     @request() req: Request,
    @requestBody() data: any,
    @response() res: Response,
    @next() next: NextFunction

  )
  {
     const { oldUserId, newUserId } = req.body;

    if (!oldUserId || !newUserId) {
      return res.status(400).json({ message: 'Both oldUserId and newUserId are required' });
    }

    try {
      await this.approvalFlowService.replaceUserInApprovalSystem(oldUserId, newUserId);
      return res.status(200).json({ message: 'User references replaced successfully.' });
    } catch (error) {
      console.error('Error replacing user:', error);
      return res.status(500).json({ message: 'Internal server error', error });
    }

  }

  
}