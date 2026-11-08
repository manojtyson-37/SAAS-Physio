"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";

type Mod = { key: string; label: string; description: string; group: string };
type Type = { key: string; label: string; blurb: string; defaultModules: string[] };
type Data = {
  clinicType: string;
  clinicTypeLabel: string;
  enabled: string[];
  selfService?: boolean;
  subscription?: { state: string; daysLeft: number | null; plan: string | null; trialEndsAt: string | null; paidThrough: string | null } | null;
  modules: Mod[];
  planned: Mod[];
  types: Type[];
};

export default function SettingsPage() {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [type, setType] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    fetch("/api/settings/modules")
      .then(async (r) => {
        if (r.status === 403) return setDenied(true);
        const d: Data = await r.json();
        setData(d);
        setSelected(d.enabled);
        setType(d.clinicType);
      })
      .catch(() => setMsg({ ok: false, text: "Could not load settings" }));
  }, []);

  if (denied) return <p className="text-sm text-ink/60">Only the clinic admin can change modules.</p>;
  if (!data) return <p className="text-sm text-ink/50">Loading…</p>;

  const toggle = (k: string) => setSelected((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  const dirty =
    type !== data.clinicType || selected.length !== data.enabled.length || selected.some((k) => !data.enabled.includes(k));
  const presetOf = (k: string) => data.types.find((t) => t.key === k);

  async function save(applyPreset = false) {
    setSaving(true);
    setMsg(null);
    try {
      const body: Record<string, unknown> = { modules: selected };
      if (type !== data!.clinicType) {
        body.clinicType = type;
        if (applyPreset) body.modules = presetOf(type)?.defaultModules ?? selected;
      }
      const res = await fetch("/api/settings/modules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) return setMsg({ ok: false, text: out.error ?? "Could not save" });
      setData({ ...data!, clinicType: out.clinicType, clinicTypeLabel: presetOf(out.clinicType)?.label ?? data!.clinicTypeLabel, enabled: out.enabled });
      setSelected(out.enabled);
      setType(out.clinicType);
      setMsg({ ok: true, text: "Saved. Your menu has been updated." });
      router.refresh(); // re-render the sidebar with the new modules
    } finally {
      setSaving(false);
    }
  }

  const groups = [...new Set(data.modules.map((m) => m.group))];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Modules</h1>
        <p className="mt-1 text-sm text-ink/60">
          Switch on only what your {data.clinicTypeLabel.toLowerCase()} uses. Switching a module off hides it and never deletes any data.
        </p>
      </div>

      {data.subscription && (
        <div className="rounded-xl border border-sand bg-white px-4 py-3 text-sm">
          <span className="font-medium">Your plan</span>
          {" · "}
          {data.subscription.state === "TRIAL" ? `Trial${data.subscription.daysLeft !== null ? `, ${data.subscription.daysLeft} day${data.subscription.daysLeft === 1 ? "" : "s"} left` : ""}`
            : data.subscription.state === "ACTIVE" ? `Active${data.subscription.plan ? ` (${data.subscription.plan.toLowerCase()})` : ""}${data.subscription.paidThrough ? `, paid until ${new Date(data.subscription.paidThrough).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}` : ""}`
            : data.subscription.state.replace("_", " ").toLowerCase()}
        </div>
      )}
      {data.selfService === false && (
        <p className="rounded-lg bg-sand px-3 py-2 text-sm text-ink/70">Your modules are managed by ClinicOS. To add or remove a module, contact ClinicOS support.</p>
      )}

      {msg && (
        <p role="status" className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-forest/10 text-forest" : "bg-clay-light text-clay"}`}>
          {msg.text}
        </p>
      )}

      <Card>
        <p className="text-[10px] uppercase tracking-widest text-ink/40">Clinic type</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.types.map((t) => (
            <label
              key={t.key}
              className={`cursor-pointer rounded-xl border p-3 text-sm ${type === t.key ? "border-forest bg-forest/5" : "border-sand hover:bg-sand/30"}`}
            >
              <input type="radio" name="type" className="sr-only" checked={type === t.key} onChange={() => setType(t.key)} />
              <span className="font-medium">{t.label}</span>
              <span className="mt-0.5 block text-xs text-ink/60">{t.blurb}</span>
            </label>
          ))}
        </div>
        {type !== data.clinicType && (
          <p className="mt-3 text-xs text-ink/60">
            Changing the type updates wording, starter price list and appointment length. Your current module choices stay unless you apply the new type&apos;s preset.
          </p>
        )}
      </Card>

      {groups.map((g) => (
        <Card key={g}>
          <p className="text-[10px] uppercase tracking-widest text-ink/40">{g}</p>
          <ul className="mt-2 divide-y divide-sand/60">
            {data.modules
              .filter((m) => m.group === g)
              .map((m) => (
                <li key={m.key} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{m.label}</p>
                    <p className="text-xs text-ink/60">{m.description}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={selected.includes(m.key)}
                    aria-label={`${m.label} ${selected.includes(m.key) ? "on" : "off"}`}
                    onClick={() => toggle(m.key)}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition ${selected.includes(m.key) ? "bg-forest" : "bg-ink/20"}`}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${selected.includes(m.key) ? "left-[22px]" : "left-0.5"}`} />
                  </button>
                </li>
              ))}
          </ul>
        </Card>
      ))}

      <Card>
        <p className="text-[10px] uppercase tracking-widest text-ink/40">Coming soon</p>
        <ul className="mt-2 grid gap-3 sm:grid-cols-2">
          {data.planned.map((m) => (
            <li key={m.key} className="rounded-xl bg-sand/40 p-3 text-sm opacity-80">
              <span className="font-medium">{m.label}</span>
              <span className="ml-2 rounded-full bg-ink/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-ink/60">soon</span>
              <span className="mt-0.5 block text-xs text-ink/60">{m.description}</span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="sticky bottom-4 flex flex-wrap items-center gap-3 rounded-xl border border-sand bg-white/90 p-3 backdrop-blur">
        <button disabled={!dirty || saving || data.selfService === false} onClick={() => save(false)} className="rounded-lg bg-forest px-5 py-2 text-sm font-medium text-cream hover:bg-forest-deep disabled:opacity-50">
          {saving ? "Saving…" : "Save changes"}
        </button>
        {type !== data.clinicType && (
          <button disabled={saving || data.selfService === false} onClick={() => save(true)} className="rounded-lg border border-forest px-4 py-2 text-sm text-forest hover:bg-forest/5 disabled:opacity-50">
            Save and apply {presetOf(type)?.label} preset
          </button>
        )}
        {dirty && (
          <button onClick={() => { setSelected(data.enabled); setType(data.clinicType); }} className="text-sm text-ink/60 hover:text-ink">
            Discard
          </button>
        )}
      </div>
    </div>
  );
}
