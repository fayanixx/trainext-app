<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import type { UserRole } from '@/types';

const router = useRouter();
const authStore = useAuthStore();

// Form States
const isSignUp = ref(false);
const email = ref('');
const password = ref('');
const fullName = ref('');
const contactNumber = ref('');
const selectedRole = ref<UserRole>('intern');

// UI Modal States
const verificationSent = ref(false);
const isForgotModalOpen = ref(false);
const forgotEmail = ref('');
const forgotSuccessMessage = ref('');
const forgotErrorMessage = ref('');
const formError = ref('');

// Submit Main Form (Login or Sign Up)
const handleSubmit = async () => {
  formError.value = '';
  try {
    if (isSignUp.value) {
      await authStore.signUp({
        email: email.value,
        password: password.value,
        fullName: fullName.value,
        contactNumber: contactNumber.value,
        role: selectedRole.value,
      });
      verificationSent.value = true;
    } else {
      await authStore.signIn(email.value, password.value);
      
      // Route to respective role dashboard
      if (authStore.isIntern) {
        router.push('/intern');
      } else if (authStore.isSupervisor) {
        router.push('/supervisor');
      } else if (authStore.isCoordinator) {
        router.push('/coordinator');
      } else {
        router.push('/home');
      }
    }
  } catch (err: any) {
    formError.value = err.message || 'Authentication error encountered.';
  }
};

