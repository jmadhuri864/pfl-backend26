import "@aws-sdk/crc64-nvme-crt";
import 'reflect-metadata';
import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import { InversifyExpressServer } from 'inversify-express-utils';
import { container } from './inversify.config';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
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
import { apiLogger, errorLogger } from './middleware/apiLogger';
import './cron/cronJob';
import { seedDocumentDefDatabase } from './seed/documentSeed';
//import { LogCleanupService } from './services/logCleanup.service';
import { TYPES } from './types';
// Import LogCleanupController to ensure it's registered
import './controllers/logCleanup.controller';

dotenv.config();
/* ───────────── Allowed Origins ───────────── */
const allowedOrigins = [
  "*",
  "http://192.168.1.60:5173",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://192.168.1.39:5173",
  "http://192.168.1.36:5173/",
   "http://192.168.1.36:5173",
   "http://192.168.1.36:5173/",
  "https://d721a561c2dc.ngrok-free.app",
  "http://localhost:3000",
  "http://localhost:8004",
  "http://192.168.1.82:3000",
  "https://prime-fresh-erp.vercel.app/"
];

// process.on('unhandledRejection', (reason, promise) => {
//   logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
//   process.exit(1);
// });
process.on('unhandledRejection', (reason: any) => {
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

    // // Initialize automatic log cleanup service
    // const logCleanupService = container.get<LogCleanupService>(TYPES.LogCleanupService);
    // logCleanupService.startAutomaticCleanup();
    // logger.info('Automatic log cleanup service initialized');

    //await seedPackingMaterials(AppDataSource);

    const inversifyServer = new InversifyExpressServer(container);

    inversifyServer.setConfig((app) => {
      // Remove any existing CORS headers first
      app.use((req, res, next) => {
        res.removeHeader("Access-Control-Allow-Origin");
        res.removeHeader("Access-Control-Allow-Credentials");
        res.removeHeader("Access-Control-Allow-Headers");
        res.removeHeader("Access-Control-Allow-Methods");
        next();
      });

      app.use(express.json());
      app.use(cookieParser());
      
      // Configure helmet to not interfere with CORS
      app.use(helmet({
        crossOriginResourcePolicy: false, // Disable CORP
        crossOriginEmbedderPolicy: false, // Disable COEP
      }));
      
      // Skip compression for SSE endpoints — compression buffers the stream and delays events
      app.use(compression({
        filter: (req, res) => {
          if (req.path.includes('/sse') || req.headers.accept === 'text/event-stream') {
            return false;
          }
          return compression.filter(req, res);
        }
      }));

      // Main CORS handler - MUST be before any other middleware that might set headers
      app.use((req, res, next) => {
        const origin = req.headers.origin as string|| '*';
        // console.log('🔍 CORS Handler - Origin:', origin);
        // console.log('🔍 CORS Handler - Method:', req.method);
        // console.log('🔍 CORS Handler - Path:', req.path);
        
        // Allow all origins if '*' is in allowedOrigins, otherwise check specific origins
        if (allowedOrigins.includes("*") || (origin && allowedOrigins.includes(origin))) {
          res.setHeader("Access-Control-Allow-Origin", origin || "*");
          res.setHeader("Access-Control-Allow-Credentials", "true");
          res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, ngrok-skip-browser-warning, Cache-Control, X-Requested-With");
          res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS,PUT");
          // console.log('✅ CORS - Set origin to:', origin || "*");
        } else {
          // console.log('❌ CORS - Origin not in allowed list:', origin);
          // console.log('🔍 CORS - Allowed origins:', allowedOrigins);
        }

        // Handle preflight requests
        if (req.method === "OPTIONS") {
        //  console.log('🔍 Handling OPTIONS preflight for:', req.path);
          return res.status(204).end();
        }
        
        next();
      });

      // SSE-specific middleware - only for the streaming endpoint
      app.use("/sse/notifications", (req, res, next) => {
        const origin = req.headers.origin as string;
        if (origin && allowedOrigins.includes(origin)) {
          res.setHeader("Access-Control-Allow-Origin", origin);
          res.setHeader("Access-Control-Allow-Credentials", "true");
        }
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");
        res.flushHeaders(); // flush immediately so browser fires onopen
        next();
      });

      app.use(pagination);
      app.use(captureUserInfo);
      app.use(captureUser);
      app.use(timezoneMiddleware);
      app.use(TransformResponseMiddleware.transform);
      app.use(logRequestMiddleware);
      
      // Add API logging middleware (should be after user middleware)
      app.use(apiLogger);

      app.get('/', (_req: Request, res: Response) => {
        logger.info('Request received');
        res.send('Hello World!');
      });
    });

    inversifyServer.setErrorConfig((app) => {
      // Add error logging middleware
      app.use(errorLogger);

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
        //console.log(err);
        logger.error(`Unhandled Error: ${err.message}`, { stack: err.stack });

        return res.status(500).json({
          status: 'error',
          message: 'Internal Server Error',
        });
      });
    });

    const app = inversifyServer.build();

    const port = process.env.PORT || 3000;
    app.listen(port, () => {

      // console.log(`🚀 Server started on port ${port}`);
      // console.log(`📡 SSE endpoint: http://localhost:${port}/sse/notifications`);
      // console.log(`🧪 SSE test: http://localhost:${port}/sse/test`);
    });

    process.on('SIGINT', () => {
      logger.info('Shutting down gracefully...');
      process.exit(0);
    });
  } catch (error) {
    console.log(error)
    logger.error('Error starting the server:', error);
    process.exit(1);
  }
};

startServer();