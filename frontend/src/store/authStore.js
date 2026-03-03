import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { AuthAPI } from '../api/client'

export const useAuthStore = create(
    persist(
        (set, get) => ({
            user: null,
            token: null,
            isLoading: false,

            setToken: (token) => {
                localStorage.setItem('acuvera_token', token)
                set({ token })
            },

            fetchUser: async () => {
                set({ isLoading: true })
                try {
                    const user = await AuthAPI.whoami()
                    set({ user, isLoading: false })
                } catch {
                    set({ user: null, isLoading: false })
                }
            },

            logout: () => {
                localStorage.removeItem('acuvera_token')
                localStorage.removeItem('acuvera_bypass_user_id')
                set({ user: null, token: null })
                window.location.href = '/login'
            },
        }),
        { name: 'acuvera-auth', partialize: (s) => ({ token: s.token }) }
    )
)
