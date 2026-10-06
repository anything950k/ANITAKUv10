import React from 'react';
import { Check, X } from 'lucide-react';

export interface AppToggleSwitchProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  'aria-label'?: string;
}

/**
 * Standard Manga Reader styled toggle switch component used across the entire application.
 * Features the signature pill, purple active border/background,
 * and circular knob with Check/X icons.
 */
export const AppToggleSwitch: React.FC<AppToggleSwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  className = '',
  id,
  'aria-label': ariaLabel,
}) => {
  return (
    <div
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      style={{
        WebkitTapHighlightColor: 'transparent',
        outline: 'none',
        borderWidth: '2.5px',
      }}
      onClick={(e) => {
        if (disabled) return;
        e.stopPropagation();
        onChange?.(!checked);
      }}
      className={`w-[52px] h-[30px] rounded-full px-[2px] transition-colors duration-200 flex items-center border-[2.5px] shrink-0 select-none outline-none focus:outline-none focus:ring-0 active:outline-none ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${
        checked
          ? 'bg-[#a855f7] border-[#a855f7]'
          : 'bg-[#2b2c38] border-white/30'
      } ${className}`}
    >
      <div
        style={{ WebkitTapHighlightColor: 'transparent', outline: 'none' }}
        className={`w-5.5 h-5.5 rounded-full flex items-center justify-center transition-transform duration-200 outline-none select-none shrink-0 ${
          checked
            ? 'translate-x-[21px] bg-white text-[#a855f7]'
            : 'translate-x-0 bg-[#636474] text-[#2b2c38]'
        }`}
      >
        {checked ? (
          <Check className="w-3.5 h-3.5 stroke-[3.5]" />
        ) : (
          <X className="w-3.5 h-3.5 stroke-[3.5]" />
        )}
      </div>
    </div>
  );
};