// Dispatch Forgot Password Reset Link
const handleForgotPassword = async () => {
  forgotErrorMessage.value = '';
  forgotSuccessMessage.value = '';

  if (!forgotEmail.value) {
    forgotErrorMessage.value = 'Please enter your registered Gmail address.';
    return;
  }

  try {
    await authStore.sendPasswordReset(forgotEmail.value);
    forgotSuccessMessage.value = 'A password reset link has been dispatched to your Gmail. Please check your inbox or spam folder.';
  } catch (err: any) {
    forgotErrorMessage.value = err.message || 'Failed to dispatch password reset link.';
  }
};
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4 bg-[#0a0f1d] relative overflow-hidden select-none">
    <!-- Ambient Neon Cyberpunk Glow Backdrops -->
    <div class="absolute -top-32 -left-32 w-96 h-96 bg-cyan-500/15 rounded-full blur-[120px] pointer-events-none"></div>
    <div class="absolute -bottom-32 -right-32 w-96 h-96 bg-fuchsia-500/15 rounded-full blur-[120px] pointer-events-none"></div>

    <!-- Main Glass Card Frame -->
    <div class="w-full max-w-md p-6 sm:p-8 rounded-[2rem] bg-[#0d1527]/80 border border-cyan-500/30 backdrop-blur-2xl shadow-[0_0_50px_rgba(6,182,212,0.18)] text-slate-100 relative z-10">
      
      <!-- App Header Branding -->
      <div class="text-center mb-6">
        <h1 class="text-3xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-fuchsia-500">
          TRAINEXT
        </h1>
        <p class="text-[11px] font-semibold text-slate-400 mt-1 uppercase tracking-widest">
          Smart Geofenced OJT Verification Platform
        </p>
      </div>

      <!-- Gmail Verification Confirmation State -->
      <div v-if="verificationSent" class="text-center py-6 space-y-4">
        <div class="w-16 h-16 mx-auto rounded-full bg-cyan-500/20 border border-cyan-400/60 flex items-center justify-center text-cyan-300 text-2xl shadow-[0_0_25px_rgba(6,182,212,0.4)] animate-pulse">
          ✉
        </div>
        <h3 class="text-lg font-bold text-white tracking-wide">Verify Your Email</h3>
        <p class="text-xs text-slate-300 leading-relaxed px-2">
          We have sent an authentication verification link to <span class="text-cyan-400 font-semibold">{{ email }}</span>. Please check your Gmail inbox and click the verification link to activate your account.
        </p>
        <div class="pt-2">
          <button 
            @click="verificationSent = false; isSignUp = false;"
            class="w-full py-2.5 rounded-xl bg-slate-800/90 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-700/80 border border-slate-700/60 transition"
          >
            Return to Sign In
          </button>
        </div>
      </div>

      <!-- Auth Form (Sign In / Sign Up) -->
      <form v-else @submit.prevent="handleSubmit" class="space-y-4">
        <!-- Error Banner -->
        <div v-if="formError" class="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-xs text-red-300 font-medium">
          {{ formError }}
        </div>

        <!-- Role Selector Toggle (Only during Sign Up) -->
        <div v-if="isSignUp" class="space-y-1.5">
          <label class="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Select Account Role</label>
          <div class="grid grid-cols-3 gap-2 p-1.5 rounded-xl bg-slate-900/90 border border-slate-800/80">
            <button
              type="button"
              v-for="role in (['intern', 'supervisor', 'coordinator'] as UserRole[])"
              :key="role"
              @click="selectedRole = role"
              :class="selectedRole === role ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400/50 shadow-[0_0_15px_rgba(6,182,212,0.25)]' : 'text-slate-400 hover:text-slate-200'"
              class="py-2 rounded-lg text-xs font-bold capitalize transition text-center"
            >
              {{ role }}
            </button>
          </div>
        </div>

        <!-- Full Name (Only during Sign Up) -->
        <div v-if="isSignUp" class="space-y-1">
          <label class="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Full Legal Name</label>
          <input 
            v-model="fullName" 
            type="text" 
            required
            placeholder="e.g., Juan Dela Cruz"
            class="w-full px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-100 text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none transition"
          />
        </div>

        <!-- Contact Number (Only during Sign Up) -->
        <div v-if="isSignUp" class="space-y-1">
          <label class="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Contact Number</label>
          <input 
            v-model="contactNumber" 
            type="tel" 
            required
            placeholder="09123456789"
            class="w-full px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-100 text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none transition"
          />
        </div>

        <!-- Email Address -->
        <div class="space-y-1">
          <label class="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Gmail Address</label>
          <input 
            v-model="email" 
            type="email" 
            required
            placeholder="user@gmail.com"
            class="w-full px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-100 text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none transition"
          />
        </div>

        <!-- Password Field -->
        <div class="space-y-1">
          <div class="flex items-center justify-between">
            <label class="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Password</label>
            <button 
              v-if="!isSignUp" 
              type="button" 
              @click="isForgotModalOpen = true; forgotErrorMessage = ''; forgotSuccessMessage = ''; forgotEmail = email;"
              class="text-[11px] text-cyan-400 hover:text-cyan-300 transition"
            >
              Forgot Password?
            </button>
          </div>
          <input 
            v-model="password" 
            type="password" 
            required
            placeholder="••••••••"
            class="w-full px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-100 text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none transition"
          />
        </div>

        <!-- Submit Button -->
        <button 
          type="submit" 
          :disabled="authStore.loading"
          class="w-full py-3 mt-3 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-fuchsia-600 hover:from-cyan-400 hover:to-fuchsia-500 text-white font-bold text-sm tracking-wider uppercase shadow-[0_0_25px_rgba(6,182,212,0.35)] disabled:opacity-50 transition"
        >
          {{ authStore.loading ? 'Authenticating...' : (isSignUp ? 'Sign Up & Send Verification' : 'Sign In') }}
        </button>

        <!-- Toggle Switch -->
        <div class="text-center pt-2">
          <button 
            type="button" 
            @click="isSignUp = !isSignUp; formError = '';" 
            class="text-xs text-slate-400 hover:text-cyan-400 transition"
          >
            {{ isSignUp ? 'Already registered? Sign In here' : "Don't have an account? Sign Up" }}
          </button>
        </div>
      </form>
    </div>

    <!-- FORGOT PASSWORD GLASS MODAL (Responsive Mobile/Web Sheet) -->
    <Transition name="fade">
      <div v-if="isForgotModalOpen" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-navy-950/80 backdrop-blur-md">
        <!-- Backdrop Close -->
        <div class="fixed inset-0" @click="isForgotModalOpen = false"></div>

        <!-- Glass Dialog Container -->
        <div class="relative w-full sm:max-w-md p-6 bg-[#0d1527]/95 border-t sm:border border-cyan-500/40 rounded-t-[2rem] sm:rounded-2xl shadow-[0_0_40px_rgba(6,182,212,0.25)] text-slate-100 z-10 backdrop-blur-2xl">
          <!-- Mobile Drawer Drag Indicator -->
          <div class="sm:hidden w-12 h-1 bg-slate-600/60 rounded-full mx-auto mb-4"></div>

          <div class="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 class="text-base font-bold text-cyan-400 tracking-wide">Reset Account Password</h3>
            <button @click="isForgotModalOpen = false" class="text-slate-400 hover:text-white text-sm">✕</button>
          </div>

          <div class="py-4 space-y-3">
            <p class="text-xs text-slate-300 leading-relaxed">
              Enter your registered Gmail address below. We will send a secure password reset link to your inbox.
            </p>

            <div v-if="forgotSuccessMessage" class="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-300 font-medium">
              {{ forgotSuccessMessage }}
            </div>

            <div v-if="forgotErrorMessage" class="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-xs text-red-300 font-medium">
              {{ forgotErrorMessage }}
            </div>

            <div class="space-y-1">
              <label class="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Registered Gmail</label>
              <input 
                v-model="forgotEmail" 
                type="email" 
                placeholder="user@gmail.com"
                class="w-full px-4 py-2.5 rounded-xl bg-slate-900/70 border border-slate-800 text-slate-100 text-sm focus:border-cyan-400 outline-none"
              />
            </div>
          </div>

          <div class="pt-3 border-t border-slate-800 flex justify-end gap-2">
            <button 
              @click="isForgotModalOpen = false"
              class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button 
              @click="handleForgotPassword"
              :disabled="authStore.loading"
              class="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-md disabled:opacity-50 transition"
            >
              {{ authStore.loading ? 'Sending...' : 'Send Reset Link' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>