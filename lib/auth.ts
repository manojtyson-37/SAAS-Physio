import * as jose from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

// In production a missing or short secret must never fall back to a guessable one: sessions then neither sign nor verify.
const RAW_SECRET = process.env.JWT_SECRET;
const SECRET_OK = !!RAW_SECRET && RAW_SECRET.length >= 16;
const JWT_SECRET = new TextEncoder().encode(SECRET_OK ? RAW_SECRET : "default_secret");
const refuse = () => process.env.NODE_ENV === "production" && !SECRET_OK;
const COOKIE_NAME = "physiocare_session";

export type Role = "SUPER_ADMIN" | "ONBOARDING" | "CLINIC_ADMIN" | "DOCTOR" | "STAFF";

export type SessionPayload = {
  /** Issued-at (seconds), added by the signer. */
  iat?: number;
  userId: string;
  tenantId: string | null;
  role: Role;
  name: string;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function signSession(payload: SessionPayload) {
  if (refuse()) throw new Error("JWT_SECRET is missing or shorter than 16 characters");
  return await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  if (refuse()) return null;
  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET);
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(payload: SessionPayload) {
  const token = await signSession(payload);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return await verifySession(token);
}

/**
 * True when the session was issued before the user's last password change. Compared in whole seconds (the token's issue
 * time has second precision): a cookie re-issued in the same second as the change stays valid, anything older is rejected.
 */
export function sessionPredatesPasswordChange(session: { iat?: number }, changedAt: Date | null | undefined): boolean {
  if (!changedAt || session.iat === undefined) return false;
  return session.iat < Math.floor(changedAt.getTime() / 1000);
}
