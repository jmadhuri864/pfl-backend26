import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { CacheService } from '../services/cache.service';
import { container } from '../inversify.config';
import { TYPES } from '../types';
import logger from '../utils/logger';

// Performance monitoring middleware
export const performanceMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  // Override res.end to capture response time
  const originalEnd = res.end;
  res.end = function(...args: any[]) {
    const duration = Date.now() - startTime;
    
    // Log slow queries (> 1 second)
    if (duration > 1000) {
      logger.warn(`Slow API call: ${req.method} ${req.originalUrl} - ${duration}ms`);
    }
    
    // Add performance headers
    res.setHeader('X-Response-Time', `${duration}ms`);
    
    return originalEnd.apply(this, args);
  };
  
  next();
};

// Smart rate limiting based on endpoint type
export const createSmartRateLimit = (windowMs: number = 15 * 60 * 1000, max: number = 100) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Use Redis for distributed rate limiting
    store: {
      incr: async (key: string) => {
        try {
          const cacheService = container.get<CacheService>(TYPES.CacheService);
          const current = await cacheService.get<number>(key) || 0;
          const newValue = current + 1;
          await cacheService.set(key, newValue, Math.ceil(windowMs / 1000));
          return { totalHits: newValue, resetTime: new Date(Date.now() + windowMs) };
        } catch (error) {
          logger.error('Rate limit store error:', error);
          return { totalHits: 1, resetTime: new Date(Date.now() + windowMs) };
        }
      },
      decrement: async (key: string) => {
        // Optional: implement if needed
      },
      resetKey: async (key: string) => {
        try {
          const cacheService = container.get<CacheService>(TYPES.CacheService);
          await cacheService.del(key);
        } catch (error) {
          logger.error('Rate limit reset error:', error);
        }
      }
    }
  });
};

// Different rate limits for different endpoint types
export const authRateLimit = createSmartRateLimit(15 * 60 * 1000, 5); // 5 requests per 15 minutes for auth
export const apiRateLimit = createSmartRateLimit(15 * 60 * 1000, 1000); // 1000 requests per 15 minutes for API
export const uploadRateLimit = createSmartRateLimit(60 * 60 * 1000, 50); // 50 uploads per hour