import React from 'react';

export interface DotPulseLoaderProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | number;
  color?: string;
  className?: string;
  label?: string;
  subLabel?: string;
  center?: boolean;
}

const SIZE_MAP = {
  xs: 'w-2 h-2',
  sm: 'w-2.5 h-2.5',
  md: 'w-3.5 h-3.5',
  lg: 'w-5 h-5',
  xl: 'w-6 h-6',
  '2xl': 'w-8 h-8',
};

export const DotPulseLoader: React.FC<DotPulseLoaderProps> = ({
  size = 'md',
  color = 'bg-[#b876fc]',
  className = '',
  label,
  subLabel,
  center = false,
}) => {
  const isCustomNumber = typeof size === 'number';
  const sizeClass = isCustomNumber ? '' : SIZE_MAP[size] || SIZE_MAP.md;
  const customStyle: React.CSSProperties = {
    backgroundColor: color.startsWith('bg-[#') ? undefined : undefined,
    ...(isCustomNumber ? { width: `${size}px`, height: `${size}px` } : {}),
  };

  const dot = (
    <div
      className={`rounded-full shrink-0 animate-dot-pulse ${color} ${sizeClass} ${className}`}
      style={customStyle}
      role="status"
      aria-label={label || 'Loading...'}
    />
  );

  if (label || subLabel || center) {
    return (
      <div className={`flex flex-col items-center justify-center gap-3.5 text-center ${center ? 'py-12 w-full' : ''}`}>
        {dot}
        {label && (
          <p className="text-xs sm:text-sm font-medium text-white/70 tracking-wide">
            {label}
          </p>
        )}
        {subLabel && (
          <span className="text-[11px] sm:text-xs text-white/40">
            {subLabel}
          </span>
        )}
      </div>
    );
  }

  return dot;
};

export default DotPulseLoader;
