<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { supabase } from '@/lib/supabase';

const router = useRouter();

// State
const isUpdateMode = ref(false);
const email = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const showPassword = ref(false);
const showConfirmPassword = ref(false);
const loading = ref(false);
const errorMessage = ref('');
const successMessage = ref('');

onMounted(async () => {
  // Alamin kung galing sa recovery email link ang user
  const hash = window.location.hash;
  if (hash.includes('type=recovery') || hash.includes('access_token=')) {
    isUpdateMode.value = true;
  }

  supabase.auth.onAuthStateChange(async (event) => {
    if (event === 'PASSWORD_RECOVERY') {
      isUpdateMode.value = true;
    }
  });
});

// Mode 1: Request Reset Link
const handleRequestReset = async () => {
  errorMessage.value = '';
  successMessage.value = '';

  if (!email.value.trim()) {
    errorMessage.value = 'Please provide your registered email address.';
    return;
  }

  loading.value = true;
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email.value.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) throw error;

    successMessage.value = 'Password reset instructions have been sent to your email inbox.';
    email.value = '';
  } catch (err: any) {
    errorMessage.value = err.message || 'Failed to send reset email. Please try again.';
  } finally {
    loading.value = false;
  }
};

// Mode 2: Update Password Mula sa Email Link
const handleUpdatePassword = async () => {
  errorMessage.value = '';
  successMessage.value = '';

  if (newPassword.value.length < 8) {
    errorMessage.value = 'Password must be at least 8 characters long.';
    return;
  }

  if (newPassword.value !== confirmPassword.value) {
    errorMessage.value = 'Passwords do not match.';
    return;
  }

  loading.value = true;
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword.value,
    });

    if (error) throw error;

    successMessage.value = 'Password successfully updated! Redirecting to login...';
    newPassword.value = '';
    confirmPassword.value = '';

    setTimeout(async () => {
      await supabase.auth.signOut();
      router.replace('/auth');
    }, 2200);
  } catch (err: any) {
    errorMessage.value = err.message || 'Failed to update password. Link may be expired.';
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <main class="relative min-h-screen w-full flex flex-col items-center justify-between p-4 sm:p-6 bg-[#050609] overflow-y-auto select-none">
    
    <!-- Railway Background Image -->
    <div 
      class="fixed inset-0 bg-cover bg-center bg-no-repeat pointer-events-none"
      style="background-image: url('/assets/bg-placeholder.png');"
    ></div>

    <!-- Dark Navy/Black Overlay -->
    <div class="fixed inset-0 bg-[#050609]/65 pointer-events-none"></div>

    <div class="w-full max-w-[440px] my-auto relative z-10 flex flex-col items-center">
      
      <!-- TRAINEXT BRANDING LOGO -->
      <div class="w-full flex justify-center mb-6">
        <img 
          src="/assets/trainext-logo.png" 
          alt="TraiNext Logo" 
          class="w-[125px] h-auto object-contain"
        />
      </div>

      <!-- FROSTED GLASS CARD -->
      <div class="w-full trainext-spec-glass p-6 sm:p-8 flex flex-col rounded-[28px] border border-white/20 bg-[#020408]/40 backdrop-blur-md shadow-2xl">
        
        <!-- HEADINGS -->
        <div class="mb-6">
          <h1 class="text-white text-[28px] font-bold tracking-[-0.8px] leading-tight">
            {{ isUpdateMode ? 'Set New Password' : 'Reset Password' }}
          </h1>
          <p class="text-[#00D9FF] text-[12.5px] font-normal mt-1 leading-snug">
            {{ isUpdateMode ? 'Create a secure new password for your account.' : 'Enter your account email to receive recovery instructions.' }}
          </p>
        </div>

        <!-- FEEDBACK NOTIFICATIONS -->
        <div v-if="errorMessage" class="mb-4 p-3 rounded-xl bg-rose-950/70 border border-rose-500/40 text-[11.5px] text-rose-200">
          {{ errorMessage }}
        </div>
        <div v-if="successMessage" class="mb-4 p-3 rounded-xl bg-cyan-950/70 border border-cyan-500/40 text-[11.5px] text-cyan-200">
          {{ successMessage }}
        </div>

        <!-- FORM: MODE 1 (REQUEST RESET LINK) -->
        <form v-if="!isUpdateMode" @submit.prevent="handleRequestReset" class="flex flex-col">
          <div class="mb-7">
            <label class="block text-[8.5px] font-semibold text-[#cbd5e1] tracking-[1.2px] uppercase mb-1.5">
              REGISTERED EMAIL
            </label>
            <div class="flex items-center gap-2.5 pb-2 border-b border-white/20 focus-within:border-[#00d9ff] transition">
              <svg class="w-[14px] h-[14px] text-[#00D9FF] shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <input 
                v-model="email" 
                type="email" 
                required
                placeholder="you@example.com"
                class="w-full bg-transparent text-white text-[12px] placeholder:text-[#858994] outline-none"
              />
            </div>
          </div>

          <div class="flex justify-center mb-6">
            <button 
              type="submit" 
              :disabled="loading"
              class="trainext-btn-pill-primary w-[190px] h-[40px] text-xs"
            >
              {{ loading ? 'SENDING...' : 'SEND RESET LINK' }}
            </button>
          </div>

          <div class="text-center">
            <router-link 
              to="/auth"
              class="text-[9.5px] text-[#858994] hover:text-white tracking-[0.4px] transition flex items-center justify-center gap-1.5 font-semibold uppercase"
            >
              <svg class="w-3 h-3 text-[#00D9FF]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Sign In</span>
            </router-link>
          </div>
        </form>

        <!-- FORM: MODE 2 (UPDATE NEW PASSWORD GALING SA EMAIL) -->
        <form v-else @submit.prevent="handleUpdatePassword" class="flex flex-col">
          <!-- New Password -->
          <div class="mb-4">
            <label class="block text-[8.5px] font-semibold text-[#cbd5e1] tracking-[1.2px] uppercase mb-1.5">
              NEW PASSWORD
            </label>
            <div class="flex items-center gap-2.5 pb-2 border-b border-white/20 focus-within:border-[#00d9ff] transition">
              <svg class="w-[14px] h-[14px] text-[#00D9FF] shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <rect x="5" y="10" width="14" height="11" rx="1.5" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2" />
              </svg>
              <input 
                v-model="newPassword" 
                :type="showPassword ? 'text' : 'password'" 
                required 
                minlength="8"
                placeholder="Minimum 8 characters"
                class="w-full bg-transparent text-white text-[12px] placeholder:text-[#858994] outline-none"
              />
              <button 
                type="button" 
                @click="showPassword = !showPassword"
                class="text-slate-400 hover:text-white transition"
              >
                <svg v-if="!showPassword" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <svg v-else class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Confirm Password -->
          <div class="mb-7">
            <label class="block text-[8.5px] font-semibold text-[#cbd5e1] tracking-[1.2px] uppercase mb-1.5">
              CONFIRM NEW PASSWORD
            </label>
            <div class="flex items-center gap-2.5 pb-2 border-b border-white/20 focus-within:border-[#00d9ff] transition">
              <svg class="w-[14px] h-[14px] text-[#00D9FF] shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <rect x="5" y="10" width="14" height="11" rx="1.5" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2" />
              </svg>
              <input 
                v-model="confirmPassword" 
                :type="showConfirmPassword ? 'text' : 'password'" 
                required 
                placeholder="Re-enter new password"
                class="w-full bg-transparent text-white text-[12px] placeholder:text-[#858994] outline-none"
              />
              <button 
                type="button" 
                @click="showConfirmPassword = !showConfirmPassword"
                class="text-slate-400 hover:text-white transition"
              >
                <svg v-if="!showConfirmPassword" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <svg v-else class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                </svg>
              </button>
            </div>
          </div>

          <div class="flex justify-center mb-6">
            <button 
              type="submit" 
              :disabled="loading"
              class="trainext-btn-pill-primary w-[210px] h-[40px] text-xs font-bold"
            >
              {{ loading ? 'UPDATING...' : 'SAVE NEW PASSWORD' }}
            </button>
          </div>
        </form>

      </div>

      <!-- FOOTER TAGLINE -->
      <div class="text-center mt-7 text-[9.5px] tracking-[0.5px]">
        <span class="text-white/80 font-normal">Smart Tracking. </span>
        <span class="text-[#00D9FF] font-semibold">Real-Time Safety.</span>
      </div>

    </div>
  </main>
</template>