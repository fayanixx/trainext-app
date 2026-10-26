<template>
  <ion-page>
    <ion-content :fullscreen="true" class="auth-content">
      <!-- Fixed Background Layer: Kitang-kita ang subway lines at platforms sa likod -->
      <div class="fixed inset-0 bg-[#020611] -z-10 overflow-hidden flex items-center justify-center pointer-events-none select-none">
        <img
          src="/assets/bg-placeholder.png"
          alt="Platform Background"
          class="w-full h-full object-cover object-center brightness-[0.75] contrast-[1.12]"
        />
        <!-- Cinematic gradient overlay -->
        <div class="absolute inset-0 bg-gradient-to-b from-[#020611]/50 via-transparent to-[#020611]/85"></div>
      </div>

      <!-- Main Layout Container na may maluwang na vertical padding -->
      <div class="min-h-full w-full relative flex flex-col items-center justify-between py-8 px-4 font-aileron selection:bg-[#00C2FF] selection:text-black box-border">
        
        <!-- Header & Glass Card Container -->
        <div class="w-full flex flex-col items-center max-w-[390px] mx-auto my-auto">
          
        <!-- Logo & Brand Header -->
        <div class="flex flex-col items-center justify-center pt-2 pb-2 select-none -mb-1">
          <div class="relative flex items-center justify-center">
            <div class="absolute w-24 h-24 bg-[#00C2FF]/20 rounded-full blur-2xl pointer-events-none"></div>
            <img
              src="/assets/trainext-logo.png"
              alt="TraiNext Logo"
              class="h-[200px] w-auto object-contain drop-shadow-[0_0_20px_rgba(0,194,255,0.65)] relative z-10"
            />
          </div>
        </div>

          <!-- Pure Glassmorphic Card na may Maluwang na Inner Spacing -->
          <div class="trainext-glass-card w-full">
            
          <!-- Top Segment Tabs: LOGIN / SIGNUP -->
          <div class="tabs-header-container">
            <!-- LOGIN TAB -->
            <div class="tab-item">
              <button
                type="button"
                @click="setMode('login')"
                :class="isLogin ? 'tab-btn-active' : 'tab-btn-inactive'"
                class="tab-btn"
              >
                LOGIN
              </button>
              <div
                class="tab-indicator"
                :class="isLogin ? 'opacity-100 scale-100' : 'opacity-0 scale-75'"
              ></div>
            </div>

            <!-- CENTER DIVIDER -->
            <div class="tab-divider"></div>

            <!-- SIGNUP TAB -->
            <div class="tab-item">
              <button
                type="button"
                @click="setMode('signup')"
                :class="!isLogin ? 'tab-btn-active' : 'tab-btn-inactive'"
                class="tab-btn"
              >
                SIGNUP
              </button>
              <div
                class="tab-indicator"
                :class="!isLogin ? 'opacity-100 scale-100' : 'opacity-0 scale-75'"
              ></div>
            </div>
          </div>

            <!-- OTP Verification Step -->
            <template v-if="otpStep">
              <div class="mb-5 rounded-2xl bg-cyan-950/30 p-4 text-[13px] text-slate-200 border border-[#00C2FF]/30 backdrop-blur-md">
                We sent a verification code to <strong class="text-[#00C2FF]">{{ email.trim() }}</strong>. Enter the 6-digit code below.
              </div>
              <div class="input-line-box mb-3">
                <input
                  v-model="otpCode"
                  inputmode="numeric"
                  maxlength="6"
                  placeholder="000000"
                  class="w-full bg-transparent text-white text-[19px] tracking-[0.35em] text-center placeholder-slate-500 outline-none border-none py-1.5 font-bold"
                />
              </div>

              <p v-if="errorMessage" class="mt-3 text-xs text-rose-400 font-semibold">{{ errorMessage }}</p>
              <p v-if="successMessage" class="mt-3 text-xs text-emerald-400 font-semibold">{{ successMessage }}</p>

              <button
                type="button"
                class="pill-btn btn-gradient-cyan w-full mt-7"
                :disabled="auth.loading || otpCode.trim().length !== 6"
                @click="verifyCode"
              >
                VERIFY EMAIL
              </button>

              <div class="flex flex-col gap-2.5 mt-4">
                <button
                  type="button"
                  class="w-full text-[11px] font-bold tracking-wider text-slate-400 hover:text-[#00C2FF] uppercase transition-colors"
                  :disabled="auth.loading"
                  @click="resendCode"
                >
                  Resend code
                </button>
                <button
                  type="button"
                  class="w-full text-[11px] font-bold tracking-wider text-slate-400 hover:text-[#00C2FF] uppercase transition-colors"
                  @click="cancelOtp"
                >
                  Back to sign in
                </button>
              </div>
            </template>

        <!-- Regular Forms (Login / Signup) -->
                    <template v-else>
                      <!-- ======================== LOGIN VIEW ======================== -->
                      <template v-if="isLogin">
                        <h2 class="login-title">Welcome,</h2>
                        <p class="login-subtitle">Signin to continue</p>

                        <form @submit.prevent="handleSubmit" class="space-y-6">
                          <!-- Email Address -->
                          <div>
                            <label class="field-label">EMAIL ADDRESS</label>
                            <div class="input-line-box">
                              <svg class="text-[#00C2FF] w-[18px] h-[18px] mr-2.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              <input
                                v-model="email"
                                type="email"
                                placeholder="you@example.com"
                                autocomplete="email"
                                inputmode="email"
                                class="w-full bg-transparent text-white text-[13.5px] placeholder-slate-400/60 outline-none border-none py-1 font-regular"
                              />
                            </div>
                          </div>

                          <!-- Password -->
                          <div>
                            <label class="field-label">PASSWORD</label>
                            <div class="input-line-box">
                              <svg class="text-[#00C2FF] w-[18px] h-[18px] mr-2.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                              <input
                                v-model="password"
                                :type="showPassword ? 'text' : 'password'"
                                placeholder="••••••••"
                                autocomplete="current-password"
                                class="w-full bg-transparent text-white text-[13.5px] placeholder-slate-400/60 outline-none border-none py-1 font-regular"
                              />
                              <button
                                type="button"
                                class="text-slate-400 hover:text-white w-4 h-4 ml-1.5 cursor-pointer shrink-0 transition-colors"
                                @click="showPassword = !showPassword"
                              >
                                <svg v-if="!showPassword" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                </svg>
                              </button>
                            </div>

                            <!-- Forgot Password Link -->
                            <button
                              type="button"
                              class="text-[9.5px] font-bold tracking-wider text-slate-400 hover:text-[#00C2FF] uppercase mt-2.5 ml-auto block transition-colors"
                              :disabled="auth.loading"
                              @click="forgotPassword"
                            >
                              FORGOT PASSWORD?
                            </button>
                          </div>

                          <!-- Alert Feedback -->
                          <p v-if="errorMessage" class="text-xs text-rose-400 font-semibold">{{ errorMessage }}</p>
                          <p v-if="successMessage" class="text-xs text-emerald-400 font-semibold">{{ successMessage }}</p>

                          <!-- Login Button -->
                          <button
                            type="submit"
                            class="pill-btn btn-gradient-cyan w-full mt-6"
                            :disabled="auth.loading"
                          >
                            LOGIN
                          </button>
                        </form>

                        <!-- OR Divider -->
                        <div class="flex items-center gap-3.5 my-5">
                          <div class="flex-1 h-[1px] bg-white/20"></div>
                          <span class="text-[9.5px] font-heavy tracking-widest text-slate-400 uppercase">OR</span>
                          <div class="flex-1 h-[1px] bg-white/20"></div>
                        </div>

                        <!-- Google SSO Button -->
                        <button
                          type="button"
                          class="pill-btn sso-btn w-full flex items-center justify-center gap-2.5"
                        >
                          <span class="text-[11px] font-bold tracking-wider text-slate-200 uppercase">CONTINUE WITH</span>
                          <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                          </svg>
                        </button>

                        <!-- Footer Switch -->
                        <p class="text-center text-slate-400 text-[12px] mt-5 font-regular">
                          Don't have an account?
                          <button
                            type="button"
                            class="text-[#00C2FF] font-heavy uppercase underline hover:text-cyan-300 ml-1.5 cursor-pointer transition-colors"
                            @click="setMode('signup')"
                          >
                            SIGN UP
                          </button>
                        </p>
                      </template>

                      <!-- ======================== SIGNUP VIEW ======================== -->
                      <template v-else>
                        <h2 class="signup-title">Create your Account</h2>
                        <p class="signup-subtitle">Get started with verified OJT tracking and safety.</p>

                        <form @submit.prevent="handleSubmit" class="signup-form">
                          <!-- Account Role Selector -->
                          <div class="role-section">
                            <label class="field-label">ACCOUNT ROLE</label>
                            <div class="role-pill-group">
                              <button
                                type="button"
                                @click="selectedRole = 'intern'"
                                class="role-pill"
                                :class="selectedRole === 'intern' ? 'role-pill-active' : ''"
                              >
                                Intern
                              </button>
                              <button
                                type="button"
                                @click="selectedRole = 'supervisor'"
                                class="role-pill"
                                :class="selectedRole === 'supervisor' ? 'role-pill-active' : ''"
                              >
                                Supervisor
                              </button>
                              <button
                                type="button"
                                @click="selectedRole = 'coordinator'"
                                class="role-pill"
                                :class="selectedRole === 'coordinator' ? 'role-pill-active' : ''"
                              >
                                Coordinator
                              </button>
                            </div>
                          </div>

                          <!-- Name Fields (Grid) -->
                          <div class="grid grid-cols-2 gap-4">
                            <div>
                              <label class="field-label">FIRST NAME</label>
                              <div class="input-line-box">
                                <svg class="text-[#00C2FF] w-[18px] h-[18px] mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                <input
                                  v-model="firstName"
                                  type="text"
                                  placeholder="Juan"
                                  autocomplete="given-name"
                                  class="field-input"
                                />
                              </div>
                            </div>

                            <div>
                              <label class="field-label">LAST NAME</label>
                              <div class="input-line-box">
                                <svg class="text-[#00C2FF] w-[18px] h-[18px] mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                <input
                                  v-model="lastName"
                                  type="text"
                                  placeholder="Dela Cruz"
                                  autocomplete="family-name"
                                  class="field-input"
                                />
                              </div>
                            </div>
                          </div>

                          <!-- Email Address -->
                          <div>
                            <label class="field-label">EMAIL ADDRESS</label>
                            <div class="input-line-box">
                              <svg class="text-[#00C2FF] w-[18px] h-[18px] mr-2.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              <input
                                v-model="email"
                                type="email"
                                placeholder="you@example.com"
                                autocomplete="email"
                                inputmode="email"
                                class="field-input"
                              />
                            </div>
                          </div>

                          <!-- Password -->
                          <div>
                            <label class="field-label">PASSWORD</label>
                            <div class="input-line-box">
                              <svg class="text-[#00C2FF] w-[18px] h-[18px] mr-2.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                              <input
                                v-model="password"
                                :type="showPassword ? 'text' : 'password'"
                                placeholder="Minimum of 8 characters"
                                autocomplete="new-password"
                                class="field-input"
                              />
                              <button
                                type="button"
                                class="text-slate-400 hover:text-white w-4 h-4 ml-2 cursor-pointer shrink-0 transition-colors"
                                @click="showPassword = !showPassword"
                              >
                                <svg v-if="!showPassword" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                </svg>
                              </button>
                            </div>
                          </div>

                          <!-- Confirm Password -->
                          <div>
                            <label class="field-label">CONFIRM PASSWORD</label>
                            <div class="input-line-box">
                              <svg class="text-[#00C2FF] w-[18px] h-[18px] mr-2.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                              <input
                                v-model="confirmPassword"
                                :type="showConfirmPassword ? 'text' : 'password'"
                                placeholder="Re-enter your password"
                                autocomplete="new-password"
                                class="field-input"
                              />
                              <button
                                type="button"
                                class="text-slate-400 hover:text-white w-4 h-4 ml-2 cursor-pointer shrink-0 transition-colors"
                                @click="showConfirmPassword = !showConfirmPassword"
                              >
                                <svg v-if="!showConfirmPassword" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                </svg>
                              </button>
                            </div>
                          </div>

                          <!-- Alert Feedback -->
                          <p v-if="errorMessage" class="text-xs text-rose-400 font-semibold">{{ errorMessage }}</p>
                          <p v-if="successMessage" class="text-xs text-emerald-400 font-semibold">{{ successMessage }}</p>

                          <!-- Register Button -->
                          <button
                            type="submit"
                            class="pill-btn btn-gradient-cyan w-full register-btn"
                            :disabled="auth.loading"
                          >
                            REGISTER
                          </button>
                        </form>

                        <!-- Footer Switch -->
                        <p class="signup-footer-text">
                          Already have an account?
                          <button
                            type="button"
                            class="text-[#00C2FF] font-heavy uppercase underline hover:text-cyan-300 ml-1.5 cursor-pointer transition-colors"
                            @click="setMode('login')"
                          >
                            SIGN IN
                          </button>
                        </p>
                      </template>
                    </template>
                  </div>
                </div>

        <!-- Footer Tagline -->
        <p class="text-center text-[11.5px] font-bold text-slate-400 mt-5 mb-1 select-none tracking-wide">
          Smart Tracking. <span class="text-[#00C2FF]">Real-Time Safety.</span>
        </p>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { IonContent, IonPage } from '@ionic/vue'
