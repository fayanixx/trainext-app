<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import type { UserRole } from '@/types';
import type { Subscription } from '@supabase/supabase-js';

const router = useRouter();
const authStore = useAuthStore();

const activeTab = ref<'login' | 'signup' | 'forgot' | 'updatePassword'>('login');
const selectedRole = ref<UserRole>('intern');

const firstName = ref('');
const lastName = ref('');
const email = ref('');
const password = ref('');
const confirmPassword = ref('');

const showPassword = ref(false);
const showConfirmPassword = ref(false);
const loading = ref(false);
const errorMessage = ref('');
const successMessage = ref('');

// Google New User Onboarding Modal State
const isRoleModalOpen = ref(false);
const googleOnboardingRole = ref<UserRole>('intern');
const isSubmittingRole = ref(false);

let authSubscription: Subscription | null = null;

const switchTab = (tab: 'login' | 'signup' | 'forgot' | 'updatePassword') => {
  activeTab.value = tab;
  errorMessage.value = '';
  successMessage.value = '';
};

const routeByRole = (role?: string | null) => {
  if (role === 'supervisor') router.replace('/supervisor');
  else if (role === 'coordinator') router.replace('/coordinator');
  else router.replace('/intern');
};

const cleanUrlHash = () => {
  if (window.location.hash) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }
};

const checkAndRouteUser = async () => {
  loading.value = true;
  try {
    await authStore.fetchProfile();
    cleanUrlHash();

    if (authStore.user?.role) {
      routeByRole(authStore.user.role);
    } else {
      isRoleModalOpen.value = true;
    }
  } catch (err: any) {
    errorMessage.value = err.message || 'Failed to retrieve user profile.';
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  // 1. Suriin kung galing sa Password Recovery link ang user
  if (window.location.hash.includes('type=recovery')) {
    activeTab.value = 'updatePassword';
    cleanUrlHash();
    return;
  }

  // 2. Makinig sa Auth State events (para sa Google OAuth at recovery triggers)
  const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      activeTab.value = 'updatePassword';
      cleanUrlHash();
      return;
    }

    if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
      if (activeTab.value !== 'updatePassword') {
        await checkAndRouteUser();
      }
    }
  });
  authSubscription = data.subscription;

  // 3. Fallback: Suriin kung may active cached session
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user && activeTab.value !== 'updatePassword') {
    await checkAndRouteUser();
  }
});

onUnmounted(() => {
  if (authSubscription) {
    authSubscription.unsubscribe();
  }
});

const handleLogin = async () => {
  errorMessage.value = '';
  successMessage.value = '';

  if (!email.value.trim() || !password.value) {
    errorMessage.value = 'Please provide both email and password.';
    return;
  }

  loading.value = true;
  try {
    await authStore.signIn(email.value.trim(), password.value);
    if (authStore.user?.role) {
      routeByRole(authStore.user.role);
    }
  } catch (err: any) {
    errorMessage.value = err.message || 'Invalid credentials. Please try again.';
  } finally {
    loading.value = false;
  }
};

const handleSignup = async () => {
  errorMessage.value = '';
  successMessage.value = '';

  if (!email.value.trim() || !password.value || !firstName.value.trim() || !lastName.value.trim()) {
    errorMessage.value = 'Please fill in all required fields.';
    return;
  }

  if (password.value !== confirmPassword.value) {
    errorMessage.value = 'Passwords do not match.';
    return;
  }

  if (password.value.length < 8) {
    errorMessage.value = 'Password must be at least 8 characters.';
    return;
  }

  loading.value = true;
  try {
    const fullName = `${firstName.value.trim()} ${lastName.value.trim()}`;
    await authStore.signUp(email.value.trim(), password.value, fullName, selectedRole.value);

    if (authStore.user) {
      routeByRole(authStore.user.role);
    } else {
      successMessage.value = `Verification link sent to ${email.value.trim()}. Please verify your email before logging in.`;
      activeTab.value = 'login';
      password.value = '';
      confirmPassword.value = '';
    }
  } catch (err: any) {
    errorMessage.value = err.message || 'Failed to register account.';
  } finally {
    loading.value = false;
  }
};

const handleGoogleAuth = async () => {
  errorMessage.value = '';
  try {
    // Dynamic callback base sa kasalukuyang domain (gumagana sa localhost at Vercel)
    const redirectUrl = `${window.location.origin}/auth`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) throw error;
  } catch (err: any) {
    errorMessage.value = err.message || 'Google sign-in failed.';
  }
};

