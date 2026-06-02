import { useEffect } from "react";

interface ToastProps {
  message: string;
  type?: "success" | "error" | "info";
  onClose: () => void;
}

export default function Toast({ message, type = "success", onClose }: ToastProps) {
  useEffect(() => {
    const t = window.setTimeout(onClose, 3000);
    return () => window.clearTimeout(t);
  }, [onClose]);

  const colors = {
    success: "border-green-500 text-green-400",
    error:   "border-red-500 text-red-400",
    info:    "border-blue-500 text-blue-400",
  };

  const icons = {
    success: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
    error: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    ),
    info: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  };

  const bgIcons = {
    success: "bg-green-500",
    error:   "bg-red-500",
    info:    "bg-blue-500",
  };

  return (
    <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-900 border ${colors[type]} px-4 py-3 rounded-xl shadow-2xl animate-bounce-in`}>
      <div className={`w-6 h-6 ${bgIcons[type]} rounded-full flex items-center justify-center shrink-0`}>
        {icons[type]}
      </div>
      <span className="text-white text-sm font-medium">{message}</span>
      <button onClick={onClose} className="ml-2 text-gray-500 hover:text-white text-xs">✕</button>
    </div>
  );
}