<template>
  <ion-page>
    <ion-content :fullscreen="true" class="reset-content" style="--background: transparent">
      <!-- Fixed Background Layer (Subway platform na may dark vignette) -->
      <div class="fixed inset-0 bg-[#020611] -z-10 overflow-hidden flex items-center justify-center pointer-events-none select-none">
        <img
          src="/assets/bg-placeholder.png"
          alt="Platform Background"
          class="w-full h-full object-cover object-center brightness-[0.70] contrast-[1.15]"
        />
        <div class="absolute inset-0 bg-gradient-to-b from-[#020611]/60 via-[#020611]/30 to-[#020611]/90"></div>
        <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,194,255,0.12)_0%,transparent_60%)]"></div>
      </div>

      <!-- Main Vertically Centered Container -->
      <div class="min-h-full w-full relative flex flex-col items-center justify-center py-8 px-4 font-aileron selection:bg-[#00C2FF] selection:text-black box-border">
        
        <div class="w-full flex flex-col items-center max-w-[390px] mx-auto">
          
          <!-- Brand Logo Header -->
          <div class="flex flex-col items-center justify-center pt-2 pb-5 select-none -mb-1">
            <div class="relative flex items-center justify-center">
              <div class="absolute w-24 h-24 bg-[#00C2FF]/20 rounded-full blur-2xl pointer-events-none"></div>
              <img
                src="/assets/trainext-logo.png"
                alt="TraiNext Logo"
                class="h-[88px] w-auto object-contain drop-shadow-[0_0_20px_rgba(0,194,255,0.65)] relative z-10"
              />
            </div>
            <div class="flex items-center tracking-[0.24em] font-heavy text-[23px] mt-1.5 drop-shadow-[0_0_12px_rgba(0,194,255,0.5)]">
              <span class="text-white">TRAIN</span>
              <span class="text-[#00C2FF]">EXT</span>
            </div>
          </div>

          <!-- Glassmorphic Card -->
          <div class="trainext-glass-card w-full">
            <div class="mb-6">
              <h2 class="reset-title">Reset Password</h2>
              <p class="reset-subtitle">Set a secure new password for your account</p>
            </div>

            <!-- Invalid / Expired Link State -->
            <div v-if="!auth.isAuthenticated" class="space-y-4">
              <div class="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-300 font-regular leading-relaxed">
                This password reset link is invalid or has expired. Please request a new link from the sign-in page.
              </div>
              <button
                type="button"
                class="pill-btn btn-gradient-cyan w-full mt-2"
                @click="router.replace('/auth')"
              >
                RETURN TO SIGN IN
              </button>
            </div>

            <!-- New Password Form -->
            <template v-else>
              <form @submit.prevent="submit" class="space-y-5">
                <!-- New Password -->
                <div>
                  <label class="field-label">NEW PASSWORD</label>
                  <div class="input-line-box">
                    <svg class="text-[#00C2FF] w-[18px] h-[18px] mr-2.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <input
                      v-model="password"
                      :type="showPassword ? 'text' : 'password'"
                      placeholder="At least 6 characters"
                      autocomplete="new-password"
                      class="field-input"
                    />
                    <button
                      type="button"
                      class="text-slate-400 hover:text-white w-4 h-4 ml-1.5 cursor-pointer shrink-0 transition-colors"
                      :aria-label="showPassword ? 'Hide password' : 'Show password'"
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

                <!-- Confirm New Password -->
                <div>
                  <label class="field-label">CONFIRM NEW PASSWORD</label>
                  <div class="input-line-box">
                    <svg class="text-[#00C2FF] w-[18px] h-[18px] mr-2.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <input
                      v-model="confirmPassword"
                      :type="showConfirmPassword ? 'text' : 'password'"
                      placeholder="Repeat your new password"
                      autocomplete="new-password"
                      class="field-input"
                    />
                    <button
                      type="button"
                      class="text-slate-400 hover:text-white w-4 h-4 ml-1.5 cursor-pointer shrink-0 transition-colors"
                      :aria-label="showConfirmPassword ? 'Hide password' : 'Show password'"
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

                <!-- Update Button -->
                <button
                  type="submit"
                  class="pill-btn btn-gradient-cyan w-full flex items-center justify-center gap-2 mt-6"
                  :disabled="auth.loading"
                >
                  <ion-spinner v-if="auth.loading" name="crescent" class="w-4 h-4 text-black" />
                  UPDATE PASSWORD
                </button>
              </form>
            </template>
          </div>
        </div>

        <!-- Footer Tagline -->
        <p class="text-center text-[11px] font-bold text-slate-400 mt-5 select-none tracking-wide">
          Smart Tracking. <span class="text-[#00C2FF]">Real-Time Safety.</span>
        </p>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  IonContent,
  IonPage,
  IonSpinner
} from '@ionic/vue'
import { useAuthStore } from '@/stores/auth'
import type { Profile } from '@/types'

const auth = useAuthStore()
const router = useRouter()

const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

function destinationFor(profile: Profile): string {
  if (profile.role === 'supervisor') {
    return '/supervisor'
  }
  if (profile.role === 'coordinator') {
    return '/coordinator'
  }
  return '/intern'
}