const handleForgotPassword = async () => {
  errorMessage.value = '';
  successMessage.value = '';

  if (!email.value.trim()) {
    errorMessage.value = 'Please enter your email address.';
    return;
  }

  loading.value = true;
  try {
    const redirectUrl = `${window.location.origin}/auth`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.value.trim(), {
      redirectTo: redirectUrl,
    });

    if (error) throw error;
    successMessage.value = 'Password reset instructions have been sent to your email.';
  } catch (err: any) {
    errorMessage.value = err.message || 'Failed to send password reset email.';
  } finally {
    loading.value = false;
  }
};

const handleUpdatePassword = async () => {
  errorMessage.value = '';
  successMessage.value = '';

  if (!password.value) {
    errorMessage.value = 'Please enter a new password.';
    return;
  }

  if (password.value !== confirmPassword.value) {
    errorMessage.value = 'Passwords do not match.';
    return;
  }

  if (password.value.length < 8) {
    errorMessage.value = 'Password must be at least 8 characters.';
    return;
  }

  loading.value = true;
  try {
    const { error } = await supabase.auth.updateUser({
      password: password.value,
    });

    if (error) throw error;
    successMessage.value = 'Password updated successfully! You can now log in.';
    password.value = '';
    confirmPassword.value = '';
    activeTab.value = 'login';
  } catch (err: any) {
    errorMessage.value = err.message || 'Failed to update password.';
  } finally {
    loading.value = false;
  }
};

const confirmGoogleRole = async () => {
  isSubmittingRole.value = true;
  try {
    await authStore.assignGoogleRole(googleOnboardingRole.value);
    isRoleModalOpen.value = false;
    routeByRole(googleOnboardingRole.value);
  } catch (err: any) {
    errorMessage.value = err.message || 'Failed to assign role.';
  } finally {
    isSubmittingRole.value = false;
  }
};
</script>

