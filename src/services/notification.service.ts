import { inject, injectable } from 'inversify';
import { TYPES } from '../types';
import { NotificationRepository } from '../repositories/notification.repository';
import { SSEService } from './sse.service';
import { UserService } from '../services/user.service';
import { userSocketMap } from '../utils/socketIo';

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
    if (!message) throw new Error('Message is required');

    const user = await this.userService.findUserById(userId);
    if (!user) throw new Error('User not found');

    const notification = this.notificationRepository.create({ message, user });
    await this.notificationRepository.save(notification);

    const createdAt = notification.createdAt;

    // Pad single digits to two digits
    const pad = (n: number) => n.toString().padStart(2, '0');

    // Date part
    const year = createdAt.getFullYear();
    const month = pad(createdAt.getMonth() + 1); // Month is 0-based
    const day = pad(createdAt.getDate());
    const formattedDate = `${year}-${month}-${day}`; // yyyy-mm-dd

    // Time part
    let hours = createdAt.getHours();
    const minutes = pad(createdAt.getMinutes());
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // hour '0' should be '12'
    const formattedTime = `${pad(hours)}:${minutes} ${ampm}`; // hh:mm AM/PM

    // console.log('Date:', formattedDate);
    // console.log('Time:', formattedTime);

    const socketId = userSocketMap.get(userId.toString());
    // Prepare notification data for SSE
    const notificationData = {
      type: 'notification',
      id: notification.id,
      message: message,
      date: formattedDate,
      time: formattedTime,
      isRead: notification.isRead,
      userId: userId,
      timestamp: notification.createdAt.toISOString(),
      userName: `${user.firstName} ${user.lastName}`.trim(),
    };

    console.log('✅ Notification created:', {
      id: notificationData.id,
      message: notificationData.message,
      userId: notificationData.userId,
      timestamp: notificationData.timestamp,
    });

    // Send notification via SSE
    if (this.sseService.isUserConnected(userId)) {
      this.sseService.sendToUser(userId, notificationData);
      console.log(
        `📤 SSE notification sent to ${user.firstName} ${user.lastName} (${userId})`,
      );
    } else {
      console.log(
        `⚠️  User ${user.firstName} ${user.lastName} (${userId}) not connected to SSE - notification saved to database`,
      );
    }
  }

  async getAllNoti(): Promise<any> {
    const rawNotifications = await this.notificationRepository
      .createQueryBuilder('notification')
      .leftJoinAndSelect('notification.user', 'user')
      // .where('user.id = :userId', { userId })
      .select(['notification.id', 'notification.message', 'user.id'])
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
        message: item.notification_message,
        date: formattedDate,
        time: formattedTime,
        isRead: item.notification_isRead,
      };
    });
  }
}