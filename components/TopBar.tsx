export function TopBar({ userFirstName }: { userFirstName: string }) {
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    // The server runs in UTC; clinics are in India, so show the India calendar day.
    timeZone: "Asia/Kolkata",
  });

  return (
    <div className="flex items-center justify-between border-b border-sand px-8 py-4">
      <p className="text-sm text-ink/60">
        Welcome back, <span className="font-medium text-ink">{userFirstName}</span>
      </p>
      <p className="font-data text-xs text-ink/40">{today}</p>
    </div>
  );
}
