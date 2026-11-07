export const statusClass = (s: string) =>
  s === "PAID"
    ? "bg-forest/10 text-forest"
    : s === "PARTIAL"
    ? "bg-clay-light text-clay"
    : s === "CANCELLED"
    ? "bg-ink/10 text-ink/50 line-through"
    : "bg-sand text-ink/60";
