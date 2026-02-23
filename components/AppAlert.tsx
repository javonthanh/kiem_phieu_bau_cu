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
  type?: "success" | "error" | "warning" | "info";
};

type ConfirmOptions = {
  message: string;
  title?: string;
};

type ModalState =
  | { type: "alert"; options: AlertOptions }
  | { type: "confirm"; options: ConfirmOptions; resolve: (v: boolean) => void }
  | null;

type AlertContextType = {
  showAlert: (options: AlertOptions) => void;
  showConfirm: (options: ConfirmOptions) => Promise<boolean>;
};

const AlertContext = createContext<AlertContextType | null>(null);

export function useAppAlert() {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error("useAppAlert must be used inside AlertProvider");
  return ctx;
}

export function AlertProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalState>(null);

  const showAlert = useCallback((options: AlertOptions) => {
    setModal({ type: "alert", options });
  }, []);

  const showConfirm = useCallback(
    (options: ConfirmOptions) => {
      return new Promise<boolean>((resolve) => {
        setModal({ type: "confirm", options, resolve });
      });
    },
    []
  );

  const closeModal = () => {
    setModal(null);
    setTimeout(() => {
      document.body.setAttribute("tabindex", "-1");
      document.body.focus();
    }, 50);
  };

  const handleConfirm = (value: boolean) => {
    if (modal?.type === "confirm") {
      modal.resolve(value);
    }
    closeModal();
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (modal?.type === "confirm") handleConfirm(false);
        else closeModal();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [modal]);

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm }}>
      {children}

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-[420px] max-w-[90%]">
            {modal.options.title && (
              <h2 className="text-lg font-semibold mb-2">
                {modal.options.title}
              </h2>
            )}

            <p className="text-gray-700 mb-6 whitespace-pre-wrap">
              {modal.options.message}
            </p>

            <div className="flex justify-end gap-3">
              {modal.type === "confirm" && (
                <button
                  onClick={() => handleConfirm(false)}
                  className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                >
                  Hủy
                </button>
              )}

              <button
                onClick={() =>
                  modal.type === "confirm"
                    ? handleConfirm(true)
                    : closeModal()
                }
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