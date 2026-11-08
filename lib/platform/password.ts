import { randomInt } from "node:crypto";

// No 0/O, 1/l/I: a temporary password is read out over the phone or typed from a screenshot.
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** 16-character random temporary password with at least one lower, upper and digit. Shown once, never stored in clear. */
export function generateTempPassword(length = 16): string {
  for (;;) {
    let p = "";
    for (let i = 0; i < length; i++) p += ALPHABET[randomInt(ALPHABET.length)];
    if (/[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p)) return p;
  }
}
