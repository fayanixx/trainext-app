<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'saved'): void;
}>();

const authStore = useAuthStore();

// Form Fields
const fullName = ref('');
const contactNumber = ref('');
const userEmail = ref('');
const isOAuthUser = ref(false);

const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');

// UI States
const isSubmitting = ref(false);
const showCurrentPassword = ref(false);
const showNewPassword = ref(false);
const showConfirmPassword = ref(false);
const errorMessage = ref('');
const successMessage = ref('');

const syncUserData = async () => {
  try {
    const { data } = await supabase.auth.getUser();
    if (data?.user) {
      userEmail.value = data.user.email || '';
      const provider = data.user.app_metadata?.provider;
      isOAuthUser.value = provider === 'google';
    }

    if (authStore.user) {
      fullName.value = authStore.user.full_name || '';
      contactNumber.value = authStore.user.contact_number || '';
    }
  } catch (err: any) {
    console.warn('Profile sync warning:', err.message);
  }
};

watch(
  () => props.isOpen,
  async (open) => {
    if (open) {
      errorMessage.value = '';
      successMessage.value = '';
      currentPassword.value = '';
      newPassword.value = '';
      confirmPassword.value = '';
      showCurrentPassword.value = false;
      showNewPassword.value = false;
      showConfirmPassword.value = false;
      await syncUserData();
    }
  }
);

onMounted(async () => {
  await syncUserData();
});

