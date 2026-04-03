import { inject, injectable } from 'inversify';
import { TYPES } from '../types';
import { NotificationRepository } from '../repositories/notification.repository';
import { SSEService } from './sse.service';
import { UserService } from '../services/user.service';
import logger from '../utils/logger';


@injectable()
export class NotificationService {
  constructor(
    @inject(TYPES.NotificationRepository)
    private readonly notificationRepository: NotificationRepository,
    @inject(TYPES.UserService)
    private readonly userService: UserService,
    @inject(TYPES.SSEService)
    private readonly sseService: SSEService,
  ) {}

  async createNoti(message: string, userId: string): Promise<void> {
    try {
      if (!message || !userId) return;

      // Send SSE immediately if user is connected — no DB wait
      if (this.sseService.isUserConnected(userId)) {
        const now = new Date();
        const pad = (n: number) => n.toString().padStart(2, '0');
        let hours = now.getHours();
        const minutes = pad(now.getMinutes());
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;

        this.sseService.sendToUser(userId, {
          type: 'notification',
          message,
          date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
          time: `${pad(hours)}:${minutes} ${ampm}`,
          isRead: false,
          userId,
          timestamp: now.toISOString(),
        });
      }

      // Save to DB in background — don't await, don't block the API
      this.saveNotificationToDb(message, userId).catch((err) =>
        logger.error(`createNoti DB save failed for user ${userId}:`, err)
      );

    } catch (error) {
      logger.error(`createNoti failed for user ${userId}:`, error);
    }
  }

  public async saveNotificationToDb(message: string, userId: string): Promise<void> {
    const user = await this.userService.findUserById(userId);
    if (!user) return;
    const notification = this.notificationRepository.create({ message, user });
    await this.notificationRepository.save(notification);
  }

  async getAllNoti(): Promise<any> {
    const rawNotifications = await this.notificationRepository
      .createQueryBuilder('notification')
      .leftJoinAndSelect('notification.user', 'user')
      // .where('user.id = :userId', { userId })
      .select(['notification.id', 'notification.message', 'user.id'])
      .orderBy('notification.createdAt', 'ASC')
      .getRawMany();

    return rawNotifications.map((item) => ({
      id: item.notification_id,
      message: item.notification_message,
      user: item.user_id,
    }));
  }

  //TODO:By Vaishali..get all nottification by user
  async getNotiByUserId(userId: string): Promise<any> {
    const rawNotifications = await this.notificationRepository
      .createQueryBuilder('notification')
      .leftJoin('notification.user', 'user')
      .where('user.id = :userId', { userId })
      .orderBy('notification.createdAt', 'ASC')
      .select([
        'notification.id',
        'notification.message',
        'notification.isRead',
        'notification.createdAt',
      ])
      .getRawMany();

    return rawNotifications.map((item) => {
      const createdAt = item.notification_createdAt as Date;

      // Pad helper
      const pad = (n: number) => n.toString().padStart(2, '0');

      // Date part yyyy-mm-dd
      const year = createdAt.getFullYear();
      const month = pad(createdAt.getMonth() + 1);
      const day = pad(createdAt.getDate());
      const formattedDate = `${year}-${month}-${day}`;

      // Time part hh:mm AM/PM
      let hours = createdAt.getHours();
      const minutes = pad(createdAt.getMinutes());
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // hour '0' should be '12'
      const formattedTime = `${pad(hours)}:${minutes} ${ampm}`;

      return {
        id: item.notification_id,
        message: item.notification_message,
        date: formattedDate,
        time: formattedTime,
        isRead: item.notification_isRead,
      };
    });
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.notificationRepository
      .createQueryBuilder()
      .update()
      .set({ isRead: true })
      .where('id = :notificationId AND user_id = :userId', { notificationId, userId })
      .execute();
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepository
      .createQueryBuilder()
      .update()
      .set({ isRead: true })
      .where('user_id = :userId AND "isRead" = false', { userId })
      .execute();
  }

  // Batch notification for multiple users — optimized for performance
  async createBatchNoti(message: string, userIds: string[]): Promise<void> {
    if (!message || !userIds || userIds.length === 0) return;

    try {
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      let hours = now.getHours();
      const minutes = pad(now.getMinutes());
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;

      const formattedDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const formattedTime = `${pad(hours)}:${minutes} ${ampm}`;

      const ssePayload = {
        type: 'notification',
        message,
        date: formattedDate,
        time: formattedTime,
        isRead: false,
        timestamp: now.toISOString(),
      };

      // Send SSE to all connected users immediately (non-blocking)
      for (const userId of userIds) {
        if (this.sseService.isUserConnected(userId)) {
          this.sseService.sendToUser(userId, { ...ssePayload, userId });
        }
      }

      // Save to DB in background (non-blocking)
      this.saveBatchNotificationsToDb(message, userIds).catch((err) =>
        logger.error(`createBatchNoti DB save failed:`, err)
      );

    } catch (error) {
      logger.error(`createBatchNoti failed:`, error);
    }
  }

  private async saveBatchNotificationsToDb(message: string, userIds: string[]): Promise<void> {
    const users = await Promise.all(
      userIds.map(userId => this.userService.findUserById(userId))
    );

    const validUsers = users.filter(user => user !== null);
    if (validUsers.length === 0) return;

    const notifications = validUsers.map(user =>
      this.notificationRepository.create({ message, user })
    );

    await this.notificationRepository.save(notifications);
  }
}
