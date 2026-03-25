import { controller, httpGet, httpPatch, request, response, requestParam } from "inversify-express-utils";
import { deserializeUser, requireUser } from "../middleware/deserializeUser";
import { inject } from "inversify";
import { TYPES } from "../types";

import { Request, Response } from "express";
import { NotificationService } from "../services/notification.service";



@controller('/notification', deserializeUser, requireUser)
export class NotificationController {
  constructor(
    //@inject(TYPES.SocketIoServerOne) private io: Server,
  @inject(TYPES.NotificationService)
  private readonly notificationService: NotificationService,
) {}

 /* @httpPost("/testNotification")
  public async testNotification(@request() req: Request, @response() res: Response): Promise<void> {
// const userId=res.locals.id;
// console.log(userId)
    const {userId,message } = req.body;
    console.log(req.body)
    if (!userId || !message) {
        res.status(400).json({ success: false, message: "userId and message are required" });
        return;
      }
      console.log("userId",userId);
      console.log("message",message);
    // Emit notification event to the specific user's room
    this.io.to(userId).emit("newNotification", { message, userId });

    // Respond back to confirm
    res.status(200).json({ success: true, message: "Notification sent to frontend" });
  }*/


  @httpGet("/getallNotification")
  public async getAllNotification(@request() req: Request, @response() res: Response): Promise<void> {
    // Get all rooms
    /* */
    const data = await this.notificationService.getAllNoti()
    res.status(200).json({ data });
  }

  //Todo:Get Notifications BY User
  @httpGet("/getbyuserid")
  public async getNotiByUserId(@request() req: Request, @response() res: Response): Promise<void> {
    const userId = res.locals.user.id;
    const data = await this.notificationService.getNotiByUserId(userId);
    res.status(200).json({ data });
  }

  @httpPatch("/mark-read/:id")
  public async markAsRead(@requestParam('id') id: string, @request() req: Request, @response() res: Response): Promise<void> {
    const userId = res.locals.user.id;
    await this.notificationService.markAsRead(id, userId);
    res.status(200).json({ message: 'Notification marked as read' });
  }

  @httpPatch("/mark-all-read")
  public async markAllAsRead(@request() req: Request, @response() res: Response): Promise<void> {
    const userId = res.locals.user.id;
    await this.notificationService.markAllAsRead(userId);
    res.status(200).json({ message: 'All notifications marked as read' });
  }
}

