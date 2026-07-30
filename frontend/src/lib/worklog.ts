import type { JiraWorklogEntry } from '@/services/api';

export const WORKLOG_TARGET_SECONDS = 8 * 3600;
export const JIRA_BROWSE_BASE_URL = 'https://cjmore.atlassian.net/browse';
export const WORKLOG_AUTHOR_STORAGE_KEY = 'paracal.worklogAuthorId';

export const getStoredWorklogAuthorId = () => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(WORKLOG_AUTHOR_STORAGE_KEY) || '';
};

export const setStoredWorklogAuthorId = (authorId: string) => {
  if (typeof window === 'undefined') return;
  if (authorId) {
    localStorage.setItem(WORKLOG_AUTHOR_STORAGE_KEY, authorId);
  } else {
    localStorage.removeItem(WORKLOG_AUTHOR_STORAGE_KEY);
  }
};

export const formatWorklogDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours && minutes) return `${hours}h ${minutes}m`;
  if (hours) return `${hours}h`;
  return `${minutes}m`;
};

export const formatWorklogHours = (seconds: number) => {
  const hours = seconds / 3600;
  return Number.isInteger(hours) ? `${hours}` : hours.toFixed(1);
};

export const getWorklogDayTotalSeconds = (entries: JiraWorklogEntry[]) =>
  entries.reduce((sum, entry) => sum + entry.seconds, 0);

export const getJiraIssueUrl = (entry: JiraWorklogEntry) =>
  entry.issueUrl || `${JIRA_BROWSE_BASE_URL}/${entry.issueKey}`;