<template>
  <main class="auth-page select-none">
    <div class="auth-background" aria-hidden="true"></div>
    <div class="auth-overlay" aria-hidden="true"></div>

    <div class="auth-layout">
      <!-- BRAND LOGO -->
      <div class="brand">
        <img src="/assets/trainext-logo.png" alt="Trainext" class="brand-logo" />
      </div>

      <!-- MAIN GLASS CARD -->
      <section class="glass-card" :class="{ 'signup-card': activeTab === 'signup' }">
        
        <!-- TABS (Nakatago kapag nasa Forgot o Update Password flow) -->
        <nav v-if="activeTab === 'login' || activeTab === 'signup'" class="auth-tabs" aria-label="Authentication">
          <button
            type="button"
            class="auth-tab"
            :class="{ active: activeTab === 'login' }"
            @click="switchTab('login')"
          >
            LOGIN
            <span v-if="activeTab === 'login'" class="tab-indicator"></span>
          </button>

          <span class="tab-divider" aria-hidden="true"></span>

          <button
            type="button"
            class="auth-tab"
            :class="{ active: activeTab === 'signup' }"
            @click="switchTab('signup')"
          >
            SIGNUP
            <span v-if="activeTab === 'signup'" class="tab-indicator"></span>
          </button>
        </nav>

        <!-- CYBER-GLASS ALERTS & CONFIRMATION -->
        <div v-if="errorMessage" class="message message-error" role="alert">
          <svg class="message-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="10" stroke-width="2" />
            <line x1="12" y1="8" x2="12" y2="12" stroke-width="2" stroke-linecap="round" />
            <line x1="12" y1="16" x2="12.01" y2="16" stroke-width="2" stroke-linecap="round" />
          </svg>
          <span>{{ errorMessage }}</span>
        </div>

        <div v-if="successMessage" class="message message-success" role="status">
          <svg class="message-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{{ successMessage }}</span>
        </div>

        <!-- ================= LOGIN TAB ================= -->
        <div v-if="activeTab === 'login'" class="login-content">
          <header class="login-heading">
            <h1>Welcome,</h1>
            <p>Sign in to continue</p>
          </header>

          <form class="auth-form login-form" @submit.prevent="handleLogin">
            <!-- Email -->
            <div class="field field-login-email">
              <label for="login-email">EMAIL ADDRESS</label>
              <div class="input-line">
                <svg class="field-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 6.5h18v11H3z" />
                  <path d="m3.5 7 8.5 6 8.5-6" />
                </svg>
                <input
                  id="login-email"
                  v-model="email"
                  type="email"
                  autocomplete="email"
                  required
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <!-- Password -->
            <div class="field field-login-password">
              <label for="login-password">PASSWORD</label>
              <div class="input-line">
                <svg class="field-icon filled-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="5" y="10" width="14" height="11" rx="1.5" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
                <input
                  id="login-password"
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  autocomplete="current-password"
                  required
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  class="visibility-button"
                  :aria-label="showPassword ? 'Hide password' : 'Show password'"
                  @click="showPassword = !showPassword"
                >
                  <svg v-if="!showPassword" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M2.5 12s3.4-6.5 9.5-6.5 9.5 6.5-3.4 6.5-9.5 6.5S2.5 12 2.5 12Z" />
                    <circle cx="12" cy="12" r="2.8" />
                  </svg>
                  <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m3 3 18 18M10.6 5.7A10.7 10.7 0 0 1 12 5.5c6.1 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.2 3.9M6.2 6.7C3.8 8.4 2.5 12 2.5 12s3.4 6.5 9.5 6.5a10 10 0 0 0 3-.5" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- Forgot Password -->
            <div class="forgot-row">
              <button type="button" class="forgot-link" @click="switchTab('forgot')">FORGOT PASSWORD?</button>
            </div>

            <!-- Submit -->
            <button type="submit" class="primary-button login-button" :disabled="loading || authStore.loading">
              {{ (loading || authStore.loading) ? 'WAIT...' : 'LOGIN' }}
            </button>
            <!-- Divider -->
            <div class="or-divider" aria-label="or">
              <span></span><small>OR</small><span></span>
            </div>

            <!-- Google OAuth -->
            <button type="button" class="google-button" :disabled="loading || authStore.loading" @click="handleGoogleAuth">
              <span>CONTINUE WITH</span>
              <svg class="google-icon" viewBox="0 0 48 48" aria-label="Google">
                <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15Z"/>
                <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44Z"/>
                <path fill="#FBBC05" d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.3H5.8a20 20 0 0 0 0 17.8l6.8-5.3Z"/>
                <path fill="#EA4335" d="M24 11.9c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 5.8 29.5 4 24 4A20 20 0 0 0 5.8 15.1l6.8 5.3c1.6-4.8 6.1-8.5 11.4-8.5Z"/>
              </svg>
            </button>

            <!-- Switch to Signup -->
            <p class="switch-prompt">
              Don't have an account?
              <button type="button" @click="switchTab('signup')">SIGN UP</button>
            </p>
          </form>
        </div>

        <!-- ================= SIGNUP TAB ================= -->
        <div v-else-if="activeTab === 'signup'" class="signup-content">
          <header class="signup-heading">
            <h1>Create your Account</h1>
            <p>Get started with verified OJT tracking and safety.</p>
          </header>

          <form class="auth-form signup-form" @submit.prevent="handleSignup">
            <!-- Account Role Selection -->
            <fieldset class="role-field">
              <legend>ACCOUNT ROLE</legend>
              <div class="role-options">
                <button
                  type="button"
                  :class="{ selected: selectedRole === 'intern', intern: true }"
                  @click="selectedRole = 'intern'"
                >Intern</button>
                <button
                  type="button"
                  :class="{ selected: selectedRole === 'supervisor', supervisor: true }"
                  @click="selectedRole = 'supervisor'"
                >Supervisor</button>
                <button
                  type="button"
                  :class="{ selected: selectedRole === 'coordinator', coordinator: true }"
                  @click="selectedRole = 'coordinator'"
                >Coordinator</button>
              </div>
            </fieldset>

            <!-- First and Last Name -->
            <div class="name-row">
              <div class="field">
                <label for="first-name">FIRST NAME</label>
                <div class="input-line">
                  <svg class="field-icon filled-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="7.5" r="4" />
                    <path d="M4 21v-2a8 8 0 0 1 16 0v2z" />
                  </svg>
                  <input id="first-name" v-model="firstName" type="text" autocomplete="given-name" required placeholder="Juan" />
                </div>
              </div>

              <div class="field">
                <label for="last-name">LAST NAME</label>
                <div class="input-line">
                  <svg class="field-icon filled-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="7.5" r="4" />
                    <path d="M4 21v-2a8 8 0 0 1 16 0v2z" />
                  </svg>
                  <input id="last-name" v-model="lastName" type="text" autocomplete="family-name" required placeholder="Dela Cruz" />
                </div>
              </div>
            </div>

            <!-- Email Address -->
            <div class="field signup-email">
              <label for="signup-email">EMAIL ADDRESS</label>
              <div class="input-line">
                <svg class="field-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 6.5h18v11H3z" />
                  <path d="m3.5 7 8.5 6 8.5-6" />
                </svg>
                <input id="signup-email" v-model="email" type="email" autocomplete="email" required placeholder="you@example.com" />
              </div>
            </div>

            <!-- Password -->
            <div class="field signup-password">
              <label for="signup-password">PASSWORD</label>
              <div class="input-line">
                <svg class="field-icon filled-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="5" y="10" width="14" height="11" rx="1.5" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
                <input id="signup-password" v-model="password" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" required minlength="8" placeholder="Minimum of 8 characters" />
                <button type="button" class="visibility-button" :aria-label="showPassword ? 'Hide password' : 'Show password'" @click="showPassword = !showPassword">
                  <svg v-if="!showPassword" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M2.5 12s3.4-6.5 9.5-6.5 9.5 6.5-3.4 6.5-9.5 6.5S2.5 12 2.5 12Z" />
                    <circle cx="12" cy="12" r="2.8" />
                  </svg>
                  <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m3 3 18 18M10.6 5.7A10.7 10.7 0 0 1 12 5.5c6.1 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.2 3.9M6.2 6.7C3.8 8.4 2.5 12 2.5 12s3.4 6.5 9.5 6.5a10 10 0 0 0 3-.5" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- Confirm Password -->
            <div class="field signup-confirm">
              <label for="confirm-password">CONFIRM PASSWORD</label>
              <div class="input-line">
                <svg class="field-icon filled-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="5" y="10" width="14" height="11" rx="1.5" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
                <input id="confirm-password" v-model="confirmPassword" :type="showConfirmPassword ? 'text' : 'password'" autocomplete="new-password" required placeholder="Re-enter your password" />
                <button type="button" class="visibility-button" :aria-label="showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'" @click="showConfirmPassword = !showConfirmPassword">
                  <svg v-if="!showConfirmPassword" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M2.5 12s3.4-6.5 9.5-6.5 9.5 6.5-3.4 6.5-9.5 6.5S2.5 12 2.5 12Z" />
                    <circle cx="12" cy="12" r="2.8" />
                  </svg>
                  <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m3 3 18 18M10.6 5.7A10.7 10.7 0 0 1 12 5.5c6.1 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.2 3.9M6.2 6.7C3.8 8.4 2.5 12 2.5 12s3.4 6.5 9.5 6.5a10 10 0 0 0 3-.5" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- Register Button -->
            <button type="submit" class="primary-button register-button" :disabled="loading || authStore.loading">
              {{ (loading || authStore.loading) ? 'WAIT...' : 'REGISTER' }}
            </button>

            <!-- Switch to Login -->
            <p class="switch-prompt signup-switch">
              Already have an account?
              <button type="button" @click="switchTab('login')">SIGN IN</button>
            </p>
          </form>
        </div>

        <!-- ================= FORGOT PASSWORD TAB ================= -->
        <div v-else-if="activeTab === 'forgot'" class="login-content">
          <header class="login-heading">
            <h1>Reset,</h1>
            <p>Enter email for instructions</p>
          </header>

          <form class="auth-form login-form" @submit.prevent="handleForgotPassword">
            <div class="field field-login-email mb-4">
              <label for="reset-email">EMAIL ADDRESS</label>
              <div class="input-line">
                <svg class="field-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 6.5h18v11H3z" />
                  <path d="m3.5 7 8.5 6 8.5-6" />
                </svg>
                <input
                  id="reset-email"
                  v-model="email"
                  type="email"
                  autocomplete="email"
                  required
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <button type="submit" class="primary-button login-button" :disabled="loading || authStore.loading">
              {{ loading ? 'SENDING...' : 'SEND RESET LINK' }}
            </button>

            <p class="switch-prompt">
              Remembered your password?
              <button type="button" @click="switchTab('login')">BACK TO LOGIN</button>
            </p>
          </form>
        </div>

        <!-- ================= UPDATE NEW PASSWORD TAB ================= -->
        <div v-else-if="activeTab === 'updatePassword'" class="login-content">
          <header class="login-heading">
            <h1>New Password,</h1>
            <p>Set up your new credentials</p>
          </header>

          <form class="auth-form login-form" @submit.prevent="handleUpdatePassword">
            <div class="field field-login-password mb-3">
              <label for="new-pass">NEW PASSWORD</label>
              <div class="input-line">
                <svg class="field-icon filled-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="5" y="10" width="14" height="11" rx="1.5" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
                <input
                  id="new-pass"
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  autocomplete="new-password"
                  required
                  minlength="8"
                  placeholder="Minimum of 8 characters"
                />
                <button
                  type="button"
                  class="visibility-button"
                  :aria-label="showPassword ? 'Hide password' : 'Show password'"
                  @click="showPassword = !showPassword"
                >
                  <svg v-if="!showPassword" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M2.5 12s3.4-6.5 9.5-6.5 9.5 6.5-3.4 6.5-9.5 6.5S2.5 12 2.5 12Z" />
                    <circle cx="12" cy="12" r="2.8" />
                  </svg>
                  <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m3 3 18 18M10.6 5.7A10.7 10.7 0 0 1 12 5.5c6.1 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.2 3.9M6.2 6.7C3.8 8.4 2.5 12 2.5 12s3.4 6.5 9.5 6.5a10 10 0 0 0 3-.5" />
                  </svg>
                </button>
              </div>
            </div>

            <div class="field field-login-password mb-4">
              <label for="confirm-new-pass">CONFIRM NEW PASSWORD</label>
              <div class="input-line">
                <svg class="field-icon filled-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="5" y="10" width="14" height="11" rx="1.5" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
                <input
                  id="confirm-new-pass"
                  v-model="confirmPassword"
                  :type="showConfirmPassword ? 'text' : 'password'"
                  autocomplete="new-password"
                  required
                  placeholder="Re-enter new password"
                />
                <button
                  type="button"
                  class="visibility-button"
                  :aria-label="showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'"
                  @click="showConfirmPassword = !showConfirmPassword"
                >
                  <svg v-if="!showConfirmPassword" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M2.5 12s3.4-6.5 9.5-6.5 9.5 6.5-3.4 6.5-9.5 6.5S2.5 12 2.5 12Z" />
                    <circle cx="12" cy="12" r="2.8" />
                  </svg>
                  <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m3 3 18 18M10.6 5.7A10.7 10.7 0 0 1 12 5.5c6.1 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.2 3.9M6.2 6.7C3.8 8.4 2.5 12 2.5 12s3.4 6.5 9.5 6.5a10 10 0 0 0 3-.5" />
                  </svg>
                </button>
              </div>
            </div>

            <button type="submit" class="primary-button login-button" :disabled="loading || authStore.loading">
              {{ loading ? 'UPDATING...' : 'SAVE PASSWORD' }}
            </button>
          </form>
        </div>
      </section>

      <!-- FOOTER -->
      <footer class="auth-footer">
        <span>Smart Tracking.</span>
        <span>Real-Time Safety.</span>
      </footer>
    </div>

    <!-- ================= GOOGLE ROLE ONBOARDING MODAL ================= -->
    <div 
      v-if="isRoleModalOpen" 
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
    >
      <div class="w-full max-w-sm rounded-[28px] border border-white/20 bg-[#07090f]/90 p-6 flex flex-col items-center text-center shadow-2xl">
        <div class="w-12 h-12 rounded-full bg-[#00d9ff]/10 border border-[#00d9ff]/30 flex items-center justify-center text-[#00d9ff] mb-3">
          <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="7.5" r="4" />
            <path d="M4 21v-2a8 8 0 0 1 16 0v2z" />
          </svg>
        </div>

        <h2 class="text-lg font-bold text-white tracking-tight">Select Your TraiNext Role</h2>
        <p class="text-xs text-slate-300 mt-1 mb-5">
          Welcome! Before continuing, please choose your system role.
        </p>

        <div class="grid grid-cols-3 gap-2 w-full mb-6">
          <button
            type="button"
            class="h-10 rounded-full text-xs font-semibold border transition cursor-pointer"
            :class="googleOnboardingRole === 'intern' 
              ? 'border-[#00d9ff] bg-[#00d9ff]/20 text-white shadow-[0_0_12px_rgba(0,217,255,0.3)]' 
              : 'border-white/20 bg-white/5 text-slate-400 hover:text-white'"
            @click="googleOnboardingRole = 'intern'"
          >
            Intern
          </button>
          <button
            type="button"
            class="h-10 rounded-full text-xs font-semibold border transition cursor-pointer"
            :class="googleOnboardingRole === 'supervisor' 
              ? 'border-[#00d9ff] bg-[#00d9ff]/20 text-white shadow-[0_0_12px_rgba(0,217,255,0.3)]' 
              : 'border-white/20 bg-white/5 text-slate-400 hover:text-white'"
            @click="googleOnboardingRole = 'supervisor'"
          >
            Supervisor
          </button>
          <button
            type="button"
            class="h-10 rounded-full text-xs font-semibold border transition cursor-pointer"
            :class="googleOnboardingRole === 'coordinator' 
              ? 'border-[#00d9ff] bg-[#00d9ff]/20 text-white shadow-[0_0_12px_rgba(0,217,255,0.3)]' 
              : 'border-white/20 bg-white/5 text-slate-400 hover:text-white'"
            @click="googleOnboardingRole = 'coordinator'"
          >
            Coordinator
          </button>
        </div>

        <button
          type="button"
          :disabled="isSubmittingRole"
          class="primary-button w-full h-[40px] text-xs"
          @click="confirmGoogleRole"
        >
          {{ isSubmittingRole ? 'SAVING ROLE...' : 'CONTINUE TO DASHBOARD' }}
        </button>
      </div>
    </div>
  </main>