import { useAuthStore } from '@/stores/auth'
import type { Profile, UserRole } from '@/types'

const auth = useAuthStore()
const router = useRouter()

const mode = ref<'login' | 'signup'>('login')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const firstName = ref('')
const lastName = ref('')
const fullName = ref('')
const selectedRole = ref<UserRole>('intern')
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const otpStep = ref(false)
const otpCode = ref('')
const errorMessage = ref('')
const successMessage = ref('')

const isLogin = computed(() => mode.value === 'login')

function setMode(nextMode: 'login' | 'signup'): void {
  mode.value = nextMode
  errorMessage.value = ''
  successMessage.value = ''
  showPassword.value = false
  showConfirmPassword.value = false
}

function destinationFor(profile: Profile): string {
  if (profile.role === 'supervisor') {
    return '/supervisor'
  }
  if (profile.role === 'coordinator') {
    return '/coordinator'
  }
  return '/intern'
}

function cancelOtp(): void {
  otpStep.value = false
  otpCode.value = ''
  setMode('login')
}

async function handleSubmit(): Promise<void> {
  errorMessage.value = ''
  successMessage.value = ''

  if (!email.value.trim() || !password.value) {
    errorMessage.value = 'Email and password are required.'
    return
  }

  if (!isLogin.value) {
    const computedName = `${firstName.value.trim()} ${lastName.value.trim()}`.trim() || fullName.value.trim()
    if (!computedName) {
      errorMessage.value = 'Enter your first and last name.'
      return
    }
    if (password.value.length < 6) {
      errorMessage.value = 'Password must be at least 6 characters.'
      return
    }
    if (password.value !== confirmPassword.value) {
      errorMessage.value = 'Passwords do not match.'
      return
    }
  }

  try {
    if (isLogin.value) {
      const profile = await auth.signIn(email.value, password.value)
      await router.replace(destinationFor(profile))
      return
    }

    const name = `${firstName.value.trim()} ${lastName.value.trim()}`.trim() || fullName.value.trim()
    const result = await auth.signUp(email.value, password.value, name, selectedRole.value)

    if (result.needsEmailConfirmation) {
      password.value = ''
      confirmPassword.value = ''
      otpStep.value = true
      otpCode.value = ''
      successMessage.value = 'Account created. Enter the 6-digit code from your email to activate it.'
      return
    }

    if (!auth.profile) {
      await auth.fetchProfile()
    }

    if (auth.profile) {
      await router.replace(destinationFor(auth.profile))
    } else {
      errorMessage.value = 'Your account was created but the profile is not ready yet. Sign in again.'
    }
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : isLogin.value ? 'Sign in failed.' : 'Sign up failed.'
  }
}

