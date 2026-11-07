import { NextResponse } from "next/server";
import { BillingError } from "./billing";

/** Thrown inside route handlers/transactions to produce a specific HTTP response. */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Maps known errors to responses; anything unexpected is logged server-side and returned without internals. */
export function toErrorResponse(e: unknown) {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof BillingError) return NextResponse.json({ error: e.message }, { status: 400 });
  console.error("Unhandled route error", e instanceof Error ? e.name : "unknown");
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