</template>

<style>
@font-face {
  font-family: "Aileron";
  src: url("/fonts/Aileron-Regular.woff2") format("woff2");
  font-style: normal;
  font-weight: 400;
  font-display: swap;
}

@font-face {
  font-family: "Aileron";
  src: url("/fonts/Aileron-SemiBold.woff2") format("woff2");
  font-style: normal;
  font-weight: 600;
  font-display: swap;
}

@font-face {
  font-family: "Aileron";
  src: url("/fonts/Aileron-Bold.woff2") format("woff2");
  font-style: normal;
  font-weight: 700;
  font-display: swap;
}

:root {
  --tx-cyan: #00d9ff;
  --tx-white: #f8fbff;
  --tx-muted: #858994;
  --tx-line: rgba(225, 230, 240, 0.66);
  --tx-input-line: rgba(220, 225, 235, 0.72);
  --role-border: rgba(175, 181, 194, 0.58);
  --role-text: rgba(224, 228, 237, 0.88);
  --role-background: rgba(115, 122, 137, 0.055);
}

.auth-page,
.auth-page * {
  box-sizing: border-box;
}

.auth-page {
  position: relative;
  isolation: isolate;
  min-height: 100vh;
  min-height: 100dvh;
  width: 100%;
  overflow-x: hidden !important;
  overflow-y: auto !important;
  -webkit-overflow-scrolling: touch;
  background: #050609;
  color: var(--tx-white);
  font-family: "Aileron", sans-serif;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.auth-background {
  position: fixed;
  z-index: -2;
  inset: 0;
  background-image: url("/assets/bg-placeholder.png");
  background-position: center center;
  background-size: cover;
  background-repeat: no-repeat;
  transform: scale(1.015);
}

.auth-overlay {
  position: fixed;
  z-index: -1;
  inset: 0;
  background:
    linear-gradient(
      180deg,
      rgba(3, 5, 20, 0.55) 0%,
      rgba(2, 4, 9, 0.58) 48%,
      rgba(0, 0, 0, 0.74) 100%
    ),
    rgba(3, 5, 16, 0.28);
  pointer-events: none;
}

.auth-layout {
  width: 100%;
  max-width: 440px;
  min-height: 100vh;
  min-height: 100dvh;
  margin: 0 auto;
  padding: 32px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  box-sizing: border-box;
}

.brand {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  margin-bottom: 2px;
}

.brand-logo {
  display: block;
  width: 185px;
  max-width: 75vw;
  height: auto;
  object-fit: contain;
}

.glass-card {
  width: 100%;
  max-width: 380px;
  min-width: 0;
  flex: 0 0 auto;
  padding: 22px 26px 30px;
  border: 1px solid var(--tx-line);
  border-radius: 28px;
  background: rgba(2, 4, 8, 0.28);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.37), inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.auth-tabs {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  height: 36px;
  margin-bottom: 24px;
}

.auth-tab {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 0;
  padding: 0 0 3px;
  border: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.96);
  font: 600 13px/1 "Aileron", sans-serif;
  letter-spacing: -0.15px;
  cursor: pointer;
}

