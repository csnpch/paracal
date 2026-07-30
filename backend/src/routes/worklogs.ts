import { Elysia, t } from 'elysia';
import config from '../config';
import { WorklogService } from '../services/worklogService';
import Logger from '../utils/logger';

const worklogService = new WorklogService(config.jiraWorklogApiUrl, config.jiraBrowseBaseUrl);

const isIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

export const worklogsRoutes = new Elysia({ prefix: '/worklogs' })
  .get('/', async ({ query, set }) => {
    if (!isIsoDate(query.start) || !isIsoDate(query.end)) {
      set.status = 400;
      return { error: 'start and end must use YYYY-MM-DD format' };
    }

    try {
      return await worklogService.getWorklogs(query);
    } catch (error) {
      Logger.error('Unable to fetch Jira worklogs:', error);
      set.status = 502;
      return { error: 'Jira worklog service is unavailable' };
    }
  }, {
    query: t.Object({
      start: t.String(),
      end: t.String(),
      project: t.Optional(t.String()),
    }),
  });
