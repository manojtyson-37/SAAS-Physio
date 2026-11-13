/**
 * Contact and commercial details shown on the public landing page.
 *
 * Every field is optional. A blank field hides its button instead of rendering a
 * dead link, so the page is safe to deploy before these are decided. Fill in what
 * you are ready to honour and leave the rest empty.
 */
export type SalesConfig = {
  /** WhatsApp number that receives enquiries: digits only, with country code, e.g. "919812345678". */
  whatsapp: string;
  /** Number to show as a tap-to-call link, in the form you want displayed, e.g. "+91 98765 43210". */
  phone: string;
  /** Address for email enquiries. */
  email: string;
  /** One-time setup fee in rupees, or null to show "priced on a short call" instead of a number. */
  setupInr: number | null;
  /** Recurring fee per clinic per month in rupees, or null to leave it off the page. */
  monthlyInr: number | null;
  /** Shown under the prices. Only state what is true of your invoices. */
  taxNote: string;
  /** Optional one-line commercial promise, e.g. "First 30 days free, cancel any time." Only add what you will honour. */
  offerNote: string;
};


export const SALES: SalesConfig = {
  whatsapp: "917619671728",
  phone: "",
  email: "",
  setupInr: null,
  monthlyInr: null,
  taxNote: "",
  offerNote: "",
};

/** Rupees as an Indian-format amount, e.g. 42380 -> "₹42,380". */
export function formatInr(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

/**
 * A wa.me link with a prefilled message, or null when the configured number is
 * missing or not a plausible international number. Returning null keeps a
 * mistyped config from rendering a button that opens a chat with nobody.
 */
export function whatsappLink(message: string): string | null {
  const digits = SALES.whatsapp.replace(/\D/g, "");
  // wa.me needs a country code. A bare 10-digit Indian mobile would resolve to
  // some other country's number, so require more than 10 digits.
  if (digits.length < 11 || digits.length > 15) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/** A tel: link for the configured phone number, or null when it is unusable. */
export function phoneLink(): string | null {
  const digits = SALES.phone.replace(/[^\d+]/g, "");
  if (!/^\+?\d{10,15}$/.test(digits)) return null;
  return `tel:${digits}`;
}

/** A mailto: link for the configured address, or null when it is missing or malformed. */
export function emailLink(subject: string): string | null {
  const address = SALES.email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return null;
  return `mailto:${address}?subject=${encodeURIComponent(subject)}`;
}