async function submit(): Promise<void> {
  errorMessage.value = ''
  successMessage.value = ''

  if (password.value.length < 6) {
    errorMessage.value = 'Password must be at least 6 characters.'
    return
  }

  if (password.value !== confirmPassword.value) {
    errorMessage.value = 'Passwords do not match.'
    return
  }

  try {
    await auth.updatePassword(password.value)
    successMessage.value = 'Password updated. Redirecting to your dashboard.'
    if (!auth.profile) {
      await auth.fetchProfile()
    }
    if (auth.profile) {
      window.setTimeout(() => {
        void router.replace(destinationFor(auth.profile as Profile))
      }, 700)
    } else {
      window.setTimeout(() => {
        void router.replace('/auth')
      }, 700)
    }
  } catch (err) {
    errorMessage.value =
      err instanceof Error ? err.message : 'Unable to update the password.'
  }
}

onMounted(async () => {
  await auth.initialize()
  if (auth.isAuthenticated && !auth.profile) {
    await auth.fetchProfile()
  }
})
</script>

<style scoped>
/* Typography Definition */
.font-aileron {
  font-family: 'Aileron', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
}

.font-regular {
  font-family: 'Aileron', sans-serif !important;
  font-weight: 400 !important;
}

.font-bold {
  font-family: 'Aileron Bold', 'Aileron', sans-serif !important;
  font-weight: 700 !important;
}

.font-heavy {
  font-family: 'Aileron Heavy', 'Aileron Black', 'Aileron Bold', 'Aileron', sans-serif !important;
  font-weight: 900 !important;
}

/* Ionic Background Override */
ion-content.reset-content {
  --background: transparent !important;
}
ion-content.reset-content::part(background) {
  background: transparent !important;
}

/* Crisp & Transparent Glassmorphic Card */
.trainext-glass-card {
  border-radius: 36px !important;
  border: 1px solid rgba(255, 255, 255, 0.25) !important;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.08) 0%,
    rgba(4, 9, 22, 0.35) 40%,
    rgba(2, 6, 17, 0.45) 100%
  ) !important;
  backdrop-filter: blur(8px) saturate(140%) !important;
  -webkit-backdrop-filter: blur(8px) saturate(140%) !important;
  box-shadow: 
    0 20px 50px rgba(0, 0, 0, 0.75),
    inset 0 1px 1px rgba(255, 255, 255, 0.35),
    inset 0 -1px 1px rgba(255, 255, 255, 0.1) !important;
  padding: 28px 28px 30px !important;
  box-sizing: border-box !important;
}

/* Titles */
.reset-title {
  font-family: 'Aileron Heavy', 'Aileron Black', 'Aileron Bold', 'Aileron', sans-serif !important;
  font-size: 30px !important;
  line-height: 1.1 !important;
  font-weight: 900 !important;
  color: #ffffff !important;
  letter-spacing: -0.02em !important;
  margin: 0 !important;
}

.reset-subtitle {
  font-family: 'Aileron Bold', 'Aileron', sans-serif !important;
  font-size: 13.5px !important;
  line-height: 1.25 !important;
  font-weight: 700 !important;
  color: #00C2FF !important;
  margin-top: 4px !important;
  margin-bottom: 0 !important;
}

/* Form Inputs */
.field-label {
  font-size: 10px !important;
  font-family: 'Aileron Heavy', 'Aileron Bold', 'Aileron', sans-serif !important;
  font-weight: 900 !important;
  letter-spacing: 0.15em !important;
  color: #cbd5e1 !important;
  text-transform: uppercase !important;
  display: block !important;
  margin-bottom: 6px !important;
}

.input-line-box {
  position: relative !important;
  display: flex !important;
  align-items: center !important;
  border-bottom: 1.25px solid rgba(255, 255, 255, 0.35) !important;
  padding-bottom: 6px !important;
  padding-top: 4px !important;
  transition: border-color 0.2s ease !important;
}

.input-line-box:focus-within {
  border-bottom-color: #00C2FF !important;
}

.field-input {
  width: 100% !important;
  background: transparent !important;
  color: #ffffff !important;
  font-size: 13.5px !important;
  outline: none !important;
  border: none !important;
  font-family: 'Aileron', sans-serif !important;
}

.field-input::placeholder {
  color: rgba(148, 163, 184, 0.6) !important;
}

/* Action Buttons */
.pill-btn {
  border-radius: 9999px !important;
  padding: 13.5px 22px !important;
  font-family: 'Aileron Heavy', 'Aileron Bold', 'Aileron', sans-serif !important;
  font-weight: 900 !important;
  font-size: 13.5px !important;
  letter-spacing: 0.08em !important;
  cursor: pointer !important;
  border: none !important;
  transition: all 0.2s ease !important;
}

.pill-btn:disabled {
  opacity: 0.45 !important;
  cursor: not-allowed !important;
}

.btn-gradient-cyan {
  background: linear-gradient(135deg, #a5f3fc 0%, #67e8f9 45%, #38bdf8 100%) !important;
  color: #000000 !important;
  box-shadow: 0 0 20px rgba(0, 194, 255, 0.45) !important;
}

.btn-gradient-cyan:hover:not(:disabled) {
  filter: brightness(1.06) !important;
  box-shadow: 0 0 26px rgba(0, 194, 255, 0.65) !important;
}

.btn-gradient-cyan:active:not(:disabled) {
  transform: scale(0.98) !important;
}
</style>