import { describe, expect, test } from 'bun:test';
import { WorklogService } from '../../src/services/worklogService';

const rawEntry = {
  id: '1',
  projectKey: 'QAA',
  issueKey: 'QAA-1',
  issueSummary: 'Test issue',
  authorId: 'user-1',
  authorName: 'Jane Doe',
  started: '2026-07-01T09:00:00.000+0700',
  date: '2026-07-01',
  seconds: 3600,
};

const normalizedResponse = {
  authors: [{ id: 'user-1', name: 'Jane Doe' }],
  entries: [{ ...rawEntry, issueUrl: 'https://jira.example/browse/QAA-1' }],
};

describe('WorklogService', () => {
  test('forwards the inclusive range and project to Jira worklogs', async () => {
    const requestedUrls: string[] = [];
    const service = new WorklogService(
      'http://jira.example/api/worklogs',
      'https://jira.example/browse',
      async (url) => {
        requestedUrls.push(url);
        return new Response(JSON.stringify({ authors: normalizedResponse.authors, entries: [rawEntry] }), { status: 200 });
      },
    );

    await expect(service.getWorklogs({
      start: '2026-07-27',
      end: '2026-08-02',
      project: 'ALL',
    })).resolves.toEqual(normalizedResponse);

    expect(requestedUrls).toEqual([
      'http://jira.example/api/worklogs?start=2026-07-27&end=2026-08-02&project=ALL',
    ]);
  });

  test('maps upstream members to authors for the real Jira API', async () => {
    const service = new WorklogService(
      'http://jira.example/api/worklogs',
      'https://jira.example/browse',
      async () => new Response(JSON.stringify({
        members: [{ id: 'user-1', name: 'Jane Doe' }],
        entries: [rawEntry],
      }), { status: 200 }),
    );

    await expect(service.getWorklogs({
      start: '2026-07-01',
      end: '2026-07-31',
    })).resolves.toEqual(normalizedResponse);
  });

  test('reports an upstream failure without exposing a raw response body', async () => {
    const service = new WorklogService(
      'http://jira.example/api/worklogs',
      'https://jira.example/browse',
      async () => new Response('upstream unavailable', { status: 503 }),
    );

    await expect(service.getWorklogs({
      start: '2026-07-27',
      end: '2026-08-02',
    })).rejects.toThrow('Jira worklog service is unavailable');
  });

  test('times out upstream requests after 15 seconds', async () => {
    const service = new WorklogService(
      'http://jira.example/api/worklogs',
      'https://jira.example/browse',
      async () => {
        throw new DOMException('The operation timed out.', 'TimeoutError');
      },
    );

    await expect(service.getWorklogs({
      start: '2026-07-27',
      end: '2026-08-02',
    })).rejects.toThrow('Jira worklog request timed out');
  });
});
