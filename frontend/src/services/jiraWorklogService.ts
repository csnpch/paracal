import {
  buildJiraWorklogRequestUrl,
  classifyWorklogNetworkError,
  isWorklogTimeoutError,
  JIRA_BROWSE_BASE_URL,
  JiraWorklogResponse,
  normalizeWorklogResponse,
  resolveClientJiraWorklogApiBase,
  WORKLOG_FETCH_TIMEOUT_MS,
  WORKLOG_UNAVAILABLE_MESSAGE,
} from '../../../shared/jiraWorklog';

export class WorklogFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorklogFetchError';
  }
}

export const fetchWorklogs = async (params: {
  start: string;
  end: string;
  project?: string;
  signal?: AbortSignal;
}): Promise<JiraWorklogResponse> => {
  const baseUrl = resolveClientJiraWorklogApiBase();
  const url = buildJiraWorklogRequestUrl(baseUrl, params);

  let response: Response;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), WORKLOG_FETCH_TIMEOUT_MS);
  const onUserAbort = () => controller.abort();

  if (params.signal) {
    if (params.signal.aborted) {
      window.clearTimeout(timeoutId);
      throw new DOMException('The operation was aborted.', 'AbortError');
    }
    params.signal.addEventListener('abort', onUserAbort);
  }

  try {
    response = await fetch(url, { signal: controller.signal });
  } catch (error) {
    if (params.signal?.aborted) {
      throw error;
    }

    if (isWorklogTimeoutError(error)) {
      throw new WorklogFetchError(WORKLOG_UNAVAILABLE_MESSAGE);
    }

    throw new WorklogFetchError(classifyWorklogNetworkError());
  } finally {
    window.clearTimeout(timeoutId);
    if (params.signal) {
      params.signal.removeEventListener('abort', onUserAbort);
    }
  }

  if (!response.ok) {
    throw new WorklogFetchError(WORKLOG_UNAVAILABLE_MESSAGE);
  }

  try {
    const payload = await response.json();
    return normalizeWorklogResponse(payload, JIRA_BROWSE_BASE_URL);
  } catch {
    throw new WorklogFetchError(WORKLOG_UNAVAILABLE_MESSAGE);
  }
};
