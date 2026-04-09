import { cn, extendedStatusTone, severityTone, statusTone } from '@/lib/utils';
import type { DeviceStatus, Severity } from '@/types/models';

interface StatusBadgeProps {
  value: DeviceStatus | Severity | string;
  type?: 'status' | 'severity';
  title?: string;
}

export const StatusBadge = ({ value, type = 'status', title }: StatusBadgeProps) => {
  const tone =
    type === 'severity'
      ? severityTone[value as Severity] ?? 'bg-slate-500/15 text-slate-500'
      : extendedStatusTone[value as DeviceStatus] ?? statusTone[value as DeviceStatus] ?? 'bg-slate-500/15 text-slate-500';

  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize', tone, title && 'cursor-help')} title={title}>
      {String(value).replace('_', ' ')}
    </span>
  );
};
