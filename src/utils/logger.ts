// // src/utils/logger.ts

// import { createLogger, format, transports } from 'winston';
// import path from 'path';
// import { captureUserInfo } from '../middleware/capturesystemInfo';

// // Directory for log files
// const logDirectory = process.env.LOG_DIR || path.join(__dirname, '../../logs');

// // Define custom log levels
// const levels = {
//   error: 0,
//   warn: 1,
//   info: 2,
//   http: 3,
//   debug: 4,
// };

// // Set up Winston logger configuration
// const logger = createLogger({
//   level: process.env.LOG_LEVEL || 'info', // Default to 'info' level
//   levels,
//   format: format.combine(
//     format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
//     format.errors({ stack: true }),  // Capture stack traces for errors
//     format.splat(),
//     format.json()  // Log messages in JSON format
//   ),
//   transports: [
//     // File transport for error logs
//     new transports.File({
//       filename: path.join(logDirectory, 'error.log'),
//       level: 'error',
//       maxsize: 5 * 1024 * 1024, // 5MB per file
//       maxFiles: 5,  // Rotate after 5 files
//     }),
//     // File transport for all logs
//     new transports.File({
//       filename: path.join(logDirectory, 'combined.log'),
//       maxsize: 10 * 1024 * 1024, // 10MB per file
//       maxFiles: 5,
//     }),
//   ],
// });

// // Optionally log to console in development
// if (process.env.NODE_ENV !== 'production') {
//   logger.add(
//     new transports.Console({
//       format: format.combine(
//         format.colorize(),
//         format.printf(({ level, message, timestamp, stack }) => {
//           return `${timestamp} [${level}]: ${stack || message}`;
//         })
//       ),
//     })
//   );
// }

// export default logger;

import { createLogger, format, transports } from 'winston';
import path from 'path';
import { format as dateFnsFormat } from 'date-fns';

// Directory for log files
const logDirectory = process.env.LOG_DIR || path.join(__dirname, '../../logs');

// Define custom log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Set up Winston logger configuration
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format: format.combine(
    format.timestamp({
      format: () => dateFnsFormat(new Date(), 'yyyy-MM-dd hh:mm:ss a'), // AM/PM format
    }),
    format.errors({ stack: true }),
    format.printf(({ level, message, timestamp, stack, ...meta }) => {
      return `${timestamp} [${level}]: ${message} ${meta.ip ? `[IP: ${meta.ip}]` : ''}`;
    })
  ),
  transports: [
    new transports.File({
      filename: path.join(logDirectory, 'error.log'),
      level: 'error',
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 5,
    }),
    new transports.File({
      filename: path.join(logDirectory, 'combined.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
  ],
});

// Console transport for non-production environments
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(({ level, message, timestamp, stack, ...meta }) => {
          return `${timestamp} [${level}]: ${message} ${meta.ip ? `[IP: ${meta.ip}]` : ''}`;
        })
      ),
    })
  );
}

export default logger;
