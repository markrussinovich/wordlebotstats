// Select dropdown component with search and multi-select capabilities
import React, { SelectHTMLAttributes, forwardRef, useState, useEffect, useRef } from 'react';

export interface SelectOption {
  label: string;
  value: string | number;
  disabled?: boolean;
  icon?: React.ReactNode;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange'> {
  label?: string;
  description?: string;
  error?: string;
  placeholder?: string;
  options: SelectOption[];
  value?: string | number | (string | number)[];
  onChange?: (value: string | number | (string | number)[]) => void;
  searchable?: boolean;
  multiple?: boolean;
  clearable?: boolean;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
}

const Select = forwardRef<HTMLDivElement, SelectProps>(({
  className = '',
  label,
  description,
  error,
  placeholder = 'Select an option...',
  options = [],
  value,
  onChange,
  searchable = false,
  multiple = false,
  clearable = false,
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled,
  id,
  ...props
}, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredOptions, setFilteredOptions] = useState(options);
  const selectRef = useRef<HTMLDivElement>(null);

  const sizes = {
    sm: 'h-8 px-3 text-sm',
    md: 'h-10 px-3 text-sm',
    lg: 'h-12 px-4 text-base'
  };

  const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');

  useEffect(() => {
    if (searchable) {
      const filtered = options.filter(option =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredOptions(filtered);
    } else {
      setFilteredOptions(options);
    }
  }, [searchTerm, options, searchable]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getDisplayValue = () => {
    if (multiple && Array.isArray(value)) {
      if (value.length === 0) return placeholder;
      if (value.length === 1) {
        const option = options.find(opt => opt.value === value[0]);
        return option?.label || placeholder;
      }
      return `${value.length} items selected`;
    } else {
      const option = options.find(opt => opt.value === value);
      return option?.label || placeholder;
    }
  };

  const handleOptionClick = (optionValue: string | number) => {
    if (multiple) {
      const currentValue = Array.isArray(value) ? value : [];
      const newValue = currentValue.includes(optionValue)
        ? currentValue.filter(v => v !== optionValue)
        : [...currentValue, optionValue];
      onChange?.(newValue);
    } else {
      onChange?.(optionValue);
      setIsOpen(false);
      setSearchTerm('');
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.(multiple ? [] : '');
  };

  const isSelected = (optionValue: string | number) => {
    if (multiple && Array.isArray(value)) {
      return value.includes(optionValue);
    }
    return value === optionValue;
  };

  const baseClasses = `relative border rounded-md bg-white transition-colors focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 ${
    error ? 'border-red-500' : 'border-gray-300'
  } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`;

  const triggerClasses = [
    'w-full flex items-center justify-between',
    sizes[size],
    fullWidth && 'w-full'
  ].filter(Boolean).join(' ');

  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && (
        <label 
          htmlFor={selectId}
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {label}
        </label>
      )}

      <div
        ref={ref}
        className={`${baseClasses} ${className}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <div className={triggerClasses}>
          <span className={`truncate ${!value || (Array.isArray(value) && value.length === 0) ? 'text-gray-400' : 'text-gray-900'}`}>
            {loading ? 'Loading...' : getDisplayValue()}
          </span>
          <div className="flex items-center ml-2 space-x-1">
            {clearable && value && !loading && (
              <button
                type="button"
                onClick={handleClear}
                className="text-gray-400 hover:text-gray-600 p-1"
                tabIndex={-1}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            {loading ? (
              <svg className="animate-spin w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="m12 2a10 10 0 0 1 10 10h-2a8 8 0 0 0-8-8z" />
              </svg>
            ) : (
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </div>
        </div>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
            {searchable && (
              <div className="p-2 border-b border-gray-100">
                <input
                  type="text"
                  placeholder="Search options..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}

            <div className="py-1">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500">
                  {searchTerm ? 'No options found' : 'No options available'}
                </div>
              ) : (
                filteredOptions.map((option) => (
                  <div
                    key={option.value}
                    className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between hover:bg-gray-50 ${
                      option.disabled ? 'opacity-50 cursor-not-allowed' : ''
                    } ${isSelected(option.value) ? 'bg-blue-50 text-blue-700' : 'text-gray-900'}`}
                    onClick={() => !option.disabled && handleOptionClick(option.value)}
                  >
                    <div className="flex items-center">
                      {option.icon && <span className="mr-2">{option.icon}</span>}
                      <span>{option.label}</span>
                    </div>
                    {multiple && isSelected(option.value) && (
                      <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {description && !error && (
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
    </div>
  );
});

Select.displayName = 'Select';

export default Select;