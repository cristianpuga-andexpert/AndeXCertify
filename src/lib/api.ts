import { tokenStorage } from './auth-context';

const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true';

// ─── Token refresh ────────────────────────────────────────────────────────────

async function tryRefresh(): Promise<string | null> {
  // The refresh token is sent automatically via the httpOnly cookie.
  const res = await fetch('/api/auth/refresh', {
    method:      'POST',
    credentials: 'include',
  });

  if (!res.ok) {
    tokenStorage.clearTokens();
    return null;
  }

  // Server rotates the refresh cookie and returns only the new access token.
  const data = await res.json() as { accessToken: string };
  tokenStorage.setAccess(data.accessToken);
  return data.accessToken;
}

function redirectToLogin(): void {
  tokenStorage.clearTokens();
  window.location.href = '/login';
}

// ─── Auth headers ─────────────────────────────────────────────────────────────

function getAuthHeaders(accessToken: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
  };
}

// ─── Core fetch with auto-refresh on 401 ─────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  // DEV mode: send a fixed bearer token — server accepts anything in DEV_MODE
  if (DEV_MODE) {
    const res = await fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer dev-bypass',
        ...(init?.headers as HeadersInit | undefined),
      },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(body.error || body.details || res.statusText);
    }
    return res.json() as Promise<T>;
  }

  // Production: read access token from localStorage
  let accessToken = tokenStorage.getAccess();
  if (!accessToken) {
    redirectToLogin();
    throw new Error('No autenticado');
  }

  // First attempt
  let res = await fetch(path, {
    ...init,
    headers: { ...getAuthHeaders(accessToken), ...(init?.headers as HeadersInit | undefined) },
  });

  // On 401: try to refresh once, then retry
  if (res.status === 401) {
    const newToken = await tryRefresh();
    if (!newToken) {
      redirectToLogin();
      throw new Error('Sesión expirada');
    }
    res = await fetch(path, {
      ...init,
      headers: { ...getAuthHeaders(newToken), ...(init?.headers as HeadersInit | undefined) },
    });
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || body.details || res.statusText);
  }

  return res.json() as Promise<T>;
}

// ─── Raw fetch with auth (for binary responses: PDF/DOCX/ZIP blobs) ──────────
// Mirrors apiFetch (token + 401-refresh retry) but returns the raw Response so
// the caller can read .blob(). Does NOT throw on non-ok — the caller inspects
// response.ok and reads the error body itself.

async function apiFetchRaw(path: string, init?: RequestInit): Promise<Response> {
  const extraHeaders = init?.headers as HeadersInit | undefined;

  if (DEV_MODE) {
    return fetch(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer dev-bypass', ...extraHeaders },
    });
  }

  const accessToken = tokenStorage.getAccess();
  if (!accessToken) { redirectToLogin(); throw new Error('No autenticado'); }

  let res = await fetch(path, {
    ...init,
    headers: { ...getAuthHeaders(accessToken), ...extraHeaders },
  });

  if (res.status === 401) {
    const newToken = await tryRefresh();
    if (!newToken) { redirectToLogin(); throw new Error('Sesión expirada'); }
    res = await fetch(path, {
      ...init,
      headers: { ...getAuthHeaders(newToken), ...extraHeaders },
    });
  }

  return res;
}

export const api = {
  get:   <T>(path: string)                => apiFetch<T>(path),
  post:  <T>(path: string, body: unknown) => apiFetch<T>(path, { method: 'POST',   body: JSON.stringify(body) }),
  put:   <T>(path: string, body: unknown) => apiFetch<T>(path, { method: 'PUT',    body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => apiFetch<T>(path, { method: 'PATCH',  body: JSON.stringify(body) }),
  del:   <T>(path: string)               => apiFetch<T>(path, { method: 'DELETE' }),
  // Returns the raw Response (for blob downloads). Attaches auth + handles refresh.
  postRaw: (path: string, body: unknown) => apiFetchRaw(path, { method: 'POST', body: JSON.stringify(body) }),
};
