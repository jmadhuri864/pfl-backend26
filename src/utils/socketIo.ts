import { Server as SocketIOServer, Socket } from 'socket.io';
import { NotificationRepository } from '../repositories/notification.repository';

export const userSocketMap = new Map<string, string>();

export async function initializeWebSocket  (io: SocketIOServer , notificationRepository: NotificationRepository) {
  console.log('WebSocket server started');

  io.on('connection', (socket: Socket) => {
    
    console.log(`User connected: ${socket.id}`);
    //socket.emit('socketId', { socketId: socket.id });

   
    socket.on('registerUser', async(userId: string) => {
      userSocketMap.set(userId, socket.id.toString());
      console.log(`Registered: ${userId} -> ${socket.id}`);
      console.log('userSocketMAp', userSocketMap);
      //TODO:By Vaishali
    
        const notifications = await notificationRepository.find({
          where: { user: { id: userId }, isRead: false },
          order: { createdAt: 'DESC' }
        });


      console.log(
        `Unread notifications for ${userId}: ${notifications.length}`
      );

       for (const n of notifications) {

        const createdAt = n.createdAt as Date;

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
      
        console.log("Emiting at time og login")
        socket.emit("newNotification", { message: n.message ,date:formattedDate,time:formattedTime,isRead:n.isRead});
        n.isRead = true;
        await n.save();
      }
    });
     // socket.emit('user-registered', {msg: `User registered with userId : ${userId} and socketId: ${socket.id}`})
   // });

   
    // socket.on('sendNotification', ({ userId, message }: { userId: string; message: string }) => {
    //   const socketId = userSocketMap.get(userId.toString());
    //   if (socketId) {
    //     io.to(socketId).emit('newNotification', { message });
    //     //console.log(` Sent to ${userId}: ${message}`);
    //   }
    // });


    socket.on('client:test', data => {
      console.log('Received test:', data);
     
      io.emit('server:test', { msg: 'Hello from server!' });
    });
    


    socket.on('disconnect', () => {
      console.log(`Disconnected: ${socket.id}`);
      for (const [userId, socketId] of userSocketMap.entries()) {
        if (socketId === socket.id) {
          userSocketMap.delete(userId);
          console.log(`Removed mapping for ${userId}`);
          break;
        }
      }
    });
  });
};