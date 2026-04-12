import React from 'react';
import { cn } from '../../utils/cn';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'cyan' | 'indigo' | 'amber';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
  icon?: React.ReactNode;
}

const variants: Record<BadgeVariant, string> = {
  default: 'bg-slate-100 text-slate-700',
  success: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border border-amber-200',
  danger: 'bg-red-50 text-red-700 border border-red-200',
  info: 'bg-brand-50 text-brand-700 border border-brand-200',
  purple: 'bg-purple-50 text-purple-700 border border-purple-200',
  cyan: 'bg-cyan-50 text-cyan-700 border border-cyan-200',
  indigo: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  amber: 'bg-amber-50 text-amber-700 border border-amber-200',
};

export function Badge({ children, variant = 'default', className, icon }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium',
      variants[variant],
      className,
    )}>
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </span>
  );
}
