<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { supabase } from '@/lib/supabase';

const router = useRouter();

// Form States
const newPassword = ref('');
const confirmPassword = ref('');
const loading = ref(false);
const errorMsg = ref('');
const successMsg = ref('');
const isValidSession = ref(false);

// Validate whether a valid recovery token exists in the URL/Session
onMounted(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    isValidSession.value = true;
  } else {
    // Listen for auth state change triggered by the reset link token
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        isValidSession.value = true;
      }
    });
  }
});

const handleResetPassword = async () => {
  errorMsg.value = '';
  successMsg.value = '';

  if (newPassword.value.length < 6) {
    errorMsg.value = 'Password must be at least 6 characters long.';
    return;
  }

  if (newPassword.value !== confirmPassword.value) {
    errorMsg.value = 'Passwords do not match. Please verify and try again.';
    return;
  }

  loading.value = true;
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword.value,
    });

    if (error) throw error;

    successMsg.value = 'Your password has been reset successfully! Redirecting to Sign In...';
    setTimeout(() => {
      router.push('/auth');
    }, 2500);
  } catch (err: any) {
    errorMsg.value = err.message || 'Failed to update password. Please try requesting a new link.';
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4 bg-[#0a0f1d] relative overflow-hidden select-none">
    <!-- Ambient Neon Cyberpunk Glow Backdrops -->
    <div class="absolute -top-32 -left-32 w-96 h-96 bg-cyan-500/15 rounded-full blur-[120px] pointer-events-none"></div>
    <div class="absolute -bottom-32 -right-32 w-96 h-96 bg-fuchsia-500/15 rounded-full blur-[120px] pointer-events-none"></div>

    <!-- Main Glass Card Container -->
    <div class="w-full max-w-md p-6 sm:p-8 rounded-[2rem] bg-[#0d1527]/85 border border-cyan-500/30 backdrop-blur-2xl shadow-[0_0_50px_rgba(6,182,212,0.18)] text-slate-100 relative z-10">
      
      <!-- App Header Branding -->
      <div class="text-center mb-6">
        <h1 class="text-3xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-fuchsia-500">
          TRAINEXT
        </h1>
        <p class="text-[11px] font-semibold text-slate-400 mt-1 uppercase tracking-widest">
          Set New Account Password
        </p>
      </div>

      <!-- Expired or Invalid Link Warning -->
      <div v-if="!isValidSession" class="text-center py-6 space-y-4">
        <div class="w-14 h-14 mx-auto rounded-full bg-amber-500/20 border border-amber-400/60 flex items-center justify-center text-amber-300 text-2xl shadow-[0_0_20px_rgba(251,191,36,0.25)]">
          ⚠
        </div>
        <h3 class="text-base font-bold text-white tracking-wide">Invalid or Expired Link</h3>
        <p class="text-xs text-slate-300 leading-relaxed px-2">
          The password reset token is missing or has expired. Please request a new link from the Sign In page.
        </p>
        <div class="pt-2">
          <button 
            @click="router.push('/auth')"
            class="w-full py-2.5 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-700 transition border border-slate-700/60"
          >
            Back to Sign In
          </button>
        </div>
      </div>

      <!-- Password Update Form -->
      <form v-else @submit.prevent="handleResetPassword" class="space-y-4">
        <!-- Success Alert -->
        <div v-if="successMsg" class="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-300 font-medium">
          {{ successMsg }}
        </div>

        <!-- Error Alert -->
        <div v-if="errorMsg" class="p-3.5 rounded-xl bg-red-950/60 border border-red-500/40 text-xs text-red-300 font-medium">
          {{ errorMsg }}
        </div>

        <p class="text-xs text-slate-400 leading-relaxed">
          Please enter your new password below. Make sure it is at least 6 characters long.
        </p>

        <!-- New Password Field -->
        <div class="space-y-1">
          <label class="text-[11px] font-bold text-slate-300 uppercase tracking-wider">New Password</label>
          <input 
            v-model="newPassword" 
            type="password" 
            required
            placeholder="••••••••"
            class="w-full px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-100 text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none transition"
          />
        </div>

        <!-- Confirm New Password Field -->
        <div class="space-y-1">
          <label class="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Confirm New Password</label>
          <input 
            v-model="confirmPassword" 
            type="password" 
            required
            placeholder="••••••••"
            class="w-full px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-100 text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none transition"
          />
        </div>

        <!-- Submit Button -->
        <button 
          type="submit" 
          :disabled="loading"
          class="w-full py-3 mt-2 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-fuchsia-600 hover:from-cyan-400 hover:to-fuchsia-500 text-white font-bold text-sm tracking-wider uppercase shadow-[0_0_25px_rgba(6,182,212,0.35)] disabled:opacity-50 transition"
        >
          {{ loading ? 'Updating Password...' : 'Save New Password' }}
        </button>

        <!-- Return to Sign In Link -->
        <div class="text-center pt-2">
          <button 
            type="button" 
            @click="router.push('/auth')" 
            class="text-xs text-slate-400 hover:text-cyan-400 transition"
          >
            Cancel and Return to Sign In
          </button>
        </div>
      </form>
    </div>
  </div>
</template>