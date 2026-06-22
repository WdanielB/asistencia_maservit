/**
 * Autenticación del panel (frontend).
 * Guarda el token en localStorage, lo inyecta en todas las llamadas fetch a /api
 * y lo añade como ?token= en las URLs que no pasan por fetch (<img>, descargas, SSE).
 */
const KEY = 'maservit_token';

export const getToken = (): string => localStorage.getItem(KEY) || '';
export const setToken = (t: string): void => localStorage.setItem(KEY, t);
export const clearToken = (): void => localStorage.removeItem(KEY);
export const isAuthed = (): boolean => !!getToken();

/** Añade el token como query param para <img src>, <a href> de descarga y EventSource. */
export function withToken(url: string): string {
  const t = getToken();
  if (!t) return url;
  return url + (url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(t);
}

/**
 * Reemplaza window.fetch por una versión que añade Authorization: Bearer en las
 * llamadas a /api y, ante un 401, cierra la sesión y recarga (vuelve al login).
 */
export function installAuthInterceptor(): void {
  const orig = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const isApi = url.startsWith('/api/');
    if (isApi) {
      const t = getToken();
      if (t) {
        const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
        headers.set('Authorization', 'Bearer ' + t);
        init = { ...init, headers };
      }
    }
    const res = await orig(input as RequestInfo, init);
    // Sesión expirada o inválida: salir (excepto en el propio login).
    if (res.status === 401 && isApi && !url.includes('/admin/login')) {
      clearToken();
      location.reload();
    }
    return res;
  };
}
