import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AntdSwitchSemanticDOM = 'root' | 'content' | 'indicator';

export interface AntdSwitchClassNames {
  root?: string;
  content?: string;
  indicator?: string;
}

export interface AntdSwitchStyles {
  root?: React.CSSProperties;
  content?: React.CSSProperties;
  indicator?: React.CSSProperties;
}

export interface AntdSwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  loading?: boolean;
  size?: 'medium' | 'small' | 'large';
  checkedChildren?: React.ReactNode;
  unCheckedChildren?: React.ReactNode;
  className?: string;
  classNames?: AntdSwitchClassNames;
  styles?: AntdSwitchStyles;
  onChange?: (checked: boolean, event: React.MouseEvent<HTMLButtonElement> | React.KeyboardEvent<HTMLButtonElement>) => void;
  onClick?: (checked: boolean, event: React.MouseEvent<HTMLButtonElement> | React.KeyboardEvent<HTMLButtonElement>) => void;
  'aria-label'?: string;
}

const SIZE_CONFIG = {
  small: {
    root: 'h-4',
    handle: 12,
    text: 'text-[9px]',
    textPad: 4,
    trackPad: 2,
  },
  medium: {
    root: 'h-9',
    handle: 16,
    text: 'text-xs',
    textPad: 8,
    trackPad: 5,
  },
  large: {
    root: 'h-8',
    handle: 24,
    text: 'text-[11px]',
    textPad: 6,
    trackPad: 2,
  },
} as const;

export const AntdSwitch = React.forwardRef<HTMLButtonElement, AntdSwitchProps>(
  (
    {
      checked,
      defaultChecked = false,
      disabled = false,
      loading = false,
      size = 'medium',
      checkedChildren,
      unCheckedChildren,
      className,
      classNames,
      styles,
      onChange,
      onClick,
      'aria-label': ariaLabel,
    },
    ref,
  ) => {
    const isControlled = checked !== undefined;
    const [internalChecked, setInternalChecked] = React.useState(defaultChecked);
    const isChecked = isControlled ? checked : internalChecked;
    const isDisabled = disabled || loading;
    const config = SIZE_CONFIG[size];
    const hasLabel = Boolean(checkedChildren || unCheckedChildren);
    const handleGap = config.textPad;

    const setChecked = (nextChecked: boolean) => {
      if (!isControlled) {
        setInternalChecked(nextChecked);
      }
    };

    const toggle = (event: React.MouseEvent<HTMLButtonElement> | React.KeyboardEvent<HTMLButtonElement>) => {
      if (isDisabled) return;
      const nextChecked = !isChecked;
      setChecked(nextChecked);
      onChange?.(nextChecked, event);
      onClick?.(nextChecked, event);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggle(event);
      }
    };

    const handleReserve = config.handle + handleGap;

    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={isChecked}
        aria-label={ariaLabel}
        aria-busy={loading}
        disabled={isDisabled}
        onClick={toggle}
        onKeyDown={handleKeyDown}
        className={cn(
          'relative inline-flex w-auto shrink-0 cursor-pointer items-center overflow-hidden rounded-lg border transition-[background-color,box-shadow,opacity,border-color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60',
          config.root,
          isChecked
            ? 'border-blue-600 bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-600/40 dark:border-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700'
            : 'border-violet-800 bg-violet-800 hover:bg-violet-700 focus-visible:ring-violet-800/40 dark:border-violet-700 dark:bg-violet-800 dark:hover:bg-violet-700',
          className,
          classNames?.root,
        )}
        style={{
          ...styles?.root,
          padding: config.trackPad,
        }}
      >
        {hasLabel && (
          <span
            className={cn(
              'whitespace-nowrap font-medium leading-none text-white',
              config.text,
              classNames?.content,
            )}
            style={{
              ...styles?.content,
              paddingLeft: isChecked ? config.textPad : handleReserve,
              paddingRight: isChecked ? handleReserve : config.textPad,
            }}
          >
            {isChecked ? checkedChildren : unCheckedChildren}
          </span>
        )}

        <span
          aria-hidden="true"
          className={cn(
            'absolute top-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_1px_3px_rgba(15,23,42,0.18)] transition-[left] duration-200',
            classNames?.indicator,
          )}
          style={{
            ...styles?.indicator,
            width: config.handle,
            height: config.handle,
            left: isChecked
              ? `calc(100% - ${config.handle + config.trackPad}px)`
              : config.trackPad,
          }}
        >
          {loading && (
            <Loader2 className={cn('absolute inset-0 m-auto animate-spin', isChecked ? 'text-blue-600' : 'text-violet-800', size === 'large' ? 'h-4 w-4' : size === 'small' ? 'h-2 w-2' : 'h-3 w-3')} />
          )}
        </span>
      </button>
    );
  },
);

AntdSwitch.displayName = 'AntdSwitch';
