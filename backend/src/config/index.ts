const config = {
  appName: 'Paracal',
  appUrl: process.env.APP_URL || 'https://prc.solasu.com/',
  adminPassword: process.env.ADMIN_PASSWORD || '',
  calendarificApiKey: process.env.CALENDARIFIC_API_KEY || '',
  port: Number(process.env.PORT) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
};

export default config;
