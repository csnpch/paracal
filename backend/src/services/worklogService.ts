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
    private readonly fetcher: Fetcher = async (url) => fetch(url),
  ) {}

  async getWorklogs({ start, end, project = 'ALL' }: WorklogQuery): Promise<JiraWorklogResponse> {
    const query = new URLSearchParams({ start, end, project });
    const response = await this.fetcher(`${this.upstreamUrl}?${query.toString()}`);

    if (!response.ok) {
      throw new Error('Jira worklog service is unavailable');
    }

    const payload = await response.json() as UpstreamWorklogResponse;
    return normalizeWorklogResponse(payload, this.jiraBrowseBaseUrl);
  }
}
