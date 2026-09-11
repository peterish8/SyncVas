"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

export type SyncvasSelectOption = {
  value: string;
  label: string;
};

type SyncvasSelectProps = {
  id?: string;
  label: string;
  value: string;
  options: SyncvasSelectOption[];
  disabled?: boolean;
  className?: string;
  onChange: (value: string) => void;
};

export function SyncvasSelect({
  id,
  label,
  value,
  options,
  disabled = false,
  className,
  onChange,
}: SyncvasSelectProps) {
  const reactId = useId();
  const fieldId = id ?? `syncvas-select-${reactId}`;
  const listId = `${fieldId}-listbox`;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) ?? options[0];

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) close();
    }
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [close, open]);

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
    }
  }

  function choose(next: string) {
    onChange(next);
    close();
  }

  return (
    <div className={`syncvas-field ${className ?? ""}`.trim()} ref={rootRef}>
      <label className="syncvas-label" htmlFor={fieldId}>
        {label}
      </label>
      <div className="syncvas-select">
        <button
          id={fieldId}
          type="button"
          className="syncvas-select-trigger"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={`${label}: ${selected?.label ?? "Select"}`}
          onClick={() => setOpen((current) => !current)}
          onKeyDown={onTriggerKeyDown}
        >
          <span className="syncvas-select-value">{selected?.label ?? "Select"}</span>
          <span className="syncvas-select-chevron" aria-hidden="true" />
        </button>
        {open ? (
          <ul id={listId} className="syncvas-select-menu" role="listbox" aria-label={label}>
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <li key={option.value} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={
                      isSelected ? "syncvas-select-option syncvas-select-option-active" : "syncvas-select-option"
                    }
                    onClick={() => choose(option.value)}
                  >
                    {option.label}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
