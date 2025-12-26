'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import api from '../lib/api'

type User = {
  id: number
  email: string
  fullName?: string
  role?: string
}

type AuthContextType = {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signup: (email: string, password: string, fullName: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const storedUser = localStorage.getItem('workbot_user')
    if (storedUser) {
      setUser(JSON.parse(storedUser))
    }
    setLoading(false)
  }, [])

  const login = async (email: string, password: string) => {
    try {
      const res = await api.post('/api/auth/login', { email, password })
      const { token, user } = res.data
      localStorage.setItem('workbot_token', token)
      localStorage.setItem('workbot_user', JSON.stringify(user))
      setUser(user)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.response?.data?.message || 'Login failed' }
    }
  }

  const signup = async (email: string, password: string, fullName: string) => {
    try {
      const res = await api.post('/api/auth/signup', { email, password, fullName })
      const { token, user } = res.data
      localStorage.setItem('workbot_token', token)
      localStorage.setItem('workbot_user', JSON.stringify(user))
      setUser(user)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.response?.data?.message || 'Signup failed' }
    }
  }

  const logout = () => {
    if (typeof window === 'undefined') return
    localStorage.removeItem('workbot_token')
    localStorage.removeItem('workbot_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
