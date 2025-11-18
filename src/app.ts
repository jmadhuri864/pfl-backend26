import "@aws-sdk/crc64-nvme-crt";
import 'reflect-metadata';

import express, { Request, Response, NextFunction } from 'express';
import { InversifyExpressServer } from 'inversify-express-utils';
import { container } from './inversify.config';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';

import { AppDataSource } from './utils/data-source';
import { seedAdmin } from './seed';
import { seedDatabase } from './seed/companyseed';
import { captureUserInfo } from './middleware/capturesystemInfo';
import { captureUser } from './middleware/deserializeUser';
import { logRequestMiddleware } from './middleware/captureip';
import { pagination } from 'typeorm-pagination';
import {
  timezoneMiddleware,
  TransformResponseMiddleware,
} from './middleware/timezone';
import logger from './utils/logger';
import AppError from './utils/appError';
import './cron/cronJob';
import { seedDocumentDefDatabase } from './seed/documentSeed';


dotenv.config();

// process.on('unhandledRejection', (reason, promise) => {
//   logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
//   process.exit(1);
// });
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Promise Rejection:', {
    reason,
    stack: reason?.stack || '',
    message: reason?.message || reason,
  });

  // Optionally alert or retry logic here
  // For critical errors, you could still exit:
  // process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

const startServer = async () => {
  try {
    await AppDataSource.initialize();
    logger.info('Database connected successfully');

    await seedAdmin();
    await seedDatabase();
    await seedDocumentDefDatabase();


    //await seedPackingMaterials(AppDataSource);

    const inversifyServer = new InversifyExpressServer(container);

    inversifyServer.setConfig((app) => {
      app.use(express.json());
      app.use(helmet());
      app.use(compression());
      app.use(
        cors({
          origin: '*',
          methods: (process.env.CORS_METHODS || 'GET,POST,PATCH,DELETE,OPTIONS,PUT').split(','),
          allowedHeaders: [
            'Content-Type',
            'Authorization',
            'ngrok-skip-browser-warning'
          ],
        }),
      );

      app.use(pagination);
      app.use(captureUserInfo);
      app.use(captureUser);
      app.use(timezoneMiddleware);
      app.use(TransformResponseMiddleware.transform);
      app.use(logRequestMiddleware);

      app.get('/', (req: Request, res: Response) => {
        logger.info('Request received');
        res.send('Hello World!');
      });
    });

    inversifyServer.setErrorConfig((app) => {
      app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
        if (err instanceof AppError) {
          logger.error(`AppError: ${err.message}`, {
            statusCode: err.statusCode,
          });
          return res.status(err.statusCode).json({
            status: err.status || 'error',
            message: err.message || 'Internal Server Error',
          });
        }
        console.log(err);
        logger.error(`Unhandled Error: ${err.message}`, { stack: err.stack });

        return res.status(500).json({
          status: 'error',
          message: 'Internal Server Error',
        });
      });
    });

    const app = inversifyServer.build();

    const port = process.env.PORT || 8003;
    app.listen(port, () => {
      logger.info(`🚀 Server started on port ${port}`);
      logger.info(`📡 SSE endpoint: http://localhost:${port}/sse/notifications`);
      logger.info(`🧪 SSE test: http://localhost:${port}/sse/test`);
    });

    process.on('SIGINT', () => {
      logger.info('Shutting down gracefully...');
      process.exit(0);
    });
  } catch (error) {
    logger.error('Error starting the server:', error);
    process.exit(1);
  }
};

startServer();