import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRut(rut: string): string {
  const cleanRut = rut.replace(/[^\dKk]/g, '');
  if (cleanRut.length < 2) return cleanRut;

  const body = cleanRut.slice(0, -1);
  const dv = cleanRut.slice(-1).toUpperCase();

  let result = '';
  for (let i = body.length - 1, j = 1; i >= 0; i--, j++) {
    result = body.charAt(i) + result;
    if (j % 3 === 0 && i !== 0) result = '.' + result;
  }

  return `${result}-${dv}`;
}

/**
 * Converts an ArrayBuffer to a base64 string in fixed-size chunks.
 * Avoids `String.fromCharCode(...new Uint8Array(buf))`, whose argument spread
 * overflows the call stack ("Maximum call stack size exceeded") on large files.
 */
export function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const CHUNK = 0x8000; // 32 KB per chunk
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK) as unknown as number[]);
  }
  return btoa(binary);
}

/** Generic API error handler — logs and rethrows with a descriptive message. */
export function handleApiError(error: unknown, context: string): never {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[API Error] ${context}:`, message);
  throw new Error(message);
}
