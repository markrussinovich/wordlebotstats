// Statistical metric display card component
import React from 'react';
import { Card, CardContent } from '@/components/ui';

export interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string | number;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string | number;
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'highlighted' | 'comparison';
  loading?: boolean;
  className?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subValue,
  trend,
  trendValue,
  icon,
  size = 'md',
  variant = 'default',
  loading = false,
  className = ''
}) => {
  const sizes = {
    sm: 'p-3',
    md: 'p-4', 
    lg: 'p-6'
  };

  const variants = {
    default: 'bg-white border-gray-200',
    highlighted: 'bg-blue-50 border-blue-200',
    comparison: 'bg-gray-50 border-gray-300'
  };

  const trendColors = {
    up: 'text-green-600',
    down: 'text-red-600',
    neutral: 'text-gray-500'
  };

  const trendIcons = {
    up: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
      </svg>
    ),
    down: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 112 0v11.586l4.293-4.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
    ),
    neutral: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
      </svg>
    )
  };

  if (loading) {
    return (
      <Card variant="default" className={`${variants[variant]} ${className}`}>
        <CardContent spacing="none" className={sizes[size]}>
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded mb-2"></div>
            <div className="h-8 bg-gray-200 rounded mb-1"></div>
            <div className="h-3 bg-gray-200 rounded w-20"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="default" className={`${variants[variant]} ${className}`}>
      <CardContent spacing="none" className={sizes[size]}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              {icon && (
                <div className="text-gray-400">
                  {icon}
                </div>
              )}
              <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">
                {label}
              </p>
            </div>
            
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-gray-900">
                {value}
              </span>
              {subValue && (
                <span className="text-sm text-gray-500">
                  {subValue}
                </span>
              )}
            </div>

            {trend && trendValue && (
              <div className={`flex items-center space-x-1 mt-2 ${trendColors[trend]}`}>
                {trendIcons[trend]}
                <span className="text-sm font-medium">
                  {trendValue}
                </span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default StatCard;