import { randomBytes } from "node:crypto";

/**
 * Public registration reference generator.
 *
 * Format: MRMNHS-<8 chars> e.g. MRMNHS-7KQF3X2B
 *
 * References are generated from a cryptographically random source (Crockford
 * base32 alphabet, ambiguous characters removed), so they are non-sequential
 * and cannot be enumerated to guess other students' registrations. Collisions
 * are retried; the database enforces uniqueness as the final guard.
 */

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base32, no I/L/O/U
const PREFIX = "MRMNHS";
const LENGTH = 8;

function randomReference(): string {
  const bytes = randomBytes(LENGTH);
  let out = "";
  for (let i = 0; i < LENGTH; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return `${PREFIX}-${out}`;
}

/**
 * Generate a unique reference, retrying on collision.
 * `exists` should check the database for an existing row with the reference.
 */
export async function generateUniqueReference(
  exists: (reference: string) => Promise<boolean>,
  maxAttempts = 10,
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const candidate = randomReference();
    if (!(await exists(candidate))) return candidate;
  }
  throw new Error("Could not generate a unique registration reference after multiple attempts.");
}

/** Shape check used by tests and input validation. */
export function isValidReferenceFormat(reference: string): boolean {
  return new RegExp(`^${PREFIX}-[${ALPHABET}]{${LENGTH}}$`).test(reference);
}
