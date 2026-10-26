import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { supabase } from '@/lib/supabase';
import type { UserProfile, UserRole } from '@/types';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserProfile | null>(null);
  const loading = ref(false);
  const errorMessage = ref<string | null>(null);

  const isAuthenticated = computed(() => !!user.value);
  const isIntern = computed(() => user.value?.role === 'intern');
  const isSupervisor = computed(() => user.value?.role === 'supervisor');
  const isCoordinator = computed(() => user.value?.role === 'coordinator');

  // Detects production URL (Vercel) or local development for Auth redirects
  const getRedirectUrl = (path: string = '') => {
    const origin = window.location.origin;
    return `${origin}${path}`;
  };

  /**
   * 1. Sign Up with User Role, Full Name, Contact Number
   * Sends confirmation email link to Gmail.
   */
  const signUp = async (params: {
    email: string;
    password: string;
    fullName: string;
    contactNumber: string;
    role: UserRole;
  }) => {
    loading.value = true;
    errorMessage.value = null;

    try {
      const { data, error } = await supabase.auth.signUp({
        email: params.email,
        password: params.password,
        options: {
          data: {
            full_name: params.fullName,
            contact_number: params.contactNumber,
            role: params.role,
          },
          emailRedirectTo: getRedirectUrl('/auth'),
        },
      });

      if (error) throw error;
      return data;
    } catch (err: any) {
      errorMessage.value = err.message || 'Failed to sign up. Please try again.';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * 2. Direct Sign In with Email and Password
   */
  const signIn = async (email: string, pass: string) => {
    loading.value = true;
    errorMessage.value = null;

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: pass,
      });

      if (error) throw error;
      await fetchProfile();
      return data;
    } catch (err: any) {
      errorMessage.value = err.message || 'Invalid email or password.';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * 3. Fetch Master Profile Record
   */
  const fetchProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        user.value = null;
        return null;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (error) throw error;
      user.value = data as UserProfile;
      return user.value;
    } catch (err: any) {
      console.error('Error fetching profile:', err.message);
      return null;
    }
  };

  /**
   * 4. Forgot Password - Dispatches Password Reset Email
   */
  const sendPasswordReset = async (emailAddress: string) => {
    loading.value = true;
    errorMessage.value = null;

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(emailAddress, {
        redirectTo: getRedirectUrl('/reset-password'),
      });

      if (error) throw error;
      return true;
    } catch (err: any) {
      errorMessage.value = err.message || 'Failed to send password reset email.';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * 5. Update Profile Record (Used in Profile Settings Modal)
   */
  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user.value) return;
    loading.value = true;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.value.id)
        .select()
        .single();

      if (error) throw error;
      user.value = data as UserProfile;
      return user.value;
    } catch (err: any) {
      errorMessage.value = err.message || 'Failed to update profile information.';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * 6. Sign Out
   */
  const signOut = async () => {
    loading.value = true;
    try {
      await supabase.auth.signOut();
      user.value = null;
    } finally {
      loading.value = false;
    }
  };

  return {
    user,
    loading,
    errorMessage,
    isAuthenticated,
    isIntern,
    isSupervisor,
    isCoordinator,
    signUp,
    signIn,
    fetchProfile,
    sendPasswordReset,
    updateProfile,
    signOut,
  };
});