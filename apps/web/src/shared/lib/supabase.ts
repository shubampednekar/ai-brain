import { createSupabaseClient } from '@ai-brain/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey);

export const apiUrl = (import.meta.env.VITE_API_URL as string) || '/api';