.auth-tab:not(.active) {
  color: rgba(255, 255, 255, 0.65);
}

.tab-indicator {
  position: absolute;
  bottom: -1px;
  left: 50%;
  width: 80%;
  height: 3px;
  border-radius: 3px;
  background: var(--tx-cyan);
  transform: translateX(-50%);
}

.tab-divider {
  position: absolute;
  top: 2px;
  left: 50%;
  height: 30px;
  width: 1px;
  background: rgba(235, 240, 250, 0.3);
  transform: translateX(-50%);
}

.message {
  margin: 0 0 16px;
  padding: 10px 14px;
  border-radius: 14px;
  font-size: 11px;
  line-height: 1.45;
  display: flex;
  align-items: flex-start;
  gap: 9px;
  overflow-wrap: anywhere;
  box-sizing: border-box;
  backdrop-filter: blur(6px);
}

.message-icon {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  margin-top: 1px;
}

.message-error {
  color: #ffc4c4;
  border: 1px solid rgba(244, 63, 94, 0.45);
  background: rgba(40, 10, 18, 0.65);
  box-shadow: 0 0 15px rgba(244, 63, 94, 0.15);
}

.message-error .message-icon {
  stroke: #f43f5e;
}

.message-success {
  color: #e6faff;
  border: 1px solid rgba(0, 217, 255, 0.5);
  background: rgba(0, 35, 50, 0.7);
  box-shadow: 0 0 20px rgba(0, 217, 255, 0.2);
}

