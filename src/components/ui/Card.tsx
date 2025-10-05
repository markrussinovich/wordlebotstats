// Card component for grouped content display
import React, { HTMLAttributes, forwardRef } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'outlined' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
  as?: keyof JSX.IntrinsicElements;
}

const Card = forwardRef<HTMLDivElement, CardProps>(({
  children,
  className = '',
  variant = 'default',
  padding = 'md',
  interactive = false,
  as: Component = 'div',
  ...props
}, ref) => {
  const baseClasses = 'rounded-lg';
  
  const variants = {
    default: 'bg-white border border-gray-200',
    outlined: 'bg-transparent border border-gray-300',
    elevated: 'bg-white shadow-md border-0'
  };

  const paddings = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6'
  };

  const interactiveClasses = interactive 
    ? 'cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2'
    : '';

  const classes = [
    baseClasses,
    variants[variant],
    paddings[padding],
    interactiveClasses,
    className
  ].filter(Boolean).join(' ');

  return (
    <Component
      ref={ref}
      className={classes}
      tabIndex={interactive ? 0 : undefined}
      role={interactive ? 'button' : undefined}
    >
      {children}
    </Component>
  );
});

Card.displayName = 'Card';

// Card sub-components
export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  children,
  className = '',
  title,
  subtitle,
  actions,
  ...props
}) => {
  const classes = ['flex items-start justify-between pb-3 border-b border-gray-100', className]
    .filter(Boolean).join(' ');

  return (
    <div className={classes} {...props}>
      <div className="flex-1">
        {title && <h3 className="text-lg font-semibold text-gray-900">{title}</h3>}
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        {children}
      </div>
      {actions && <div className="ml-4">{actions}</div>}
    </div>
  );
};

export interface CardContentProps extends HTMLAttributes<HTMLDivElement> {
  spacing?: 'none' | 'sm' | 'md' | 'lg';
}

export const CardContent: React.FC<CardContentProps> = ({
  children,
  className = '',
  spacing = 'md',
  ...props
}) => {
  const spacings = {
    none: '',
    sm: 'py-2',
    md: 'py-3',
    lg: 'py-4'
  };

  const classes = [spacings[spacing], className].filter(Boolean).join(' ');

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
};

export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  justify?: 'start' | 'center' | 'end' | 'between';
}

export const CardFooter: React.FC<CardFooterProps> = ({
  children,
  className = '',
  justify = 'end',
  ...props
}) => {
  const justifyClasses = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    between: 'justify-between'
  };

  const classes = [
    'flex items-center pt-3 border-t border-gray-100',
    justifyClasses[justify],
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
};

export default Card;