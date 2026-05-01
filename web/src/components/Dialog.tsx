"use client";
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { AlertTriangle, X } from "lucide-react";

type DialogOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  inputLabel?: string;
  inputPlaceholder?: string;
  inputMinLength?: number;
};

type DialogContextValue = {
  confirm: (opts: DialogOptions) => Promise<boolean>;
  prompt: (opts: DialogOptions) => Promise<string | null>;
};

const DialogContext = createContext<DialogContextValue>({
  confirm: () => Promise.resolve(false),
  prompt: () => Promise.resolve(null),
});

export function useDialog() {
  return useContext(DialogContext);
}

type DialogState = DialogOptions & {
  mode: "confirm" | "prompt";
  resolve: (value: string | boolean | null) => void;
};

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DialogState | null>(null);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const confirm = useCallback(
    (opts: DialogOptions) =>
      new Promise<boolean>((resolve) => {
        setState({ ...opts, mode: "confirm", resolve: resolve as (value: string | boolean | null) => void });
      }),
    [],
  );

  const prompt = useCallback(
    (opts: DialogOptions) =>
      new Promise<string | null>((resolve) => {
        setInputValue("");
        setState({ ...opts, mode: "prompt", resolve: resolve as (value: string | boolean | null) => void });
        setTimeout(() => inputRef.current?.focus(), 100);
      }),
    [],
  );

  function close(result: string | boolean | null) {
    state?.resolve(result);
    setState(null);
    setInputValue("");
  }

  return (
    <DialogContext.Provider value={{ confirm, prompt }}>
      {children}
      {state && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) close(state.mode === "confirm" ? false : null);
          }}
        >
          <div className="w-full max-w-md animate-in zoom-in-95 fade-in duration-150 rounded-xl border border-ink-faded/20 bg-white shadow-xl">
            <div className="flex items-start gap-3 p-5">
              {state.destructive && (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50">
                  <AlertTriangle size={20} className="text-red-600" />
                </div>
              )}
              <div className="flex-1">
                <h3 className="font-display text-lg font-bold text-ink">
                  {state.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                  {state.message}
                </p>
                {state.mode === "prompt" && (
                  <div className="mt-3">
                    {state.inputLabel && (
                      <label className="mb-1 block text-xs font-medium text-ink-soft">
                        {state.inputLabel}
                      </label>
                    )}
                    <textarea
                      ref={inputRef}
                      rows={3}
                      className="w-full rounded-lg border border-ink-faded/30 bg-parchment-dark px-3 py-2 text-sm text-ink outline-none transition focus:border-seal/40 focus:ring-1 focus:ring-seal/20"
                      placeholder={state.inputPlaceholder ?? ""}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (
                            !state.inputMinLength ||
                            inputValue.trim().length >= state.inputMinLength
                          ) {
                            close(inputValue.trim());
                          }
                        }
                      }}
                    />
                    {state.inputMinLength && (
                      <p className="mt-1 text-xs text-ink-faded">
                        {inputValue.trim().length}/{state.inputMinLength} characters minimum
                      </p>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => close(state.mode === "confirm" ? false : null)}
                className="shrink-0 rounded-md p-1.5 text-ink-faded transition hover:bg-gray-100 hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-ink-faded/15 px-5 py-3">
              <button
                onClick={() => close(state.mode === "confirm" ? false : null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-ink-soft transition hover:bg-gray-100"
              >
                {state.cancelLabel ?? "Cancel"}
              </button>
              <button
                onClick={() => {
                  if (state.mode === "prompt") {
                    if (
                      state.inputMinLength &&
                      inputValue.trim().length < state.inputMinLength
                    ) {
                      return;
                    }
                    close(inputValue.trim());
                  } else {
                    close(true);
                  }
                }}
                disabled={
                  state.mode === "prompt" &&
                  !!state.inputMinLength &&
                  inputValue.trim().length < state.inputMinLength
                }
                className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-40 ${
                  state.destructive
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "bg-seal text-white hover:bg-seal-dark"
                }`}
              >
                {state.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}