async function verifyCode(): Promise<void> {
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const profile = await auth.verifyOtp(email.value, otpCode.value)
    if (!profile) {
      throw new Error('Email verified but your profile could not be loaded.')
    }
    await router.replace(destinationFor(profile))
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Unable to verify the email code.'
  }
}

async function resendCode(): Promise<void> {
  errorMessage.value = ''
  successMessage.value = ''

  try {
    await auth.resendOtp(email.value)
    successMessage.value = 'A new 6-digit verification code was sent.'
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Unable to resend the verification code.'
  }
}

async function forgotPassword(): Promise<void> {
  errorMessage.value = ''
  successMessage.value = ''

  if (!email.value.trim()) {
    errorMessage.value = 'Enter your email address first.'
    return
  }

  try {
    await auth.requestPasswordReset(email.value)
    successMessage.value = 'Password reset link sent. Check your inbox and follow the link.'
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Unable to send the password reset link.'
  }
}
</script>

<style scoped>
/* Eksaktong Aileron Font Classes */
.font-aileron {
  font-family: 'Aileron', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
}

.font-regular {
  font-family: 'Aileron', sans-serif !important;
  font-weight: 400 !important;
}

.font-semibold {
  font-family: 'Aileron SemiBold', 'Aileron', sans-serif !important;
  font-weight: 600 !important;
}

