import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FEATURE_TOUR_WELCOME_KEY, hasSeenOnboarding, markOnboardingSeen } from '@/lib/onboarding';

const getVisibleTargetRects = (selectors: string[]): DOMRect[] => {
  const rects: DOMRect[] = [];
  const seen = new Set<string>();

  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((element) => {
      if (!(element instanceof HTMLElement)) return;

      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const key = `${Math.round(rect.top)}:${Math.round(rect.left)}:${Math.round(rect.width)}:${Math.round(rect.height)}`;
      if (seen.has(key)) return;

      seen.add(key);
      rects.push(rect);
    });
  });

  return rects;
};

const getVisibleTargetRect = (selector: string): DOMRect | null => {
  const rects = getVisibleTargetRects([selector]);
  return rects[0] ?? null;
};

interface TourTooltipProps {
  title: string;
  description: string;
  tooltipTop: number;
  tooltipLeft: number;
  onDismiss: (event: React.MouseEvent) => void;
}

const TourTooltip: React.FC<TourTooltipProps> = ({
  title,
  description,
  tooltipTop,
  tooltipLeft,
  onDismiss,
}) => (
  <div
    className="absolute z-[1] w-[min(17rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-gray-200 bg-white p-2.5 shadow-2xl dark:border-gray-600 dark:bg-gray-800 pointer-events-auto"
    style={{
      top: tooltipTop,
      left: tooltipLeft,
    }}
    onClick={(event) => event.stopPropagation()}
  >
    <div
      className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-800"
      aria-hidden="true"
    />

    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 space-y-1">
        <h3 className="text-xs font-semibold leading-snug text-gray-900 dark:text-white">{title}</h3>
        <p className="text-[10px] leading-snug text-gray-500 dark:text-gray-400">{description}</p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-6 w-6 shrink-0 p-0 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100"
        aria-label="Close tour"
        onClick={onDismiss}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  </div>
);

interface TourOverlayProps {
  rect: DOMRect;
  padding: number;
  borderRadius: number;
  onBackdropClick: () => void;
  children: React.ReactNode;
}

const TourOverlay: React.FC<TourOverlayProps> = ({
  rect,
  padding,
  borderRadius,
  onBackdropClick,
  children,
}) => {
  const maskId = useId().replace(/:/g, '');
  const holeTop = rect.top - padding;
  const holeLeft = rect.left - padding;
  const holeWidth = rect.width + padding * 2;
  const holeHeight = rect.height + padding * 2;
  const holeBottom = holeTop + holeHeight;
  const holeRight = holeLeft + holeWidth;

  const backdropClass = 'fixed pointer-events-auto bg-black/72';

  return (
    <div className="fixed inset-0 z-[2000] pointer-events-none">
      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <mask id={maskId}>
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect
              x={holeLeft}
              y={holeTop}
              width={holeWidth}
              height={holeHeight}
              rx={borderRadius}
              fill="black"
            />
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.72)" mask={`url(#${maskId})`} />
      </svg>

      {holeTop > 0 && (
        <div
          className={backdropClass}
          style={{ top: 0, left: 0, right: 0, height: holeTop }}
          onClick={onBackdropClick}
          aria-hidden="true"
        />
      )}
      {holeLeft > 0 && (
        <div
          className={backdropClass}
          style={{ top: holeTop, left: 0, width: holeLeft, height: holeHeight }}
          onClick={onBackdropClick}
          aria-hidden="true"
        />
      )}
      <div
        className={backdropClass}
        style={{ top: holeTop, left: holeRight, right: 0, height: holeHeight }}
        onClick={onBackdropClick}
        aria-hidden="true"
      />
      <div
        className={backdropClass}
        style={{ top: holeBottom, left: 0, right: 0, bottom: 0 }}
        onClick={onBackdropClick}
        aria-hidden="true"
      />

      <div
        className="pointer-events-none absolute rounded-lg ring-2 ring-white/90 transition-[top,left,width,height] duration-150"
        style={{
          top: holeTop,
          left: holeLeft,
          width: holeWidth,
          height: holeHeight,
          borderRadius,
        }}
      />

      {children}
    </div>
  );
};

interface SpotlightTourProps {
  storageKey: string;
  enabled?: boolean;
  title: string;
  children: React.ReactNode;
  padding?: number;
  borderRadius?: number;
}

export const SpotlightTour: React.FC<SpotlightTourProps> = ({
  storageKey,
  enabled = true,
  title,
  children,
  padding = 8,
  borderRadius = 10,
}) => {
  const targetRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const updateRect = useCallback(() => {
    if (!targetRef.current) return;
    setRect(targetRef.current.getBoundingClientRect());
  }, []);

  const dismiss = useCallback(() => {
    markOnboardingSeen(storageKey);
    setOpen(false);
  }, [storageKey]);

  useEffect(() => {
    if (!enabled || hasSeenOnboarding(storageKey)) return;

    const timer = window.setTimeout(() => {
      setOpen(true);
    }, 500);

    return () => window.clearTimeout(timer);
  }, [enabled, storageKey]);

  useEffect(() => {
    if (!open) return;

    updateRect();

    const handleResize = () => updateRect();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, dismiss, updateRect]);

  const tooltipLeft = rect
    ? Math.min(Math.max(rect.left + rect.width / 2, 140), window.innerWidth - 140)
    : 0;
  const tooltipTop = rect ? rect.bottom + padding + 12 : 0;

  return (
    <>
      <div ref={targetRef} className="inline-flex">
        {children}
      </div>

      {open && rect && createPortal(
        <TourOverlay
          rect={rect}
          padding={padding}
          borderRadius={borderRadius}
          onBackdropClick={dismiss}
        >
          <TourTooltip
            title={title}
            description="แตะที่ใดก็ได้เพื่อปิด"
            tooltipTop={tooltipTop}
            tooltipLeft={tooltipLeft}
            onDismiss={(event) => {
              event.stopPropagation();
              dismiss();
            }}
          />
        </TourOverlay>,
        document.body,
      )}
    </>
  );
};


