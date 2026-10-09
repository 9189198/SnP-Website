import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
// scrypt parameters (interactive-ish, safe default for a small app)
const COST = 16384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;

/**
 * Hashes a plain text password with scrypt and a random salt.
 * Format: scrypt$<cost>$<blockSize>$<parallelization>$<saltHex>$<hashHex>
 * Plain text passwords are never stored.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const derived = scryptSync(password.normalize('NFKC'), salt, KEY_LENGTH, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLELIZATION,
    maxmem: 64 * 1024 * 1024,
  });
  return [
    'scrypt',
    COST,
    BLOCK_SIZE,
    PARALLELIZATION,
    salt.toString('hex'),
    derived.toString('hex'),
  ].join('$');
}

/** Constant-time verification of a plain text password against a stored hash. */
export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, cost, blockSize, parallelization, saltHex, hashHex] = stored.split('$');
    if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
    const expected = Buffer.from(hashHex, 'hex');
    const derived = scryptSync(password.normalize('NFKC'), Buffer.from(saltHex, 'hex'), expected.length, {
      N: Number(cost),
      r: Number(blockSize),
      p: Number(parallelization),
      maxmem: 64 * 1024 * 1024,
    });
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}
