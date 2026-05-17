// Input component with validation states and variants
import React, { InputHTMLAttributes, forwardRef } from 'react';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  description?: string;
  error?: string;
  success?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'filled';
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(({
  className = '',
  label,
  description,
  error,
  success,
  size = 'md',
  variant = 'default',
  leftIcon,
  rightIcon,
  fullWidth = false,
  type = 'text',
  id,
  disabled,
  ...props
}, ref) => {

  const baseInputClasses = 'border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0';
  
  const variants = {
    default: 'border-gray-300 bg-white focus:border-blue-500 focus:ring-blue-500',
    filled: 'border-transparent bg-gray-100 focus:bg-white focus:border-blue-500 focus:ring-blue-500'
  };

  const sizes = {
    sm: 'h-8 px-3 text-sm',
    md: 'h-10 px-3 text-sm',
    lg: 'h-12 px-4 text-base'
  };

  const stateClasses = error 
    ? 'border-red-500 focus:border-red-500 focus:ring-red-500' 
    : success 
    ? 'border-green-500 focus:border-green-500 focus:ring-green-500'
    : variants[variant];

  const disabledClasses = disabled 
    ? 'opacity-50 cursor-not-allowed bg-gray-50' 
    : '';

  const inputClasses = [
    baseInputClasses,
    sizes[size],
    stateClasses,
    disabledClasses,
    leftIcon && 'pl-10',
    rightIcon && 'pr-10',
    fullWidth && 'w-full',
    className
  ].filter(Boolean).join(' ');

  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && (
        <label 
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {label}
        </label>
      )}
      
      <div className="relative">
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-gray-400 sm:text-sm">
              {leftIcon}
            </span>
          </div>
        )}
        
        <input
          ref={ref}
          type={type}
          id={inputId}
          className={inputClasses}
          disabled={disabled}
          {...props}
        />
        
        {rightIcon && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <span className="text-gray-400 sm:text-sm">
              {rightIcon}
            </span>
          </div>
        )}
      </div>
      
      {description && !error && !success && (
        <p className="mt-1 text-sm text-gray-500">
          {description}
        </p>
      )}
      
      {error && (
        <p className="mt-1 text-sm text-red-600 flex items-center">
          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
      
      {success && (
        <p className="mt-1 text-sm text-green-600 flex items-center">
          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          {success}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;