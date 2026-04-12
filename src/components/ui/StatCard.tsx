import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from './Card';
import { cn } from '../../utils/cn';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: number; // positive = up, negative = down
  trendLabel?: string;
  icon: React.ReactNode;
  iconBg?: string;
  className?: string;
}

export function StatCard({
  title, value, subtitle, trend, trendLabel, icon, iconBg = 'bg-brand-50', className,
}: StatCardProps) {
  const isPositive = trend !== undefined && trend >= 0;

  return (
    <Card className={cn('p-6', className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-slate-500 font-medium">{title}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
          {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
          {trend !== undefined && (
            <div className={cn(
              'mt-3 inline-flex items-center gap-1 text-sm font-medium',
              isPositive ? 'text-emerald-600' : 'text-red-500',
            )}>
              {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              <span>{isPositive ? '+' : ''}{trend}%</span>
              {trendLabel && <span className="text-slate-400 font-normal ml-1">{trendLabel}</span>}
            </div>
          )}
        </div>
        <div className={cn('p-3 rounded-xl', iconBg)}>
          {icon}
        </div>
      </div>
    </Card>
  );
}
