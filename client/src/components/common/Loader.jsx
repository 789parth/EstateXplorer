import React from 'react';

const Loader = ({ fullScreen = false, text = 'Loading...' }) => {
  const content = (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className="w-10 h-10 border-3 border-navy/20 border-t-navy rounded-full animate-spin" />
      {text && (
        <span className="text-xs font-semibold tracking-wider text-muted uppercase">
          {text}
        </span>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-[2500] bg-bg flex items-center justify-center">
        {content}
      </div>
    );
  }

  return <div className="py-12 flex items-center justify-center">{content}</div>;
};

export default Loader;
