import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const Toast = () => {
  const { toastMessage, hideToast } = useAuth();

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        hideToast();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage, hideToast]);

  if (!toastMessage) return null;

  const icons = {
    success: <CheckCircle className="text-emerald-500 w-5 h-5 flex-shrink-0" />,
    error: <AlertCircle className="text-red-500 w-5 h-5 flex-shrink-0" />,
    info: <Info className="text-sky w-5 h-5 flex-shrink-0" />,
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.9 }}
        className="fixed top-1 right-1 z-[3000] flex items-center gap-3 bg-navy text-white px-5 py-3 rounded-lg shadow-lg border border-white/10 max-w-md"
      >
        {icons[toastMessage.type] || icons.info}
        <span className="text-xs font-medium leading-tight">
          {toastMessage.msg}
        </span>
        <button
          onClick={hideToast}
          className="ml-2 text-white/60 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>
      </motion.div>
    </AnimatePresence>
  );
};

export default Toast;
