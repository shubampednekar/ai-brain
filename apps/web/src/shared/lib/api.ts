import { apiUrl, supabase } from '@/shared/lib/supabase';

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  return fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      ...options.headers,
    },
  });
}

export async function apiJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, options);
  const body = await response.json() as T & { error?: string };
  if (!response.ok) {
    throw new Error(body.error ?? 'Request failed');
  }
  return body;
}
