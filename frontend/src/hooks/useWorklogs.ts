import { useCallback, useEffect, useRef, useState } from 'react';
import { getWorklogs, JiraWorklogResponse } from '@/services/api';

interface UseWorklogsOptions {
  enabled: boolean;
  startDate: string;
  endDate: string;
}

export const useWorklogs = ({ enabled, startDate, endDate }: UseWorklogsOptions) => {
  const [data, setData] = useState<JiraWorklogResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const fetchedRef = useRef<{ start: string; end: string; refreshKey: number } | null>(null);

  const refetch = useCallback(() => {
    setRefreshKey((key) => key + 1);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const isCached =
      fetchedRef.current?.start === startDate &&
      fetchedRef.current?.end === endDate &&
      fetchedRef.current?.refreshKey === refreshKey;

    if (isCached) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    getWorklogs({ start: startDate, end: endDate })
      .then((response) => {
        if (active) {
          setData(response);
          fetchedRef.current = { start: startDate, end: endDate, refreshKey };
        }
      })
      .catch(() => {
        if (active) {
          setError('ไม่สามารถโหลด Jira worklog ได้ กรุณาลองใหม่อีกครั้ง');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [enabled, startDate, endDate, refreshKey]);

  return { data, loading, error, refetch };
};
