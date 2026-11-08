"use client";

// Fusha e emrit me sugjerime (ARIA combobox): debounce, anulim i kërkesës së vjetër dhe
// mbrojtje që përgjigjja e vjetër të mos mbishkruajë kërkimin e ri. Prekje + tastierë:
// ↓/↑ lëviz, Enter në sugjerim hap menunë, Enter pa sugjerim të zgjedhur dërgon formularin
// (hap rezultatet), Esc mbyll, "Pastro" fshin fushën.
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { menuHref } from "@/lib/safe-return";

type Suggestion = { slug: string; name: string; city: string | null; cuisine: string | null };

const MIN = 2;
const DEBOUNCE_MS = 200;

export function RestaurantNameCombobox({
  value,
  onChange,
  city,
  fromPath,
  inputId,
  placeholder = "Kërko restorant…",
  inputClassName,
  hideLabel = false,
  label = "Kërko restorant",
}: {
  value: string;
  onChange: (v: string) => void;
  city: string;
  /** Rruga e katalogut për "Kthehu" nga menuja. */
  fromPath: string;
  inputId?: string;
  placeholder?: string;
  inputClassName?: string;
  hideLabel?: boolean;
  label?: string;
}) {
  const router = useRouter();
  const autoId = useId();
  const id = inputId ?? `q-${autoId}`;
  const listId = `${id}-list`;
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const seq = useRef(0);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const q = value.trim();
    if (q.length < MIN) {
      abort.current?.abort();
      setItems([]);
      setStatus("idle");
      setActive(-1);
      return;
    }
    const my = ++seq.current;
    setStatus("loading");
    const t = setTimeout(async () => {
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      try {
        const qs = new URLSearchParams({ q });
        if (city) qs.set("city", city);
        const r = await fetch(`/api/public/restaurants/suggest?${qs}`, { signal: ctrl.signal });
        const d = await r.json();
        if (my !== seq.current) return; // përgjigje e vjetër → injorohet
        setItems(Array.isArray(d.items) ? d.items : []);
        setActive(-1);
        setStatus("done");
      } catch {
        if (my === seq.current) setStatus("done");
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [value, city]);

  function go(s: Suggestion) {
    setOpen(false);
    router.push(menuHref(s.slug, fromPath));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && items.length) {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % items.length);
    } else if (e.key === "ArrowUp" && items.length) {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
    } else if (e.key === "Enter" && open && active >= 0 && items[active]) {
      e.preventDefault();
      go(items[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  }

  const showList = open && value.trim().length >= MIN && status !== "idle";

  return (
    <div className="relative min-w-0 flex-1">
      <label htmlFor={id} className={hideLabel ? "sr-only" : "mb-1 block text-sm font-extrabold text-om-ink-soft"}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name="q"
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          value={value}
          maxLength={80}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          className={inputClassName}
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              setItems([]);
              setOpen(false);
            }}
            className="absolute right-1 top-1/2 inline-flex h-9 -translate-y-1/2 items-center rounded-lg px-2 text-sm font-bold text-om-ink-soft hover:text-om-aubergine"
            aria-label="Pastro kërkimin"
          >
            Pastro
          </button>
        )}
      </div>
      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Sugjerime restorantesh"
          className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-2xl border border-om-line bg-om-surface py-1 text-left shadow-[0_14px_34px_rgba(76,24,69,0.16)]"
        >
          {status === "loading" && items.length === 0 && <li className="px-4 py-3 text-sm text-om-ink-soft">Duke kërkuar…</li>}
          {status === "done" && items.length === 0 && (
            <li className="px-4 py-3 text-sm font-bold text-om-aubergine">Nuk gjetëm restorant me këtë emër</li>
          )}
          {items.map((s, i) => (
            <li
              key={s.slug}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => go(s)}
              className={`flex min-h-12 cursor-pointer flex-col justify-center px-4 py-2 ${i === active ? "bg-om-butter-soft" : "hover:bg-om-white"}`}
            >
              <span className="font-bold text-om-aubergine">{s.name}</span>
              {(s.cuisine || s.city) && <span className="text-xs text-om-ink-soft">{[s.cuisine, s.city].filter(Boolean).join(" · ")}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
