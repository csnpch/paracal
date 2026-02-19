const config = {
  appName: 'Paracal',
  appUrl: process.env.APP_URL || 'http://localhost:8080',
  adminPassword: process.env.ADMIN_PASSWORD || '',
  calendarificApiKey: process.env.CALENDARIFIC_API_KEY || '',
  port: Number(process.env.PORT) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
};

export default config;
