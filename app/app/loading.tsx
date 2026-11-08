/** Shown the instant a sidebar link is clicked, while the next page loads, so a click never looks dead. */
export default function Loading() {
  return (
    <div role="status" aria-label="Loading" className="animate-pulse space-y-6">
      <div className="h-8 w-56 rounded-lg bg-sand/70" />
      <div className="h-4 w-80 rounded bg-sand/50" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-sand/50" />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-sand/40" />
    </div>
  );
}
