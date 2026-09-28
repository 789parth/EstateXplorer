import React from 'react';

const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  fullWidth = false,
  className = '',
  disabled = false,
  type = 'button',
  onClick,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center gap-2 font-semibold tracking-tight transition-all duration-200 cursor-pointer outline-none focus:ring-2 focus:ring-offset-1 select-none disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.98]';

  const variants = {
    primary:
      'bg-slate-900 text-white hover:bg-slate-800 focus:ring-slate-900/20 shadow-sm hover:shadow',
    dark:
      'bg-slate-900 text-white hover:bg-slate-800 focus:ring-slate-900/20 shadow-sm hover:shadow',
    secondary:
      'bg-slate-100 text-slate-900 hover:bg-slate-200/80 focus:ring-slate-400/20',
    gold:
      'bg-[#b89358] text-white hover:bg-[#a37e45] focus:ring-[#b89358]/20 shadow-sm hover:shadow',
    outline:
      'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 hover:border-slate-400 focus:ring-slate-400/20 shadow-xs',
    ghost:
      'bg-transparent text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 focus:ring-slate-400/20',
    danger:
      'bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-600/20 shadow-sm',
    white:
      'bg-white text-slate-900 hover:bg-slate-50 focus:ring-white/30 shadow-md hover:shadow-lg',
  };

  const sizes = {
    xs: 'text-xs px-3 py-1.5 rounded-lg min-h-[32px]',
    sm: 'text-xs px-4 py-2 rounded-lg min-h-[36px]',
    md: 'text-sm px-5 py-2.5 rounded-xl min-h-[42px]',
    lg: 'text-base px-6 py-3 rounded-xl min-h-[48px]',
    pill: 'text-sm px-6 py-2.5 rounded-full min-h-[42px]',
  };

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      onClick={onClick}
      className={`${baseStyles} ${variants[variant] || variants.primary} ${
        sizes[size] || sizes.md
      } ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {isLoading ? (
        <>
          <span className="inline-block w-4 h-4 border-2 border-current border-r-transparent rounded-full animate-spin"></span>
          <span>Loading...</span>
        </>
      ) : (
        children
      )}
    </button>
  );
};

export default Button;
