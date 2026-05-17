'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const AuthContext = createContext<{ user: User | null }>({ user: null })
export const useAuth = () => useContext(AuthContext)

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Nieprawidłowy email lub hasło')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-2xl mb-4 text-4xl">
            🌱
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Rzodkiewkowo</h1>
          <p className="text-sm text-gray-500 mt-1">Zaloguj się, aby kontynuować</p>
        </div>

        <form onSubmit={login} className="space-y-4">
          <div>
            <Label className="text-sm font-medium text-gray-700">Email</Label>
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="twoj@email.pl"
              required
              autoComplete="email"
              className="mt-1 h-12 text-base"
            />
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-700">Hasło</Label>
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="mt-1 h-12 text-base"
            />
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={loading}>
            {loading ? 'Logowanie...' : 'Zaloguj'}
          </Button>
        </form>
      </div>
    </div>
  )
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center">
        <div className="text-green-600 text-sm font-medium">Ładowanie...</div>
      </div>
    )
  }

  if (!user) return <LoginForm />
  return <AuthContext.Provider value={{ user }}>{children}</AuthContext.Provider>
}
