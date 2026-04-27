import winston from 'winston';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow', 
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// Define format for logs
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

const isProduction = process.env.NODE_ENV === 'production';

// In production (Railway), only log to stdout — Railway's log viewer captures it.
// File transports on ephemeral disks grow unbounded and eventually block writes,
// causing the server to hang.
const transports: winston.transport[] = [
  new winston.transports.Console({ format }),
];

if (!isProduction) {
  const fileFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  );
  const rotation = { maxsize: 5 * 1024 * 1024, maxFiles: 3, tailable: true };

  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: fileFormat,
      ...rotation,
    }),
    new winston.transports.File({
      filename: 'logs/all.log',
      format: fileFormat,
      ...rotation,
    })
  );
}

const logLevel = isProduction ? 'info' : 'debug';

// Create logger
const Logger = winston.createLogger({
  level: logLevel,
  levels,
  format,
  transports,
  exitOnError: false,
});

export default Logger;