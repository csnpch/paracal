import {
  buildJiraWorklogRequestUrl,
  isWorklogTimeoutError,
  JIRA_BROWSE_BASE_URL,
  JiraWorklogResponse,
  normalizeWorklogResponse,
  WorklogQuery,
} from '../../../shared/jiraWorklog';

type Fetcher = (url: string) => Promise<Response>;

const defaultFetcher: Fetcher = (url) =>
  fetch(url, { signal: AbortSignal.timeout(15_000) });

export class WorklogService {
  constructor(
    private readonly upstreamUrl: string,
    private readonly jiraBrowseBaseUrl: string = JIRA_BROWSE_BASE_URL,
    private readonly fetcher: Fetcher = defaultFetcher,
  ) {}

  async getWorklogs(query: WorklogQuery): Promise<JiraWorklogResponse> {
    const url = buildJiraWorklogRequestUrl(this.upstreamUrl, query);
    let response: Response;

    try {
      response = await this.fetcher(url);
    } catch (error) {
      if (isWorklogTimeoutError(error)) {
        throw new Error('Jira worklog request timed out');
      }
      throw new Error('Jira worklog service is unavailable');
    }

    if (!response.ok) {
      throw new Error('Jira worklog service is unavailable');
    }

    const payload = await response.json();
    return normalizeWorklogResponse(payload, this.jiraBrowseBaseUrl);
  }
}
