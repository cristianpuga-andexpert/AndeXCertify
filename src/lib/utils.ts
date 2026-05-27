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

/** Generic API error handler — logs and rethrows with a descriptive message. */
export function handleApiError(error: unknown, context: string): never {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[API Error] ${context}:`, message);
  throw new Error(message);
}
