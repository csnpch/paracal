// Jira worklog integration — shared between frontend (browser) and backend (local dev proxy).

/** VPN-internal worklog API. Browser calls this directly when user has VPN (not via Railway). */
export const JIRA_WORKLOG_API_HOST = '172.29.100.179:3000';
export const JIRA_WORKLOG_API_PATH = '/api/worklogs';
export const JIRA_WORKLOG_API_URL = `http://${JIRA_WORKLOG_API_HOST}${JIRA_WORKLOG_API_PATH}`;

export const JIRA_BROWSE_BASE_URL = 'https://cjmore.atlassian.net/browse';

/** Same-origin dev proxy — see frontend/vite.config.ts */
export const JIRA_WORKLOG_DEV_PROXY_PATH = '/jira-worklog-api/worklogs';

export const WORKLOG_FETCH_TIMEOUT_MS = 15_000;

export const WORKLOG_UNAVAILABLE_MESSAGE =
  'ไม่สามารถโหลด Jira worklog ได้ กรุณาตรวจสอบการเชื่อมต่อ VPN แล้วลองใหม่อีกครั้ง';

export interface JiraWorklogAuthor {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface JiraWorklogEntry {
  id: string;
  projectKey: string;
  issueKey: string;
  issueSummary: string;
  authorId: string;
  authorName: string;
  avatarUrl?: string;
  started: string;
  date: string;
  seconds: number;
  comment?: string;
  issueUrl?: string;
}

export interface JiraWorklogResponse {
  authors: JiraWorklogAuthor[];
  entries: JiraWorklogEntry[];
}

export interface WorklogQuery {
  start: string;
  end: string;
  project?: string;
}

interface UpstreamWorklogResponse {
  members?: JiraWorklogAuthor[];
  authors?: JiraWorklogAuthor[];
  entries?: JiraWorklogEntry[];
}

export const isWorklogTimeoutError = (error: unknown) =>
  error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');

export const buildJiraWorklogRequestUrl = (
  baseUrl: string,
  { start, end, project = 'ALL' }: WorklogQuery,
): string => {
  const query = new URLSearchParams({ start, end, project });
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  return `${normalizedBase}?${query.toString()}`;
};

/**
 * Resolve worklog API base URL for browser fetch.
 * - Local dev: same-origin Vite proxy (no CORS)
 * - Production HTTPS: HTTPS to internal host (avoids mixed-content block; requires TLS on internal API)
 * - Production HTTP: direct HTTP to VPN-internal API
 */
export const resolveClientJiraWorklogApiBase = (): string => {
  if (typeof window === 'undefined') {
    return JIRA_WORKLOG_API_URL;
  }

  const { hostname, protocol, port } = window.location;
  const isLocalDev = hostname === 'localhost' || hostname === '127.0.0.1';

  if (isLocalDev) {
    const portSuffix = port ? `:${port}` : '';
    return `${protocol}//${hostname}${portSuffix}${JIRA_WORKLOG_DEV_PROXY_PATH}`;
  }

  if (protocol === 'https:') {
    return `https://${JIRA_WORKLOG_API_HOST}${JIRA_WORKLOG_API_PATH}`;
  }

  return JIRA_WORKLOG_API_URL;
};

const withIssueUrls = (entries: JiraWorklogEntry[], browseBaseUrl: string): JiraWorklogEntry[] => {
  if (!browseBaseUrl) return entries;

  const base = browseBaseUrl.replace(/\/+$/, '');
  return entries.map((entry) => ({
    ...entry,
    issueUrl: `${base}/${entry.issueKey}`,
  }));
};

export const normalizeWorklogResponse = (
  payload: UpstreamWorklogResponse,
  browseBaseUrl = JIRA_BROWSE_BASE_URL,
): JiraWorklogResponse => ({
  authors: payload.authors ?? payload.members ?? [],
  entries: withIssueUrls(payload.entries ?? [], browseBaseUrl),
});

export const classifyWorklogNetworkError = (): string => WORKLOG_UNAVAILABLE_MESSAGE;
