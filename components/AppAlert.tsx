"use client";

import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useEffect,
} from "react";

type AlertOptions = {
  message: string;
  title?: string;
};

type AlertContextType = {
  showAlert: (options: AlertOptions) => void;
};

const AlertContext = createContext<AlertContextType | null>(null);

export function useAppAlert() {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error("useAppAlert must be used inside AlertProvider");
  return ctx;
}

export function AlertProvider({ children }: { children: ReactNode }) {
  const [alertData, setAlertData] = useState<AlertOptions | null>(null);

  const showAlert = useCallback((options: AlertOptions) => {
    setAlertData(options);
  }, []);

  const closeAlert = () => {
    setAlertData(null);

    // Trả lại focus cho body (quan trọng trong Electron)
    setTimeout(() => {
      document.body.setAttribute("tabindex", "-1");
      document.body.focus();
    }, 50);
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAlert();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}

      {alertData && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-[400px] max-w-[90%] animate-in fade-in zoom-in-95">
            {alertData.title && (
              <h2 className="text-lg font-semibold mb-2">
                {alertData.title}
              </h2>
            )}

            <p className="text-gray-700 mb-4">
              {alertData.message}
            </p>

            <div className="flex justify-end">
              <button
                onClick={closeAlert}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </AlertContext.Provider>
  );
}