import { defineStore } from 'pinia';
import { supabase } from '@/lib/supabase';
import type { UserRole, UserProfile } from '@/types';

export interface UserProfileData {
  id: string;
  email?: string;
  full_name: string;
  role: UserRole | null;
  contact_number?: string;
  home_address?: string;
  emergency_contact_name?: string;
  emergency_contact_number?: string;
  avatar_url?: string;
  supervisor_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface AuthState {
  user: UserProfile | UserProfileData | null;
  loading: boolean;
  error: string | null;
  isInitialized: boolean;
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    loading: false,
    error: null,
    isInitialized: false,
  }),

  getters: {
    isAuthenticated: (state) => !!state.user,
    role: (state) => state.user?.role || null,
    isIntern: (state) => state.user?.role === 'intern',
    isSupervisor: (state) => state.user?.role === 'supervisor',
    isCoordinator: (state) => state.user?.role === 'coordinator',
  },

  actions: {
    async initialize() {
      if (this.isInitialized) return;
      this.loading = true;

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await this.fetchProfile(user.id);
        } else {
          this.user = null;
        }
      } catch (err: any) {
        this.error = err.message || 'Failed to initialize session.';
        this.user = null;
      } finally {
        this.loading = false;
        this.isInitialized = true;
      }
    },

    async fetchProfile(userId?: string) {
      try {
        let targetId = userId;
        let authUser: any = null;

        if (!targetId) {
          const { data } = await supabase.auth.getUser();
          authUser = data.user;
          targetId = authUser?.id;
        }

        if (!targetId) {
          this.user = null;
          return null;
        }

        // Kunin ang profile mula sa public.profiles table
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', targetId)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          this.user = data as UserProfileData;
        } else {
          // Fallback para sa mga bagong Google OAuth users na wala pang row sa profiles table
          if (!authUser) {
            const { data: userRes } = await supabase.auth.getUser();
            authUser = userRes.user;
          }

          if (authUser) {
            const meta = authUser.user_metadata || {};
            this.user = {
              id: authUser.id,
              email: authUser.email,
              full_name: meta.full_name || meta.name || authUser.email?.split('@')[0] || 'User',
              role: (meta.role as UserRole) || null,
              avatar_url: meta.avatar_url || meta.picture || undefined,
            };
          } else {
            this.user = null;
          }
        }

        return this.user;
      } catch (err: any) {
        this.error = err.message || 'Failed to fetch user profile.';
        return null;
      }
    },

    async signIn(email: string, pass: string) {
      this.loading = true;
      this.error = null;
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: pass,
        });

        if (error) throw error;

        if (data.user) {
          await this.fetchProfile(data.user.id);
          this.isInitialized = true;
        }
      } catch (err: any) {
        this.error = err.message || 'Failed to sign in.';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async signUp(email: string, pass: string, fullName: string, role: UserRole) {
      this.loading = true;
      this.error = null;
      try {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: pass,
          options: {
            data: {
              full_name: fullName.trim(),
              role: role,
            },
          },
        });

        if (error) throw error;

        if (data.session && data.user) {
          await this.fetchProfile(data.user.id);
          this.isInitialized = true;
        }

        return data;
      } catch (err: any) {
        this.error = err.message || 'Failed to register account.';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async signInWithGoogle() {
      this.loading = true;
      this.error = null;
      try {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/auth`,
            queryParams: {
              access_type: 'offline',
              prompt: 'consent',
            },
          },
        });
        if (error) throw error;
      } catch (err: any) {
        this.error = err.message || 'Failed to authenticate with Google.';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async assignGoogleRole(role: UserRole) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user session found.');

      const fullName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User';
      const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || null;

      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: fullName,
          role: role,
          email: user.email,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      await this.fetchProfile(user.id);
    },

    async signOut() {
      this.loading = true;
      this.error = null;
      try {
        await supabase.auth.signOut();
      } catch (err: any) {
        console.error('Sign out error:', err);
      } finally {
        this.user = null;
        this.isInitialized = true;
        this.loading = false;
      }
    },
  },
});