.font-bold {
  font-family: 'Aileron Bold', 'Aileron', sans-serif !important;
  font-weight: 700 !important;
}

.font-heavy {
  font-family: 'Aileron Heavy', 'Aileron Black', 'Aileron Bold', 'Aileron', sans-serif !important;
  font-weight: 900 !important;
}

/* Tinatanggal ang background ng Ionic para transparent ang canvas */
ion-content.auth-content {
  --background: transparent !important;
}
ion-content.auth-content::part(background) {
  background: transparent !important;
}
ion-content.auth-content::part(scroll) {
  background: transparent !important;
}

/* Welcome Title - Eksaktong laki at kapal tulad ng sa mockup */
.login-title {
  font-family: 'Aileron Heavy', 'Aileron Black', 'Aileron Bold', 'Aileron', sans-serif !important;
  font-size: 38px !important;
  line-height: 1.05 !important;
  font-weight: 900 !important;
  color: #ffffff !important;
  letter-spacing: -0.025em !important;
  margin-top: 0 !important;
  margin-bottom: 6px !important;
  text-align: left !important;
  display: block !important;
}

/* Signin to continue Subtitle */
.login-subtitle {
  font-family: 'Aileron Bold', 'Aileron', sans-serif !important;
  font-size: 14.5px !important;
  line-height: 1.2 !important;
  font-weight: 700 !important;
  color: #00C2FF !important;
  letter-spacing: 0.01em !important;
  margin-top: 0 !important;
  margin-bottom: 26px !important;
  text-align: left !important;
  display: block !important;
}
/* Crisp & Transparent Glassmorphic Card */
.trainext-glass-card {
  border-radius: 36px !important;
  /* Manipis at malinaw na glass edge */
  border: 1px solid rgba(255, 255, 255, 0.25) !important;
  
  /* Banayad na gradient tint para lumutang ang reflection ng salamin */
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.08) 0%,
    rgba(4, 9, 22, 0.35) 40%,
    rgba(2, 6, 17, 0.45) 100%
  ) !important;

  /* Mababang blur para kitang-kita ang platform at mga linya ng tren sa likod */
  backdrop-filter: blur(8px) saturate(140%) !important;
  -webkit-backdrop-filter: blur(8px) saturate(140%) !important;

  /* Specular reflections: May ilaw sa ibabaw na gilid at banayad na ambient shadow */
  box-shadow: 
    0 20px 50px rgba(0, 0, 0, 0.75),
    inset 0 1px 1px rgba(255, 255, 255, 0.35),
    inset 0 -1px 1px rgba(255, 255, 255, 0.1) !important;

  padding: 28px 28px 30px !important;
  box-sizing: border-box !important;
}

