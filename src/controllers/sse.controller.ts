import { inject } from 'inversify';
import {
  controller,
  httpGet,
  request,
  response,
  next,
} from 'inversify-express-utils';
import { Request, Response, NextFunction } from 'express';
import { TYPES } from '../types';
import { SSEService } from '../services/sse.service';
import { deserializeUser, requireUser } from '../middleware/deserializeUser';
import logger from '../utils/logger';

@controller('/sse', deserializeUser, requireUser)
export class SSEController {
  constructor(
    @inject(TYPES.SSEService) private sseService: SSEService
  ) {}

  /**
   * SSE endpoint for notifications
   * GET /sse/notifications
   */
  @httpGet('/notifications')
  public streamNotifications(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      // Get user ID from authenticated user
      const userId = res.locals.user?.id;
      
      if (!userId) {
        logger.warn('SSE connection attempt without authentication');
        return res.status(401).json({
          status: 'error',
          message: 'User not authenticated',
        });
      }

      // Generate unique client ID using timestamp
      const clientId = `${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      logger.info(`SSE connection request from user ${userId}, clientId: ${clientId}`);

      // Add client to SSE service
      this.sseService.addClient(userId, clientId, res);

      logger.info(`User ${userId} successfully connected to SSE notifications`);

      // Keep connection alive with heartbeat
      const heartbeatInterval = setInterval(() => {
        if (res.writableEnded) {
          clearInterval(heartbeatInterval);
          logger.info(`Heartbeat stopped for user ${userId}, connection ended`);
          return;
        }
        this.sseService.sendHeartbeat();
      }, 30000); // Send heartbeat every 30 seconds

      // Clean up on connection close
      req.on('close', () => {
        clearInterval(heartbeatInterval);
        this.sseService.removeClient(userId, clientId);
        logger.info(`SSE connection closed for user ${userId}, clientId: ${clientId}`);
      });

    } catch (error) {
      logger.error('Error in SSE stream:', error);
      next(error);
    }
  }

  /**
   * Get SSE connection status
   * GET /sse/status
   */
  @httpGet('/status')
  public async getStatus(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const userId = res.locals.user?.id;
      
      const status = {
        totalConnections: this.sseService.getActiveConnectionsCount(),
        activeUsers: this.sseService.getActiveUsers().length,
        userConnected: userId ? this.sseService.isUserConnected(userId) : false,
      };

      res.status(200).json({
        status: 'success',
        data: status,
      });
    } catch (error) {
      logger.error('Error getting SSE status:', error);
      next(error);
    }
  }

  /**
   * Test SSE endpoint - Simple test without full auth
   * GET /sse/test
   */
  @httpGet('/test')
  public testSSE(
    @request() req: Request,
    @response() res: Response
  ) {
    try {
      logger.info('SSE test endpoint called');

      // Set SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      // Send initial message
      res.write(`data: ${JSON.stringify({ 
        type: 'test', 
        message: 'SSE test connection successful!',
        timestamp: new Date().toISOString()
      })}\n\n`);

      // Send a few test messages
      let count = 0;
      const interval = setInterval(() => {
        count++;
        res.write(`data: ${JSON.stringify({ 
          type: 'test', 
          message: `Test message ${count}`,
          timestamp: new Date().toISOString()
        })}\n\n`);

        if (count >= 5) {
          clearInterval(interval);
          res.write(`data: ${JSON.stringify({ 
            type: 'test', 
            message: 'Test complete! Connection will stay open.',
            timestamp: new Date().toISOString()
          })}\n\n`);
        }
      }, 2000);

      // Clean up on close
      req.on('close', () => {
        clearInterval(interval);
        logger.info('SSE test connection closed');
      });

    } catch (error) {
      logger.error('Error in SSE test:', error);
      res.status(500).json({ error: 'SSE test failed' });
    }
  }
}
