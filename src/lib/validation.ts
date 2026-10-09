export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 200;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

export interface FieldErrors {
  [field: string]: string;
}

export function validateEmail(email: unknown): string | null {
  if (typeof email !== 'string' || email.trim() === '') return 'Email address is required.';
  if (email.length > 254) return 'Email address is too long.';
  if (!EMAIL_PATTERN.test(email.trim())) return 'Enter a valid email address.';
  return null;
}

export function validatePassword(password: unknown): string | null {
  if (typeof password !== 'string' || password === '') return 'Password is required.';
  if (password.length < MIN_PASSWORD_LENGTH)
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`;
  if (password.length > MAX_PASSWORD_LENGTH) return 'Password is too long.';
  if (!/[A-Za-z]/.test(password)) return 'Password must contain at least one letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
  return null;
}

export function validateName(name: unknown): string | null {
  if (typeof name !== 'string' || name.trim() === '') return 'Please enter a name.';
  if (name.trim().length > 80) return 'Name is too long.';
  return null;
}

export function parsePrice(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[,\s₱]/g, '');
    if (cleaned === '') return 0;
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function formatPrice(value: number | string | null | undefined): string {
  const amount = typeof value === 'number' ? value : Number(value ?? 0);
  const safe = Number.isFinite(amount) ? amount : 0;
  return `₱${safe.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
