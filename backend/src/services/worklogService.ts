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

type Fetcher = (url: string) => Promise<Response>;

export const WORKLOG_FETCH_TIMEOUT_MS = 15_000;

export const WORKLOG_UNAVAILABLE_MESSAGE =
  'ไม่สามารถโหลด Jira worklog ได้ กรุณาตรวจสอบการเชื่อมต่อ VPN แล้วลองใหม่อีกครั้ง';

const isTimeoutError = (error: unknown) =>
  error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');

const defaultFetcher: Fetcher = (url) =>
  fetch(url, { signal: AbortSignal.timeout(WORKLOG_FETCH_TIMEOUT_MS) });

const withIssueUrls = (entries: JiraWorklogEntry[], browseBaseUrl: string): JiraWorklogEntry[] => {
  if (!browseBaseUrl) return entries;

  const base = browseBaseUrl.replace(/\/+$/, '');
  return entries.map((entry) => ({
    ...entry,
    issueUrl: `${base}/${entry.issueKey}`,
  }));
};

const normalizeWorklogResponse = (
  payload: UpstreamWorklogResponse,
  browseBaseUrl: string,
): JiraWorklogResponse => ({
  authors: payload.authors ?? payload.members ?? [],
  entries: withIssueUrls(payload.entries ?? [], browseBaseUrl),
});

export class WorklogService {
  constructor(
    private readonly upstreamUrl: string,
    private readonly jiraBrowseBaseUrl: string,
    private readonly fetcher: Fetcher = defaultFetcher,
  ) {}

  async getWorklogs({ start, end, project = 'ALL' }: WorklogQuery): Promise<JiraWorklogResponse> {
    const query = new URLSearchParams({ start, end, project });
    let response: Response;

    try {
      response = await this.fetcher(`${this.upstreamUrl}?${query.toString()}`);
    } catch (error) {
      if (isTimeoutError(error)) {
        throw new Error('Jira worklog request timed out');
      }
      throw new Error('Jira worklog service is unavailable');
    }

    if (!response.ok) {
      throw new Error('Jira worklog service is unavailable');
    }

    const payload = await response.json() as UpstreamWorklogResponse;
    return normalizeWorklogResponse(payload, this.jiraBrowseBaseUrl);
  }
}