.message-success .message-icon {
  stroke: #00d9ff;
}

.login-heading {
  margin-bottom: 20px;
}

.login-heading h1,
.signup-heading h1 {
  margin: 0;
  color: #fff;
  font-weight: 700;
}

.login-heading h1 {
  font-size: 28px;
  line-height: 1.1;
  letter-spacing: -0.8px;
}

.login-heading p,
.signup-heading p {
  margin: 4px 0 0;
  color: var(--tx-cyan);
  font-weight: 400;
}

.login-heading p {
  font-size: 12.5px;
  line-height: 1.35;
  padding-left: 2px;
}

.auth-form {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.field {
  min-width: 0;
}

.field label,
.role-field legend {
  display: block;
  padding: 0;
  margin: 0 0 5px;
  color: rgba(222, 226, 235, 0.82);
  font: 600 8px/1.3 "Aileron", sans-serif;
  letter-spacing: 1.05px;
  text-transform: uppercase;
}

.input-line {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  min-width: 0;
  min-height: 24px;
  padding: 0 0 7px;
  border-bottom: 1px solid var(--tx-input-line);
}

.field-icon {
  display: block;
  flex: 0 0 13px;
  width: 13px;
  height: 13px;
  fill: none;
  stroke: var(--tx-cyan);
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.field-icon.filled-icon {
  fill: var(--tx-cyan);
  stroke: var(--tx-cyan);
}

.input-line input {
  display: block;
  width: 100%;
  min-width: 0;
  padding: 0;
  border: 0;
  outline: 0;
  color: #f8fbff;
  background: transparent;
  font: 400 11px/1.4 "Aileron", sans-serif;
  letter-spacing: 0;
}

.input-line input::placeholder {
  color: rgba(145, 149, 160, 0.78);
  opacity: 1;
}

.input-line:focus-within {
  border-bottom-color: var(--tx-cyan);
}

.visibility-button {
  display: inline-flex;
  flex: 0 0 18px;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  color: rgba(165, 169, 180, 0.85);
  background: transparent;
  cursor: pointer;
}

.visibility-button svg {
  display: block;
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.field-login-email {
  margin-bottom: 14px;
}

.field-login-password {
  margin-bottom: 0;
}

.forgot-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 6px;
  margin-bottom: 18px;
}

.forgot-link {
  padding: 0;
  border: 0;
  background: transparent;
  color: rgba(209, 212, 221, 0.83);
  font: 600 8.5px/1.3 "Aileron", sans-serif;
  letter-spacing: 0.85px;
  cursor: pointer;
  transition: color 150ms ease;
}

.forgot-link:hover {
  color: var(--tx-cyan);
}

.primary-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 174px;
  max-width: 100%;
  height: 40px;
  margin-right: auto;
  margin-left: auto;
  border: 0;
  border-radius: 999px;
  color: #050609;
  background: linear-gradient(180deg, #f7fcff 0%, #c6f0ff 52%, #63daf7 100%);
  box-shadow: 0 2px 8px rgba(0, 217, 255, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.9);
  font: 700 12px/1 "Aileron", sans-serif;
  cursor: pointer;
  transition: filter 150ms ease, transform 150ms ease;
}

.primary-button:hover:not(:disabled) {
  filter: brightness(1.05);
}

.primary-button:active:not(:disabled) {
  transform: scale(0.98);
}

.primary-button:disabled {
  opacity: 0.6;
  cursor: wait;
}

.login-button {
  margin-bottom: 16px;
}

.or-divider {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  width: 100%;
  margin-bottom: 16px;
}

.or-divider span {
  display: block;
  width: 70px;
  max-width: calc((100% - 40px) / 2);
  height: 1px;
  background: rgba(225, 230, 240, 0.35);
}

.or-divider small {
  color: rgba(205, 209, 220, 0.8);
  font: 600 7px/1 "Aileron", sans-serif;
  letter-spacing: 1.1px;
}

.google-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  width: 100%;
  height: 40px;
  margin: 0 0 12px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 999px;
  color: rgba(213, 216, 225, 0.85);
  background: rgba(95, 105, 120, 0.15);
  font: 600 9px/1 "Aileron", sans-serif;
  letter-spacing: 0.85px;
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease;
}

.google-button:hover:not(:disabled) {
  background: rgba(95, 105, 120, 0.28);
  border-color: rgba(0, 217, 255, 0.5);
}

.google-icon {
  display: block;
  width: 18px;
  height: 18px;
  flex: 0 0 18px;
}

.switch-prompt {
  margin: 0;
  color: rgba(194, 198, 208, 0.82);
  text-align: center;
  font: 400 8.5px/1.5 "Aileron", sans-serif;
  letter-spacing: 0.45px;
}

.switch-prompt button {
  padding: 0;
  border: 0;
  color: var(--tx-cyan);
  background: transparent;
  font: 700 8.5px/1.5 "Aileron", sans-serif;
  letter-spacing: 0.25px;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.signup-card {
  padding-top: 18px;
  padding-bottom: 26px;
}

.signup-card .auth-tabs {
  margin-bottom: 20px;
}

.signup-heading {
  margin-bottom: 14px;
}

.signup-heading h1 {
  font-size: 22px;
  line-height: 1.15;
  letter-spacing: -0.6px;
  white-space: nowrap;
}

.signup-heading p {
  max-width: 255px;
  margin-top: 4px;
  font-size: 11px;
  line-height: 1.35;
  padding-left: 2px;
}

.role-field {
  min-width: 0;
  padding: 0;
  margin: 0 0 10px;
  border: 0;
}

.role-field legend {
  margin-bottom: 6px;
}

.role-options {
  display: grid;
  grid-template-columns: 0.85fr 1.15fr 1.25fr;
  gap: 7px;
  width: 100%;
}

.role-options button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  height: 28px;
  padding: 0 5px;
  border: 1px solid var(--role-border);
  border-radius: 999px;
  color: var(--role-text);
  background: var(--role-background);
  font: 400 9px/1 "Aileron", sans-serif;
  white-space: nowrap;
  cursor: pointer;
  box-shadow: none;
  transition: all 180ms ease;
}

.role-options button.selected {
  color: #ffffff;
  border-color: var(--tx-cyan);
  background: rgba(0, 217, 255, 0.12);
  box-shadow: 0 0 5px rgba(0, 217, 255, 0.36), 0 0 12px rgba(0, 217, 255, 0.18);
}

.name-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
  margin-bottom: 10px;
}

.name-row .input-line {
  gap: 6px;
  padding-bottom: 5px;
}

.name-row .field-icon {
  flex-basis: 12px;
  width: 12px;
  height: 12px;
}

.name-row .input-line input {
  font-size: 10px;
}

.signup-email,
.signup-password {
  margin-bottom: 10px;
}

.signup-confirm {
  margin-bottom: 14px;
}

.register-button {
  margin-bottom: 14px;
}

.signup-switch {
  font-size: 8.5px;
}

.auth-footer {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 4px;
  width: 100%;
  color: rgba(225, 228, 237, 0.74);
  font: 400 9px/1.4 "Aileron", sans-serif;
  letter-spacing: 0.25px;
}

.auth-footer span:last-child {
  color: var(--tx-cyan);
}

@media (max-width: 480px) {
  .auth-layout {
    padding: 24px 16px;
    gap: 10px;
  }
  .brand-logo {
    width: 160px;
  }
  .glass-card {
    padding: 18px 20px 24px;
    border-radius: 24px;
  }
  .signup-card h1 {
    font-size: 20px;
  }
}
</style>