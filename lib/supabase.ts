import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          storageKey: 'rzodkiewkowo-auth',
        },
      }
    )
  }
  return _client
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop: string) {
    return getClient()[prop as keyof SupabaseClient]
  },
})
