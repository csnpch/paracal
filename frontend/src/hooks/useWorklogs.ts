import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { normalizeWorklogEntries } from '@/lib/worklog';
import { getWorklogs, JiraWorklogResponse } from '@/services/api';

const WORKLOG_LOAD_ERROR_MESSAGE =
  'ไม่สามารถโหลด Jira worklog ได้ กรุณาตรวจสอบการเชื่อมต่อ VPN แล้วลองใหม่อีกครั้ง';

const WORKLOG_FETCH_DEBOUNCE_MS = 2000;

const isAbortedRequest = (error: unknown) =>
  axios.isAxiosError(error) && error.code === 'ERR_CANCELED';

interface UseWorklogsOptions {
  enabled: boolean;
  startDate: string;
  endDate: string;
}

const toCacheKey = (startDate: string, endDate: string) => `${startDate}:${endDate}`;

const normalizeWorklogResponse = (
  response: JiraWorklogResponse,
  startDate: string,
  endDate: string,
): JiraWorklogResponse => ({
  ...response,
  entries: normalizeWorklogEntries(response.entries, startDate, endDate),
});

export const useWorklogs = ({ enabled, startDate, endDate }: UseWorklogsOptions) => {
  const [data, setData] = useState<JiraWorklogResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchTrigger, setFetchTrigger] = useState(0);
  const cacheRef = useRef<Map<string, JiraWorklogResponse>>(new Map());
  const rangeRef = useRef({ startDate, endDate });
  const skipDebounceRef = useRef(false);

  rangeRef.current = { startDate, endDate };

  const refetch = useCallback(() => {
    const { startDate: start, endDate: end } = rangeRef.current;
    cacheRef.current.delete(toCacheKey(start, end));
    skipDebounceRef.current = true;
    setFetchTrigger((trigger) => trigger + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    const cacheKey = toCacheKey(startDate, endDate);
    const cached = cacheRef.current.get(cacheKey);

    if (cached) {
      setData(cached);
      setLoading(false);
      setError(null);
      return;
    }

    let active = true;
    const abortController = new AbortController();
    setData(null);
    setLoading(true);
    setError(null);

    const debounceMs = skipDebounceRef.current ? 0 : WORKLOG_FETCH_DEBOUNCE_MS;
    skipDebounceRef.current = false;

    const timer = window.setTimeout(() => {
      if (!active) return;

      getWorklogs({ start: startDate, end: endDate, signal: abortController.signal })
        .then((response) => {
          if (!active) return;
          const normalized = normalizeWorklogResponse(response, startDate, endDate);
          cacheRef.current.set(cacheKey, normalized);
          setData(normalized);
        })
        .catch((fetchError) => {
          if (!active || isAbortedRequest(fetchError)) return;
          const apiError = axios.isAxiosError(fetchError)
            ? (fetchError.response?.data as { error?: string } | undefined)?.error
            : undefined;
          setError(apiError || WORKLOG_LOAD_ERROR_MESSAGE);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, debounceMs);

    return () => {
      active = false;
      window.clearTimeout(timer);
      abortController.abort();
    };
  }, [enabled, startDate, endDate, fetchTrigger]);

  return { data, loading, error, refetch };
};
