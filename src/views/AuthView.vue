<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const activeTab = ref<'login' | 'signup'>('login');
const selectedRole = ref<'intern' | 'supervisor' | 'coordinator'>('intern');

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

const switchTab = (tab: 'login' | 'signup') => {
  activeTab.value = tab;
  errorMessage.value = '';
  successMessage.value = '';
};

const routeByRole = (role?: string | null) => {
  if (role === 'supervisor') router.push('/supervisor');
  else if (role === 'coordinator') router.push('/coordinator');
  else router.push('/intern');
};

const handleLogin = async () => {
  errorMessage.value = '';
  successMessage.value = '';

  if (!email.value.trim() || !password.value) {
    errorMessage.value = 'Please provide both email and password.';
    return;
  }

  loading.value = true;
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.value.trim(),
      password: password.value,
    });

    if (error) throw error;

    await authStore.fetchProfile();
    routeByRole(authStore.user?.role);
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

    const { data, error } = await supabase.auth.signUp({
      email: email.value.trim(),
      password: password.value,
      options: {
        data: {
          full_name: fullName,
          role: selectedRole.value,
        },
      },
    });

    if (error) throw error;

    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: data.user.id,
        email: email.value.trim(),
        full_name: fullName,
        role: selectedRole.value,
      });

      if (profileError) throw profileError;
    }

    await authStore.fetchProfile();

    if (authStore.user) {
      routeByRole(authStore.user.role);
    } else {
      successMessage.value = 'Account registered! Please check your email to verify.';
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
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth`,
      },
    });
    if (error) throw error;
  } catch (err: any) {
    errorMessage.value = err.message || 'Google sign in failed.';
  }
};
</script>

<template>
  <main class="auth-page">
    <!-- Keep your provided assets at these paths, or update these two URLs. -->
    <div class="auth-background" aria-hidden="true"></div>
    <div class="auth-overlay" aria-hidden="true"></div>

    <div class="auth-layout">
      <div class="brand">
        <img src="/assets/trainext-logo.png" alt="Trainext" class="brand-logo" />
      </div>

      <section class="glass-card" :class="{ 'signup-card': activeTab === 'signup' }">
        <nav class="auth-tabs" aria-label="Authentication">
          <button
            type="button"
            class="auth-tab"
            :class="{ active: activeTab === 'login' }"
            :aria-current="activeTab === 'login' ? 'page' : undefined"
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
            :aria-current="activeTab === 'signup' ? 'page' : undefined"
            @click="switchTab('signup')"
          >
            SIGNUP
            <span v-if="activeTab === 'signup'" class="tab-indicator"></span>
          </button>
        </nav>

        <div v-if="errorMessage" class="message message-error" role="alert">
          {{ errorMessage }}
        </div>
        <div v-if="successMessage" class="message message-success" role="status">
          {{ successMessage }}
        </div>

        <!-- LOGIN -->
        <div v-if="activeTab === 'login'" class="login-content">
          <header class="login-heading">
            <h1>Welcome,</h1>
            <p>Sign in to continue</p>
          </header>

          <form class="auth-form login-form" @submit.prevent="handleLogin">
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
                    <path d="M2.5 12s3.4-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.4 6.5-9.5 6.5S2.5 12 2.5 12Z" />
                    <circle cx="12" cy="12" r="2.8" />
                  </svg>
                  <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m3 3 18 18M10.6 5.7A10.7 10.7 0 0 1 12 5.5c6.1 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.2 3.9M6.2 6.7C3.8 8.4 2.5 12 2.5 12s3.4 6.5 9.5 6.5a10 10 0 0 0 3-.5" />
                  </svg>
                </button>
              </div>
            </div>

            <div class="forgot-row">
              <router-link to="/reset-password">FORGOT PASSWORD?</router-link>
            </div>

            <button type="submit" class="primary-button login-button" :disabled="loading">
              {{ loading ? 'WAIT...' : 'LOGIN' }}
            </button>

            <div class="or-divider" aria-label="or">
              <span></span><small>OR</small><span></span>
            </div>

            <button type="button" class="google-button" @click="handleGoogleAuth">
              <span>CONTINUE WITH</span>
              <svg class="google-icon" viewBox="0 0 48 48" aria-label="Google">
                <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15Z"/>
                <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44Z"/>
                <path fill="#FBBC05" d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.3H5.8a20 20 0 0 0 0 17.8l6.8-5.3Z"/>
                <path fill="#EA4335" d="M24 11.9c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 5.8 29.5 4 24 4A20 20 0 0 0 5.8 15.1l6.8 5.3c1.6-4.8 6.1-8.5 11.4-8.5Z"/>
              </svg>
            </button>

            <p class="switch-prompt">
              Don't have an account?
              <button type="button" @click="switchTab('signup')">SIGN UP</button>
            </p>
          </form>
        </div>

        <!-- SIGNUP -->
        <div v-else class="signup-content">
          <header class="signup-heading">
            <h1>Create your Account</h1>
            <p>Get started with verified OJT tracking and safety.</p>
          </header>

          <form class="auth-form signup-form" @submit.prevent="handleSignup">
            <fieldset class="role-field">
              <legend>ACCOUNT ROLE</legend>
              <div class="role-options">
                <button
                  type="button"
                  :class="{ selected: selectedRole === 'intern', intern: true }"
                  :aria-pressed="selectedRole === 'intern'"
                  @click="selectedRole = 'intern'"
                >Intern</button>
                <button
                  type="button"
                  :class="{ selected: selectedRole === 'supervisor', supervisor: true }"
                  :aria-pressed="selectedRole === 'supervisor'"
                  @click="selectedRole = 'supervisor'"
                >Supervisor</button>
                <button
                  type="button"
                  :class="{ selected: selectedRole === 'coordinator', coordinator: true }"
                  :aria-pressed="selectedRole === 'coordinator'"
                  @click="selectedRole = 'coordinator'"
                >Coordinator</button>
              </div>
            </fieldset>

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
                    <path d="M2.5 12s3.4-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.4 6.5-9.5 6.5S2.5 12 2.5 12Z" />
                    <circle cx="12" cy="12" r="2.8" />
                  </svg>
                  <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m3 3 18 18M10.6 5.7A10.7 10.7 0 0 1 12 5.5c6.1 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.2 3.9M6.2 6.7C3.8 8.4 2.5 12 2.5 12s3.4 6.5 9.5 6.5a10 10 0 0 0 3-.5" />
                  </svg>
                </button>
              </div>
            </div>

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
                    <path d="M2.5 12s3.4-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.4 6.5-9.5 6.5S2.5 12 2.5 12Z" />
                    <circle cx="12" cy="12" r="2.8" />
                  </svg>
                  <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m3 3 18 18M10.6 5.7A10.7 10.7 0 0 1 12 5.5c6.1 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.2 3.9M6.2 6.7C3.8 8.4 2.5 12 2.5 12s3.4 6.5 9.5 6.5a10 10 0 0 0 3-.5" />
                  </svg>
                </button>
              </div>
            </div>

            <button type="submit" class="primary-button register-button" :disabled="loading">
              {{ loading ? 'WAIT...' : 'REGISTER' }}
            </button>

            <p class="switch-prompt signup-switch">
              Already have an account?
              <button type="button" @click="switchTab('login')">SIGN IN</button>
            </p>
          </form>
        </div>
      </section>

      <footer class="auth-footer">
        <span>Smart Tracking.</span>
        <span>Real-Time Safety.</span>
      </footer>
    </div>
  </main>
</template>

<style>
/*
  Aileron: add the font files to public/fonts.
*/
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

  /* Consistent, neutral role colors */
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
  min-height: 100svh;
  width: 100%;
  overflow-x: clip;
  overflow-y: visible;
  background: #050609;
  color: var(--tx-white);
  font-family: "Aileron", sans-serif;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
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

/* ========================================
   MAIN LAYOUT
======================================== */

.auth-layout {
  width: 100%;
  max-width: 560px;
  min-height: 100vh;
  min-height: 100svh;
  height: auto;
  margin: 0 auto;
  padding: 24px 24px 30px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
}

.brand {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 100%;
  margin-bottom: 2px;
}

.brand-logo {
  display: block;
  width: 250px;
  max-width: 100%;
  height: auto;
  object-fit: contain;
}


/* ========================================
   GLASS CARD
======================================== */

.glass-card {
  width: 100%;
  max-width: 390px;
  min-width: 0;
  flex: 0 0 auto;
  padding: 18px 32px 36px;
  border: 1px solid var(--tx-line);
  border-radius: 29px;
  background: rgba(2, 4, 8, 0.19);
  -webkit-backdrop-filter: blur(4px);
  backdrop-filter: blur(4px);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.025);
}

/* ========================================
   LOGIN / SIGNUP TABS
======================================== */

.auth-tabs {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  height: 38px;
  margin-bottom: 31px;
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
  font: 600 14px/1 "Aileron", sans-serif;
  letter-spacing: -0.15px;
  cursor: pointer;
}

.auth-tab:not(.active) {
  color: rgba(255, 255, 255, 0.88);
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
  top: 1px;
  left: 50%;
  height: 33px;
  width: 1px;
  background: rgba(235, 240, 250, 0.7);
  transform: translateX(-50%);
}

/* ========================================
   STATUS MESSAGES
======================================== */

.message {
  margin: 0 0 14px;
  padding: 9px 10px;
  border-radius: 8px;
  font-size: 11px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.message-error {
  color: #ffd5d5;
  border: 1px solid rgba(248, 113, 113, 0.4);
  background: rgba(70, 10, 20, 0.55);
}

.message-success {
  color: #c6ffdf;
  border: 1px solid rgba(52, 211, 153, 0.35);
  background: rgba(5, 55, 39, 0.5);
}

/* ========================================
   HEADINGS
======================================== */

.login-heading {
  margin-bottom: 25px;
}

.login-heading h1,
.signup-heading h1 {
  margin: 0;
  color: #fff;
  font-weight: 700;
}

.login-heading h1 {
  font-size: 32px;
  line-height: 1.05;
  letter-spacing: -1.15px;
}

.login-heading p,
.signup-heading p {
  margin: 3px 0 0;
  color: var(--tx-cyan);
  font-weight: 400;
}

.login-heading p {
  font-size: 13px;
  line-height: 1.35;
  padding-left: 7px;
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

/* ========================================
   INPUT FIELDS
======================================== */

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
  font: 400 10.5px/1.4 "Aileron", sans-serif;
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
  margin-top: 5px;
  margin-bottom: 19px;
}

.forgot-row a {
  color: rgba(209, 212, 221, 0.83);
  font: 600 8px/1.3 "Aileron", sans-serif;
  letter-spacing: 0.85px;
  text-decoration: none;
}

.forgot-row a:hover {
  color: var(--tx-cyan);
}

/* ========================================
   BUTTONS
======================================== */

.primary-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 174px;
  max-width: 100%;
  height: 38px;
  margin-right: auto;
  margin-left: auto;
  border: 0;
  border-radius: 999px;
  color: #050609;
  background: linear-gradient(
    180deg,
    #f7fcff 0%,
    #c6f0ff 52%,
    #63daf7 100%
  );
  box-shadow:
    0 1px 2px rgba(255, 255, 255, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  font: 700 12px/1 "Aileron", sans-serif;
  cursor: pointer;
  transition: filter 150ms ease, transform 150ms ease;
}

.primary-button:hover:not(:disabled) {
  filter: brightness(1.04);
}

.primary-button:active:not(:disabled) {
  transform: scale(0.985);
}

.primary-button:disabled {
  opacity: 0.65;
  cursor: wait;
}

.login-button {
  margin-bottom: 19px;
}

.or-divider {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  width: 100%;
  margin-bottom: 19px;
}

.or-divider span {
  display: block;
  width: 79px;
  max-width: calc((100% - 45px) / 2);
  height: 1px;
  background: rgba(225, 230, 240, 0.72);
}

.or-divider small {
  color: rgba(205, 209, 220, 0.8);
  font: 600 6.5px/1 "Aileron", sans-serif;
  letter-spacing: 1.1px;
}

.google-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  height: 42px;
  margin: 0 0 13px;
  border: 1px solid transparent;
  border-radius: 999px;
  color: rgba(213, 216, 225, 0.76);
  background: rgba(95, 105, 120, 0.15);
  font: 600 8px/1 "Aileron", sans-serif;
  letter-spacing: 0.85px;
  cursor: pointer;
  transition: background 150ms ease;
}

.google-button:hover {
  background: rgba(95, 105, 120, 0.24);
}

.google-icon {
  display: block;
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
}

/* ========================================
   SWITCH PROMPTS
======================================== */

.switch-prompt {
  margin: 0;
  color: rgba(194, 198, 208, 0.82);
  text-align: center;
  font: 400 8px/1.5 "Aileron", sans-serif;
  letter-spacing: 0.45px;
}

.switch-prompt button {
  padding: 0;
  border: 0;
  color: var(--tx-cyan);
  background: transparent;
  font: 700 8px/1.5 "Aileron", sans-serif;
  letter-spacing: 0.25px;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

/* ========================================
   SIGNUP CARD
======================================== */

.signup-card {
  padding-top: 19px;
  padding-bottom: 34px;
}

.signup-card .auth-tabs {
  margin-bottom: 30px;
}

.signup-heading {
  margin-bottom: 18px;
}

.signup-heading h1 {
  font-size: 24px;
  line-height: 1.15;
  letter-spacing: -0.7px;
  white-space: nowrap;
}

.signup-heading p {
  max-width: 255px;
  margin-top: 5px;
  font-size: 11.5px;
  line-height: 1.35;
  padding-left: 2px;
}

/* ========================================
   ACCOUNT ROLE SELECTOR
   Default: all roles are neutral gray.
   Selected: cyan border + subtle cyan glow.
======================================== */

.role-field {
  min-width: 0;
  padding: 0;
  margin: 0 0 11px;
  border: 0;
}

.role-field legend {
  margin-bottom: 7px;
}

.role-options {
  display: grid;
  grid-template-columns: 0.85fr 1.15fr 1.25fr;
  gap: 8px;
  width: 100%;
}

.role-options button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  height: 30px;
  padding: 0 5px;

  /* Same unselected appearance for every role */
  border: 1px solid var(--role-border);
  border-radius: 999px;
  color: var(--role-text);
  background: var(--role-background);

  font: 400 9px/1 "Aileron", sans-serif;
  white-space: nowrap;
  cursor: pointer;
  box-shadow: none;

  transition:
    color 180ms ease,
    border-color 180ms ease,
    background 180ms ease,
    box-shadow 180ms ease,
    transform 180ms ease;
}

/* Remove role-specific colors when unselected */
.role-options .intern,
.role-options .supervisor,
.role-options .coordinator {
  color: var(--role-text);
  border-color: var(--role-border);
  background: var(--role-background);
  box-shadow: none;
}

/* Only the selected role gets the cyan effect */
.role-options button.selected,
.role-options button[aria-pressed="true"],
.role-options button[aria-checked="true"] {
  color: #ffffff;
  border-color: var(--tx-cyan);
  background: rgba(0, 217, 255, 0.12);

  box-shadow:
    0 0 5px rgba(0, 217, 255, 0.36),
    0 0 12px rgba(0, 217, 255, 0.18),
    inset 0 0 7px rgba(0, 217, 255, 0.10);
}

.role-options button:active {
  transform: scale(0.97);
}

.role-options button:focus-visible {
  outline: 2px solid rgba(0, 217, 255, 0.85);
  outline-offset: 3px;
}

/* ========================================
   SIGNUP INPUTS
======================================== */

.name-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 22px;
  margin-bottom: 12px;
}

.name-row .input-line {
  gap: 6px;
  padding-bottom: 6px;
}

.name-row .field-icon {
  flex-basis: 12px;
  width: 12px;
  height: 12px;
}

.name-row .input-line input {
  font-size: 9.5px;
}

.signup-email {
  margin-bottom: 12px;
}

.signup-password {
  margin-bottom: 12px;
}

.signup-confirm {
  margin-bottom: 17px;
}

.signup-card .input-line {
  min-height: 23px;
}

.signup-card .input-line input {
  font-size: 10px;
}

.register-button {
  margin-bottom: 17px;
}

.signup-switch {
  font-size: 8px;
}

/* ========================================
   FOOTER
======================================== */

.auth-footer {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 3px;
  width: 100%;
  margin-top: 20px;
  color: rgba(225, 228, 237, 0.74);
  font: 400 8.5px/1.4 "Aileron", sans-serif;
  letter-spacing: 0.25px;
}

.auth-footer span:last-child {
  color: var(--tx-cyan);
}

/* ========================================
   DESKTOP / WEB
======================================== */

@media (min-width: 600px) {
  .auth-layout {
    justify-content: center;
    padding-top: 20px;
    padding-bottom: 24px;
  }

  .brand {
    margin-bottom: 0.5px;
  }

  .brand-logo {
    width: 290px;
  }

  .glass-card {
    max-width: 390px;
  }

  .auth-footer {
    margin-top: 20px;
  }
}

/* ========================================
   MOBILE
======================================== */

@media (max-width: 599px) {
  .auth-layout {
    justify-content: flex-start;
    padding: 24px 22px 28px;
  }

  .brand {
    margin-bottom: 0.5px;
  }

  .brand-logo {
    width: 175px;
  }

  .glass-card {
    max-width: 390px;
    padding-right: 25px;
    padding-left: 25px;
  }

  .signup-card {
    padding-top: 18px;
    padding-bottom: 30px;
  }

  .signup-card .auth-tabs {
    margin-bottom: 27px;
  }

  .signup-heading h1 {
    font-size: 22px;
  }

  .name-row {
    gap: 15px;
  }

  .auth-footer {
    margin-top: 16px;
  }
}

/* Extra-small mobile screens */
@media (max-width: 360px) {
  .auth-layout {
    padding-right: 16px;
    padding-left: 16px;
  }

  .brand {
    margin-bottom: 0.5px;
  }

  .brand-logo {
    width: 155px;
  }

  .glass-card {
    padding-right: 20px;
    padding-left: 20px;
    border-radius: 25px;
  }

  .role-options {
    gap: 5px;
  }

  .role-options button {
    padding-right: 3px;
    padding-left: 3px;
    font-size: 8px;
  }

  .name-row {
    gap: 12px;
  }
}

/* Short screens */
@media (max-height: 760px) {
  .auth-layout {
    padding-top: 18px;
    padding-bottom: 18px;
  }

  .brand {
    margin-bottom: 0.5px;
  }

  .brand-logo {
    width: 190px;
  }

  .glass-card {
    padding-bottom: 26px;
  }

  .signup-card {
    padding-bottom: 26px;
  }

  .auth-footer {
    margin-top: 14px;
  }
}

/* Respect reduced-motion preferences */
@media (prefers-reduced-motion: reduce) {
  .primary-button,
  .google-button,
  .role-options button {
    transition: none;
  }
}


/* ========================================
   SCROLLING FIX — ADD AT THE VERY END
======================================== */

html,
body {
  width: 100%;
  min-height: 100%;
  height: auto !important;
  margin: 0;
  overflow-x: hidden !important;
  overflow-y: auto !important;
}

body {
  position: relative;
}

.auth-page {
  position: relative;
  height: auto !important;
  min-height: 100vh;
  min-height: 100svh;
  overflow: visible !important;
}

.auth-layout {
  height: auto !important;
  min-height: 100vh;
  min-height: 100svh;
  justify-content: flex-start !important;
  padding-bottom: 40px;
}

.glass-card {
  flex-shrink: 0;
}

.auth-footer {
  flex-shrink: 0;
}

</style>