interface SpotlightTargetTourProps {
  storageKey: string;
  enabled?: boolean;
  targetSelector: string;
  title: string;
  padding?: number;
  borderRadius?: number;
  dismissSignal?: number;
  onComplete?: () => void;
  onOpenChange?: (open: boolean) => void;
}

export const SpotlightTargetTour: React.FC<SpotlightTargetTourProps> = ({
  storageKey,
  enabled = true,
  targetSelector,
  title,
  padding = 8,
  borderRadius = 10,
  dismissSignal = 0,
  onComplete,
  onOpenChange,
}) => {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const updateRect = useCallback(() => {
    setRect(getVisibleTargetRect(targetSelector));
  }, [targetSelector]);

  const dismiss = useCallback(() => {
    markOnboardingSeen(storageKey);
    setOpen(false);
    onOpenChange?.(false);
    onComplete?.();
  }, [onComplete, onOpenChange, storageKey]);

  useEffect(() => {
    if (!dismissSignal) return;
    if (open) dismiss();
  }, [dismissSignal, open, dismiss]);

  useEffect(() => {
    if (!enabled || hasSeenOnboarding(storageKey)) return;

    let attempts = 0;
    let retryTimer: number | undefined;
    const maxAttempts = 20;

    const tryOpen = () => {
      const nextRect = getVisibleTargetRect(targetSelector);
      if (nextRect || attempts >= maxAttempts) {
        if (nextRect) {
          setRect(nextRect);
          setOpen(true);
          onOpenChange?.(true);
        }
        return;
      }

      attempts += 1;
      retryTimer = window.setTimeout(tryOpen, 100);
    };

    const startTimer = window.setTimeout(tryOpen, 500);

    return () => {
      window.clearTimeout(startTimer);
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [enabled, onOpenChange, storageKey, targetSelector]);

  useEffect(() => {
    if (!open) return;

    updateRect();

    const handleResize = () => updateRect();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, dismiss, updateRect]);

  if (!open || !rect) return null;

  const tooltipLeft = Math.min(Math.max(rect.left + rect.width / 2, 140), window.innerWidth - 140);
  const tooltipTop = rect.bottom + padding + 12;

  return createPortal(
    <TourOverlay
      rect={rect}
      padding={padding}
      borderRadius={borderRadius}
      onBackdropClick={dismiss}
    >
      <TourTooltip
        title={title}
        description="แตะที่ใดก็ได้เพื่อปิด"
        tooltipTop={tooltipTop}
        tooltipLeft={tooltipLeft}
        onDismiss={(event) => {
          event.stopPropagation();
          dismiss();
        }}
      />
    </TourOverlay>,
    document.body,
  );
};

interface FeatureTourWelcomeProps {
  onStart: () => void;
}

const WELCOME_DISMISS_DELAY_SEC = 5;

export const FeatureTourWelcome: React.FC<FeatureTourWelcomeProps> = ({ onStart }) => {
  const [open, setOpen] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(WELCOME_DISMISS_DELAY_SEC);
  const canDismiss = secondsRemaining <= 0;

  const dismiss = useCallback(() => {
    markOnboardingSeen(FEATURE_TOUR_WELCOME_KEY);
    setOpen(false);
    onStart();
  }, [onStart]);

  useEffect(() => {
    const timer = window.setTimeout(() => setOpen(true), 400);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!open || canDismiss) return;

    const interval = window.setInterval(() => {
      setSecondsRemaining((current) => current - 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [open, canDismiss]);

  useEffect(() => {
    if (!open || !canDismiss) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, canDismiss, dismiss]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[2100] flex items-center justify-center bg-black/70 px-4"
      onClick={canDismiss ? dismiss : undefined}
    >
      <div
        className={`w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-5 text-center shadow-2xl dark:border-gray-600 dark:bg-gray-800 ${canDismiss ? 'cursor-pointer' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="feature-tour-welcome-title"
        onClick={(event) => {
          if (!canDismiss) {
            event.stopPropagation();
          }
        }}
      >
        <p className="text-[11px] font-medium uppercase tracking-wide text-blue-600 dark:text-blue-400">
          What&apos;s new
        </p>
        <h2
          id="feature-tour-welcome-title"
          className="mt-2 text-base font-semibold text-gray-900 dark:text-white"
        >
          มีฟีเจอร์ใหม่ — สำหรับดู Jira Worklog
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
          ต้องเชื่อมต่อ VPN ก่อนจึงจะใช้งานฟีเจอร์นี้ได้
        </p>
        <p className="mt-3 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
          {canDismiss
            ? 'แตะที่ใดก็ได้เพื่อเริ่มทัวร์'
            : `เริ่มทัวร์ได้ใน ${secondsRemaining} วินาที`}
        </p>
      </div>
    </div>,
    document.body,
  );
};