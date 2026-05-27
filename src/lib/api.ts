import { supabase } from './supabase';

const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true';

async function getAuthHeaders(): Promise<HeadersInit> {
  // DEV mode: server bypasses JWT verification, any Bearer value is accepted
  if (DEV_MODE) {
    return { 'Content-Type': 'application/json', 'Authorization': 'Bearer dev-bypass' };
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('No autenticado');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
  };
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(path, {
    ...init,
    headers: { ...authHeaders, ...(init?.headers as HeadersInit | undefined) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || body.details || res.statusText);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get:  <T>(path: string)               => apiFetch<T>(path),
  post: <T>(path: string, body: unknown) => apiFetch<T>(path, { method: 'POST',   body: JSON.stringify(body) }),
  put:  <T>(path: string, body: unknown) => apiFetch<T>(path, { method: 'PUT',    body: JSON.stringify(body) }),
  del:  <T>(path: string)               => apiFetch<T>(path, { method: 'DELETE' }),
};
