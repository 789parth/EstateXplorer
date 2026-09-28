import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const Input = React.forwardRef(
  (
    {
      label,
      error,
      type = 'text',
      placeholder,
      className = '',
      icon: Icon,
      required = false,
      optional = false,
      style = {},
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const computedType = isPassword ? (showPassword ? 'text' : 'password') : type;

    return (
      <div className="w-full text-left">
        {label && (
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              {label} {required && <span className="text-rose-500 font-bold">*</span>}
            </label>
            {optional && (
              <span className="text-[0.68rem] text-slate-400 font-medium lowercase italic">(optional)</span>
            )}
          </div>
        )}
        <div className="relative flex items-center">
          {Icon && (
            <div className="absolute left-3.5 text-slate-400 pointer-events-none flex items-center justify-center z-10">
              <Icon size={17} />
            </div>
          )}
          <input
            ref={ref}
            type={computedType}
            placeholder={placeholder}
            onClick={(e) => {
              if (computedType === 'date' || computedType === 'month') {
                try {
                  e.target.showPicker?.();
                } catch {}
              }
              if (props.onClick) props.onClick(e);
            }}
            style={{
              paddingLeft: Icon ? '42px' : '14px',
              paddingRight: isPassword ? '42px' : '14px',
              ...style,
            }}
            className={`w-full bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 py-2.5 outline-none transition-all duration-200 shadow-2xs focus:border-blue-600 focus:ring-3 focus:ring-blue-600/15 ${
              error
                ? 'border-rose-400 focus:border-rose-600 focus:ring-rose-600/15'
                : 'hover:border-slate-400'
            } ${className}`}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 text-slate-400 hover:text-slate-600 transition-colors p-1 flex items-center justify-center cursor-pointer focus:outline-none"
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          )}
        </div>
        {error && (
          <p className="mt-1.5 text-xs text-rose-600 font-medium flex items-center gap-1">
            <span>•</span> {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