const handleSave = async () => {
  if (!authStore.user?.id) {
    errorMessage.value = 'User session not found. Please log in again.';
    return;
  }

  errorMessage.value = '';
  successMessage.value = '';

  if (!fullName.value.trim()) {
    errorMessage.value = 'Full name is required.';
    return;
  }

  const wantsPasswordChange = !!(newPassword.value || currentPassword.value);

  if (wantsPasswordChange && isOAuthUser.value) {
    errorMessage.value = 'Google-authenticated accounts manage credentials directly via Google.';
    return;
  }

  if (wantsPasswordChange) {
    if (!currentPassword.value) {
      errorMessage.value = 'Current password is required to authorize this update.';
      return;
    }
    if (!newPassword.value) {
      errorMessage.value = 'Please provide your new password.';
      return;
    }
    if (newPassword.value.length < 8) {
      errorMessage.value = 'New password must be at least 8 characters long.';
      return;
    }
    if (newPassword.value !== confirmPassword.value) {
      errorMessage.value = 'New passwords do not match.';
      return;
    }
  }

  isSubmitting.value = true;

  try {
    if (wantsPasswordChange && userEmail.value) {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: userEmail.value,
        password: currentPassword.value,
      });

      if (verifyError) {
        throw new Error('Current password is incorrect.');
      }

      const { error: passwordError } = await supabase.auth.updateUser({
        password: newPassword.value,
      });

      if (passwordError) throw passwordError;
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.value.trim(),
        contact_number: contactNumber.value.trim() || null,
      })
      .eq('id', authStore.user.id);

    if (profileError) throw profileError;

    await authStore.fetchProfile();
    successMessage.value = 'Profile settings saved successfully.';

    currentPassword.value = '';
    newPassword.value = '';
    confirmPassword.value = '';

    setTimeout(() => {
      emit('saved');
      emit('close');
    }, 700);
  } catch (err: any) {
    errorMessage.value = err.message || 'Failed to update profile settings.';
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div 
    v-if="isOpen" 
    class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md select-none overflow-y-auto"
  >
    <div class="w-full max-w-md my-auto rounded-[24px] bg-[#050811]/95 border border-white/15 shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      
      <!-- MODAL HEADER -->
      <header class="px-5 sm:px-6 py-4 border-b border-white/10 flex items-center justify-between gap-3 bg-white/[0.015]">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-[#00d9ff] shrink-0">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div class="min-w-0">
            <p class="text-[20px] sm:text-[20px] font-bold text-white whitespace-nowrap truncate font-['Aileron',sans-serif]">Account Settings</p>
            <p class="text-[10.5px] text-[#00d9ff] font-mono tracking-wide truncate">CREDENTIALS &amp; PROFILE</p>
          </div>
        </div>

        <button 
          type="button" 
          @click="emit('close')"
          class="w-8 h-8 rounded-full border border-white/15 bg-white/[0.03] text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          aria-label="Close Modal"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </header>

      <!-- FEEDBACK ALERTS -->
      <div v-if="errorMessage || successMessage" class="px-5 sm:px-6 pt-4">
        <div 
          v-if="errorMessage" 
          class="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2"
        >
          <svg class="w-4 h-4 text-rose-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{{ errorMessage }}</span>
        </div>

        <div 
          v-if="successMessage" 
          class="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2"
        >
          <svg class="w-4 h-4 text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <span>{{ successMessage }}</span>
        </div>
      </div>

      <!-- FORM FIELDS -->
      <form @submit.prevent="handleSave" class="p-5 sm:p-6 flex flex-col gap-4 overflow-y-auto max-h-[calc(85vh-75px)]">
        
        <!-- GENERAL DETAILS GROUP -->
        <div class="flex flex-col gap-3">
          <span class="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider font-['Aileron',sans-serif]">
            Profile Information
          </span>

          <!-- FULL NAME -->
          <div class="flex flex-col gap-1.5">
            <label class="text-[10px] font-semibold text-slate-300 uppercase tracking-wider font-mono">Full Name</label>
            <div class="relative flex items-center">
              <svg class="w-4 h-4 text-[#00d9ff] absolute left-3.5 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <input 
                v-model="fullName" 
                type="text" 
                required
                placeholder="Full Name"
                class="settings-input pl-10 pr-4"
              />
            </div>
          </div>

          <!-- EMAIL ADDRESS (READ-ONLY) -->
          <div class="flex flex-col gap-1.5 opacity-80">
            <div class="flex items-center justify-between">
              <label class="text-[10px] font-semibold text-slate-300 uppercase tracking-wider font-mono">Email Address</label>
              <span class="text-[9px] font-mono text-slate-400">System Locked</span>
            </div>
            <div class="relative flex items-center">
              <svg class="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <input 
                :value="userEmail" 
                type="email" 
                disabled
                class="settings-input pl-10 pr-4 cursor-not-allowed text-slate-400 bg-white/[0.02]"
              />
            </div>
          </div>

          <!-- CONTACT NUMBER -->
          <div class="flex flex-col gap-1.5">
            <label class="text-[10px] font-semibold text-slate-300 uppercase tracking-wider font-mono">Contact Number</label>
            <div class="relative flex items-center">
              <svg class="w-4 h-4 text-[#00d9ff] absolute left-3.5 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <input 
                v-model="contactNumber" 
                type="tel" 
                placeholder="+63 9XX XXX XXXX"
                class="settings-input pl-10 pr-4 font-mono"
              />
            </div>
          </div>
        </div>

        <!-- SECURITY & PASSWORD SECTION -->
        <div class="pt-3 border-t border-white/10 flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <span class="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider font-['Aileron',sans-serif]">
              Security &amp; Password
            </span>
            <span v-if="!isOAuthUser" class="text-[9px] font-mono text-[#858994]">Leave blank to keep unchanged</span>
          </div>

          <!-- GOOGLE OAUTH NOTICE -->
          <div v-if="isOAuthUser" class="p-3 rounded-xl bg-white/[0.02] border border-white/10 flex items-center gap-2.5">
            <svg class="w-4 h-4 text-[#00d9ff] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p class="text-[11px] text-slate-300 leading-relaxed">
              This account is verified via Google authentication. Credentials are managed directly via your Google Account.
            </p>
          </div>

          <!-- EMAIL / PASSWORD FIELDS (NON-OAUTH) -->
          <div v-else class="flex flex-col gap-3">
            <!-- CURRENT PASSWORD -->
            <div class="flex flex-col gap-1.5">
              <label class="text-[10px] font-semibold text-slate-300 uppercase tracking-wider font-mono">Current Password</label>
              <div class="relative flex items-center">
                <svg class="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <input 
                  v-model="currentPassword" 
                  :type="showCurrentPassword ? 'text' : 'password'"
                  placeholder="Required for password update"
                  class="settings-input pl-10 pr-10"
                />
                <button 
                  type="button" 
                  @click="showCurrentPassword = !showCurrentPassword"
                  class="absolute right-3.5 text-slate-400 hover:text-white transition cursor-pointer"
                  tabindex="-1"
                >
                  <svg v-if="!showCurrentPassword" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <svg v-else class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- NEW PASSWORD -->
            <div class="flex flex-col gap-1.5">
              <label class="text-[10px] font-semibold text-slate-300 uppercase tracking-wider font-mono">New Password</label>
              <div class="relative flex items-center">
                <svg class="w-4 h-4 text-[#00d9ff] absolute left-3.5 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <input 
                  v-model="newPassword" 
                  :type="showNewPassword ? 'text' : 'password'"
                  placeholder="Minimum 8 characters"
                  class="settings-input pl-10 pr-10"
                />
                <button 
                  type="button" 
                  @click="showNewPassword = !showNewPassword"
                  class="absolute right-3.5 text-slate-400 hover:text-white transition cursor-pointer"
                  tabindex="-1"
                >
                  <svg v-if="!showNewPassword" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <svg v-else class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- CONFIRM NEW PASSWORD -->
            <div v-if="newPassword" class="flex flex-col gap-1.5 animate-in fade-in duration-150">
              <label class="text-[10px] font-semibold text-slate-300 uppercase tracking-wider font-mono">Confirm New Password</label>
              <div class="relative flex items-center">
                <svg class="w-4 h-4 text-[#00d9ff] absolute left-3.5 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <input 
                  v-model="confirmPassword" 
                  :type="showConfirmPassword ? 'text' : 'password'"
                  placeholder="Re-type new password"
                  class="settings-input pl-10 pr-10"
                />
                <button 
                  type="button" 
                  @click="showConfirmPassword = !showConfirmPassword"
                  class="absolute right-3.5 text-slate-400 hover:text-white transition cursor-pointer"
                  tabindex="-1"
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
          </div>
        </div>

        <!-- MODAL ACTIONS -->
        <div class="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
          <button 
            type="button" 
            @click="emit('close')"
            :disabled="isSubmitting"
            class="pill-neutral-btn cursor-pointer whitespace-nowrap"
          >
            Cancel
          </button>

          <button 
            type="submit" 
            :disabled="isSubmitting"
            class="pill-cyan-btn cursor-pointer whitespace-nowrap"
          >
            <div v-if="isSubmitting" class="spinner-ring border-[#00d9ff]"></div>
            <span>{{ isSubmitting ? 'Saving...' : 'Save Changes' }}</span>
          </button>
        </div>

      </form>

    </div>
  </div>
</template>

<style scoped>
/* INPUT FIELD CYBER-GLASS STYLING */
.settings-input {
  width: 100%;
  height: 40px;
  border-radius: 9999px;
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: #ffffff;
  font-family: "Aileron", -apple-system, sans-serif;
  font-size: 11.5px;
  outline: none;
  transition: border-color 160ms ease, box-shadow 160ms ease;
}

.settings-input::placeholder {
  font-size: 10.5px;
  letter-spacing: 0.3px;
  color: #717684;
}

.settings-input:focus {
  border-color: #00d9ff;
  box-shadow: 0 0 10px rgba(0, 217, 255, 0.25);
}

/* ================= ERGONOMIC PILL BUTTON STANDARDS ================= */

/* CYAN PRIMARY PILL BUTTON */
.pill-cyan-btn {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 6px !important;
  height: 36px !important;
  padding: 0 20px !important;
  border-radius: 9999px !important;
  border: 1px solid rgba(0, 217, 255, 0.5) !important;
  background: rgba(0, 217, 255, 0.12) !important;
  color: #00d9ff !important;
  font-family: "Aileron", -apple-system, sans-serif !important;
  font-size: 11.5px !important;
  font-weight: 700 !important;
  letter-spacing: 0.3px !important;
  box-shadow: 0 0 12px rgba(0, 217, 255, 0.15) !important;
  transition: all 160ms cubic-bezier(0.16, 1, 0.3, 1) !important;
  touch-action: manipulation;
  user-select: none !important;
}

.pill-cyan-btn:hover:not(:disabled) {
  background: rgba(0, 217, 255, 0.25) !important;
  border-color: rgba(0, 217, 255, 0.85) !important;
  color: #ffffff !important;
  box-shadow: 0 0 18px rgba(0, 217, 255, 0.4) !important;
  transform: translateY(-1px) !important;
}

.pill-cyan-btn:active:not(:disabled) {
  transform: scale(0.96) !important;
}

.pill-cyan-btn:disabled {
  opacity: 0.5 !important;
  cursor: not-allowed !important;
  transform: none !important;
}

/* NEUTRAL CANCEL PILL BUTTON */
.pill-neutral-btn {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  height: 36px !important;
  padding: 0 18px !important;
  border-radius: 9999px !important;
  border: 1px solid rgba(255, 255, 255, 0.18) !important;
  background: rgba(255, 255, 255, 0.04) !important;
  color: #cbd5e1 !important;
  font-family: "Aileron", -apple-system, sans-serif !important;
  font-size: 11.5px !important;
  font-weight: 600 !important;
  transition: all 160ms ease !important;
  user-select: none !important;
}

.pill-neutral-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1) !important;
  color: #ffffff !important;
  border-color: rgba(255, 255, 255, 0.35) !important;
}

.pill-neutral-btn:active:not(:disabled) {
  transform: scale(0.96) !important;
}

/* INLINE SPINNER RING */
.spinner-ring {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border-width: 2px;
  border-style: solid;
  border-top-color: transparent !important;
  animation: spin 0.75s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>