/* Container ng tabs na may maluwag na agwat pababa sa title */
.tabs-header-container {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 36px !important; /* Nilakihan ang pagitan ng LOGIN at SIGNUP */
  margin-bottom: 32px !important; /* Nilakihan ang layo papunta sa "Welcome," */
  position: relative !important;
}

/* Tab item wrapper */
.tab-item {
  position: relative !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  padding-bottom: 12px !important; /* Ito ang nagbibigay ng tamang puwang bago ang cyan bar */
}

/* Button font at typography */
.tab-btn {
  font-family: 'Aileron Heavy', 'Aileron Black', 'Aileron Bold', 'Aileron', sans-serif !important;
  font-size: 16px !important;
  font-weight: 900 !important;
  letter-spacing: 0.16em !important;
  text-transform: uppercase !important;
  background: transparent !important;
  border: none !important;
  outline: none !important;
  cursor: pointer !important;
  padding: 0 !important;
  transition: color 0.2s ease !important;
}

.tab-btn-active {
  color: #ffffff !important;
}

.tab-btn-inactive {
  color: rgba(148, 163, 184, 0.7) !important;
}

.tab-btn-inactive:hover {
  color: #ffffff !important;
}

/* Manipis na vertical divider line sa gitna */
.tab-divider {
  width: 1.5px !important;
  height: 24px !important;
  background-color: rgba(255, 255, 255, 0.25) !important;
  margin-bottom: 10px !important;
}

