const config = {
  appName: 'Paracal',
  appUrl: (process.env.APP_URL || 'https://prc.solasu.com').replace(/\/+$/, ''),
  adminPassword: process.env.ADMIN_PASSWORD || '',
  calendarificApiKey: process.env.CALENDARIFIC_API_KEY || '',
  jiraWorklogApiUrl: (process.env.JIRA_WORKLOG_API_URL || 'http://172.29.100.179:3000/api/worklogs').replace(/\/+$/, ''),
  jiraBrowseBaseUrl: (process.env.JIRA_BROWSE_BASE_URL || 'https://cjmore.atlassian.net/browse').replace(/\/+$/, ''),
  port: Number(process.env.PORT) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
};

export default config;
