"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export type SearchOption = { value: string; label: string; hint?: string };

/** Case-insensitive, every typed word must appear in the label or hint ("kar mal" finds "Karan Malhotra"). Exported for tests. */
export function filterOptions(options: SearchOption[], query: string, limit = 60): SearchOption[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const out: SearchOption[] = [];
  for (const o of options) {
    const hay = `${o.label} ${o.hint ?? ""}`.toLowerCase();
    if (words.every((w) => hay.includes(w))) {
      out.push(o);
      if (out.length >= limit) break;
    }
  }
  return out;
}

/**
 * Type-to-search replacement for a long <select>. Click or focus, type any part of the name, arrow keys + Enter (or click) to pick.
 * Works inside a <form>: it renders a hidden input so `required` and native validation still apply.
 */
export function SearchSelect({
  options, value, onChange, placeholder = "Search…", required, disabled, ariaLabel, className = "", allowClear = false,
}: {
  options: SearchOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  allowClear?: boolean;
}) {
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  // Enter only picks after the user has moved the highlight or typed; tabbing in and pressing Enter must never choose silently.
  const [moved, setMoved] = useState(false);
  const selected = options.find((o) => o.value === value);
  const shown = useMemo(() => filterOptions(options, query), [options, query]);

  useEffect(() => {
    function away(e: MouseEvent) {
      if (root.current && !root.current.contains(e.target as Node)) { setOpen(false); setQuery(""); }
    }
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);

  useEffect(() => {
    if (open) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, listId]);

  function pick(o: SearchOption) {
    onChange(o.value);
    setOpen(false);
    setQuery("");
    setMoved(false);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setMoved(true); setActive((a) => Math.max(0, Math.min(a + 1, shown.length - 1))); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setMoved(true); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && open && moved && shown[active]) { e.preventDefault(); pick(shown[active]); }
    else if (e.key === "Escape") { setOpen(false); setQuery(""); }
  }

  const base = "w-full rounded-lg border border-sand bg-white px-3 py-2 text-sm";
  return (
    <div ref={root} className="relative">
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && shown[active] ? `${listId}-${active}` : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        autoComplete="off"
        // Shows the chosen name until the user starts typing; typing replaces it with the search text.
        value={open ? query : selected?.label ?? ""}
        placeholder={selected && open ? selected.label : placeholder}
        onFocus={() => { setOpen(true); setActive(0); setMoved(false); }}
        onClick={() => setOpen(true)}
        onBlur={() => { setOpen(false); setQuery(""); }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0); setMoved(true); }}
        onKeyDown={onKey}
        className={`${base} ${allowClear && value ? "pr-7" : ""} ${className}`}
      />
      {required && <input tabIndex={-1} aria-hidden required value={selected ? value : ""} onChange={() => {}} className="pointer-events-none absolute inset-0 h-full w-full opacity-0" />}
      {allowClear && value && !disabled && (
        <button type="button" aria-label="Clear" onClick={() => onChange("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink/40 hover:text-ink">×</button>
      )}
      {open && (
        <ul id={listId} role="listbox" className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-sand bg-white py-1 text-sm shadow-lg">
          {shown.length === 0 && <li className="px-3 py-2 text-ink/50">No match</li>}
          {shown.map((o, i) => (
            <li
              key={o.value}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={o.value === value}
              onMouseDown={(e) => { e.preventDefault(); pick(o); }}
              onMouseEnter={() => { setActive(i); setMoved(true); }}
              className={`cursor-pointer px-3 py-2 ${i === active ? "bg-sand/60" : ""} ${o.value === value ? "font-medium text-forest" : ""}`}
            >
              {o.label}
              {o.hint && <span className="ml-2 text-xs text-ink/50">{o.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
