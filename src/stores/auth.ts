import { defineStore } from 'pinia';
import { supabase } from '@/lib/supabase';
import type { UserRole, UserProfile } from '@/types';

export interface UserProfileData {
  id: string;
  full_name: string;
  role: UserRole;
  contact_number?: string;
  home_address?: string;
  emergency_contact_name?: string;
  emergency_contact_number?: string;
  avatar_url?: string;
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
      try {
        this.loading = true;
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await this.fetchProfile();
        }
      } catch (err: any) {
        this.error = err.message || 'Failed to initialize authentication.';
      } finally {
        this.loading = false;
        this.isInitialized = true;
      }
    },

    async fetchProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          this.user = null;
          return;
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (error) throw error;
        this.user = data as any;
      } catch (err: any) {
        this.error = err.message || 'Failed to fetch user profile.';
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
          await this.fetchProfile();
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

        if (data.user) {
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
              id: data.user.id,
              full_name: fullName.trim(),
              role: role,
            });

          if (profileError) throw profileError;
          await this.fetchProfile();
        }
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

      const fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';

      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: fullName,
          role: role,
        });

      if (error) throw error;
      await this.fetchProfile();
    },

    async signOut() {
      this.loading = true;
      try {
        await supabase.auth.signOut();
        this.user = null;
      } catch (err: any) {
        this.error = err.message || 'Failed to sign out.';
      } finally {
        this.loading = false;
      }
    },
  },
});