/* Glowing Cyan Bar Indicator (May sapat na gap sa text at may buong glow) */
.tab-indicator {
  position: absolute !important;
  bottom: 0 !important; /* Nakapwesto sa mismong ilalim ng 12px padding */
  left: -8px !important; /* Bahagyang lumalampas sa gilid ng text tulad sa photo */
  right: -8px !important;
  height: 3px !important;
  background-color: #00C2FF !important;
  border-radius: 9999px !important;
  box-shadow: 0 0 12px #00C2FF, 0 0 4px #00C2FF !important;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
  pointer-events: none !important;
}

/* Bottom Border Field Line na may komportableng patak ng padding */
.input-line-box {
  position: relative;
  display: flex;
  align-items: center;
  border-bottom: 1.25px solid rgba(255, 255, 255, 0.35);
  padding-bottom: 6px;
  padding-top: 4px;
  transition: border-color 0.2s ease;
}

.input-line-box:focus-within {
  border-bottom-color: #00C2FF;
}

/* Field Labels */
.field-label {
  font-size: 13px;
  font-family: 'Aileron', sans-serif !important;
  font-weight: 500 !important;
  letter-spacing: 0.15em;
  color: #e2e8f0;
  text-transform: uppercase;
  display: block;
  margin-bottom: 6px;
}

