import { injectable } from 'inversify';
import { Response } from 'express';
import logger from '../utils/logger';

interface SSEClient {
  id: string;
  userId: string;
  response: Response;
  lastEventId?: string;
}

@injectable()
export class SSEService {
  private clients: Map<string, SSEClient[]> = new Map();

  /**
   * Add a new SSE client connection
   */
  addClient(userId: string, clientId: string, res: Response): void {
    // Get existing clients for this user
    const userClients = this.clients.get(userId) || [];
    
    // Add new client
    userClients.push({
      id: clientId,
      userId,
      response: res,
    });
    
    this.clients.set(userId, userClients);

    logger.info(`SSE client connected: ${clientId} for user: ${userId}`);

    // Send initial connection message
    this.sendToClient(res, {
      type: 'connected',
      message: 'Connected to notification stream',
      timestamp: new Date().toISOString(),
    });

    // Handle client disconnect
    res.on('close', () => {
      this.removeClient(userId, clientId);
      logger.info(`SSE client disconnected: ${clientId} for user: ${userId}`);
    });
  }

  /**
   * Remove a client connection
   */
  removeClient(userId: string, clientId: string): void {
    const userClients = this.clients.get(userId);
    if (userClients) {
      const filteredClients = userClients.filter(client => client.id !== clientId);
      
      if (filteredClients.length === 0) {
        this.clients.delete(userId);
      } else {
        this.clients.set(userId, filteredClients);
      }
    }
  }

  /**
   * Send notification to specific user
   */
  sendToUser(userId: string, data: any): void {
    const userClients = this.clients.get(userId);
    
    if (userClients && userClients.length > 0) {
      userClients.forEach(client => {
        this.sendToClient(client.response, data);
      });
      
      logger.info(`Notification sent to user ${userId}: ${data.type}`);
    } else {
      logger.warn(`No active SSE clients for user: ${userId}`);
    }
  }

  /**
   * Send notification to multiple users
   */
  sendToUsers(userIds: string[], data: any): void {
    userIds.forEach(userId => {
      this.sendToUser(userId, data);
    });
  }

  /**
   * Broadcast to all connected clients
   */
  broadcast(data: any): void {
    let sentCount = 0;
    
    this.clients.forEach((userClients, userId) => {
      userClients.forEach(client => {
        this.sendToClient(client.response, data);
        sentCount++;
      });
    });
    
    logger.info(`Broadcast sent to ${sentCount} clients`);
  }

  /**
   * Send data to a specific client response
   */
  private sendToClient(res: Response, data: any): void {
    try {
      const eventData = {
        ...data,
        timestamp: data.timestamp || new Date().toISOString(),
      };
      res.write(`data: ${JSON.stringify(eventData)}\n\n`);
      // Force flush — required with compression middleware
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }
    } catch (error) {
      logger.error('Error sending SSE message:', error);
    }
  }

  /**
   * Send heartbeat to keep connection alive
   */
  sendHeartbeat(): void {
    this.clients.forEach((userClients) => {
      userClients.forEach(client => {
        try {
          client.response.write(': heartbeat\n\n');
          if (typeof (client.response as any).flush === 'function') {
            (client.response as any).flush();
          }
        } catch (error) {
          logger.error('Error sending heartbeat:', error);
        }
      });
    });
  }

  /**
   * Get count of active connections
   */
  getActiveConnectionsCount(): number {
    let count = 0;
    this.clients.forEach(userClients => {
      count += userClients.length;
    });
    return count;
  }

  /**
   * Get active users
   */
  getActiveUsers(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Check if user has active connection
   */
  isUserConnected(userId: string): boolean {
    const userClients = this.clients.get(userId);
    return userClients !== undefined && userClients.length > 0;
  }
}