/* Pill Action Buttons */
.pill-btn {
  border-radius: 9999px !important;
  padding: 13.5px 20px !important;
  font-family: 'Aileron Heavy', 'Aileron Bold', 'Aileron', sans-serif !important;
  font-weight: 900 !important;
  font-size: 14px !important;
  letter-spacing: 0.08em !important;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Gradient Action Button (Cyan to Sky Blue) */
.btn-gradient-cyan {
  background: linear-gradient(135deg, #a5f3fc 0%, #67e8f9 45%, #38bdf8 100%) !important;
  color: #000000 !important;
  box-shadow: 0 0 22px rgba(0, 194, 255, 0.45) !important;
  border: none !important;
  transition: all 0.2s ease;
}

.btn-gradient-cyan:hover:not(:disabled) {
  filter: brightness(1);
  box-shadow: 0 0 28px rgba(0, 194, 255, 0.65) !important;
}

.btn-gradient-cyan:active:not(:disabled) {
  transform: scale(0.98);
}

.sso-btn {
  background: rgba(8, 14, 28, 0.55) !important;
  border: 1px solid rgba(255, 255, 255, 0.18) !important;
  backdrop-filter: blur(10px) !important;
  transition: background 0.2s ease;
}

.sso-btn:hover {
  background: rgba(15, 24, 46, 0.75) !important;
}

/* Role Selector Pills */
.role-pill {
  flex: 1;
  padding: 6.5px 6px;
  border-radius: 9999px !important;
  font-size: 11.5px;
  font-family: 'Aileron Bold', 'Aileron', sans-serif !important;
  font-weight: 700 !important;
  text-transform: uppercase;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(255, 255, 255, 0.04);
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
}

.role-pill:hover {
  border-color: rgba(255, 255, 255, 0.45);
  color: #ffffff;
}

.role-pill-active {
  border-color: #00C2FF !important;
  background: rgba(0, 194, 255, 0.16) !important;
  color: #00C2FF !important;
  box-shadow: 0 0 10px rgba(0, 194, 255, 0.25) !important;
}

/* Signup Title & Subtitle Spacing */
.signup-title {
  font-family: 'Aileron Heavy', 'Aileron Black', 'Aileron Bold', 'Aileron', sans-serif !important;
  font-size: 33px !important;
  line-height: 1.1 !important;
  font-weight: 900 !important;
  color: #ffffff !important;
  letter-spacing: -0.02em !important;
  margin-top: 0 !important;
  margin-bottom: 6px !important;
  text-align: left !important;
  display: block !important;
}

.signup-subtitle {
  font-family: 'Aileron Bold', 'Aileron', sans-serif !important;
  font-size: 14px !important;
  line-height: 1.25 !important;
  font-weight: 600 !important;
  color: #00C2FF !important;
  margin-top: 0 !important;
  margin-bottom: 24px !important;
  text-align: left !important;
  display: block !important;
}

/* Form Spacing */
.signup-form {
  display: flex !important;
  flex-direction: column !important;
  gap: 20px !important; /* Maluwang at pare-parehong agwat sa pagitan ng bawat field */
}

/* Account Role Section */
.role-section {
  display: flex !important;
  flex-direction: column !important;
  margin-top: 4px !important;
  margin-bottom: 8px !important; /* Dagdag space bago ang First Name/Last Name grid */
}

.role-pill-group {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 12px !important; /* Balanseng pagitan para hindi mag-overflow ang pills */
  margin-top: 10px !important; /* Mas maaliwalas na layo mula sa label */
}

/* Role Pills - Maluwag na height at padding */
.role-pill {
  flex: 1 1 0 !important;
  min-width: 0 !important;
  padding: 8px 10px !important; /* Mas mataas at mas maluwag na click area */
  border-radius: 9999px !important;
  font-family: 'Aileron Bold', 'Aileron', sans-serif !important;
  font-size: 11.5px !important;
  font-weight: 700 !important;
  text-transform: capitalize !important;
  letter-spacing: 0.02em !important;
  border: 1px solid rgba(255, 255, 255, 0.24) !important;
  background: rgba(255, 255, 255, 0.03) !important;
  color: #94a3b8 !important;
  cursor: pointer !important;
  transition: all 0.2s ease !important;
  text-align: center !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}

.role-pill:hover {
  border-color: rgba(255, 255, 255, 0.45) !important;
  color: #ffffff !important;
}

.role-pill-active {
  border-color: #00C2FF !important;
  background: rgba(0, 194, 255, 0.15) !important;
  color: #00C2FF !important;
  box-shadow: 0 0 12px rgba(0, 194, 255, 0.28) !important;
}

/* Input Fields */
.field-input {
  width: 100% !important;
  background: transparent !important;
  color: #ffffff !important;
  font-size: 13.5px !important;
  outline: none !important;
  border: none !important;
  padding: 6px 0 !important; /* Tamang vertical padding sa loob ng input */
}

.field-input::placeholder {
  color: rgba(148, 163, 184, 0.6) !important;
}

/* Register Button Spacing */
.register-btn {
  margin-top: 26px !important; /* Hindi nakadikit sa Confirm Password */
  padding: 14px 20px !important;
}

/* Footer Link Spacing */
.signup-footer-text {
  text-align: center !important;
  color: #94a3b8 !important;
  font-size: 12px !important;
  margin-top: 22px !important;
  margin-bottom: 0 !important;
}
</style>