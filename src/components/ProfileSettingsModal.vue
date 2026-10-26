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
const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');

// UI States
const isSubmitting = ref(false);
const showCurrentPassword = ref(false);
const showNewPassword = ref(false);
const errorMessage = ref('');
const successMessage = ref('');

const fetchUserEmail = async () => {
  const { data } = await supabase.auth.getUser();
  if (data?.user?.email) {
    userEmail.value = data.user.email;
  }
};

// Sync user profile data when modal opens
watch(
  () => props.isOpen,
  async (open) => {
    if (open) {
      if (authStore.user) {
        fullName.value = authStore.user.full_name || '';
        contactNumber.value = authStore.user.contact_number || '';
      }
      await fetchUserEmail();
      currentPassword.value = '';
      newPassword.value = '';
      confirmPassword.value = '';
      errorMessage.value = '';
      successMessage.value = '';
    }
  }
);

onMounted(async () => {
  await fetchUserEmail();
});

const handleSave = async () => {
  if (!authStore.user?.id) return;

  errorMessage.value = '';
  successMessage.value = '';

  if (!fullName.value.trim()) {
    errorMessage.value = 'Full name is required.';
    return;
  }

  // Password change validation
  if (newPassword.value || currentPassword.value) {
    if (!currentPassword.value) {
      errorMessage.value = 'Please enter your current password to authorize this change.';
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
    // 1. If password change is requested, verify current password first
    if (newPassword.value && currentPassword.value && userEmail.value) {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: userEmail.value,
        password: currentPassword.value,
      });

      if (verifyError) {
        throw new Error('Current password verification failed. Please check your current password.');
      }

      // Update to new password
      const { error: passwordError } = await supabase.auth.updateUser({
        password: newPassword.value,
      });

      if (passwordError) throw passwordError;
    }

    // 2. Update Profile Information (Name & Contact)
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.value.trim(),
        contact_number: contactNumber.value.trim() || null,
      })
      .eq('id', authStore.user.id);

    if (profileError) throw profileError;

    await authStore.fetchProfile();
    successMessage.value = 'Profile updated successfully!';
    currentPassword.value = '';
    newPassword.value = '';
    confirmPassword.value = '';

    setTimeout(() => {
      emit('saved');
      emit('close');
    }, 1200);
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
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm select-none overflow-y-auto"
  >
    <div class="w-full max-w-md my-auto trainext-glass-card rounded-[28px] p-6 flex flex-col gap-4 border border-white/20 shadow-2xl">
      
      <!-- HEADER -->
      <div class="flex items-center justify-between pb-2 border-b border-white/10">
        <div>
          <h2 class="text-base font-bold text-white tracking-tight">Account Settings</h2>
          <p class="text-[11px] text-[#00d9ff]">Manage your credentials and contact information.</p>
        </div>
        <button 
          type="button" 
          @click="emit('close')"
          class="text-slate-400 hover:text-white transition cursor-pointer p-1"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- FEEDBACK ALERTS -->
      <div v-if="errorMessage" class="p-2.5 rounded-xl bg-red-950/60 border border-red-500/40 text-xs text-red-200">
        {{ errorMessage }}
      </div>
      <div v-if="successMessage" class="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-200">
        {{ successMessage }}
      </div>

      <!-- FORM FIELDS -->
      <form @submit.prevent="handleSave" class="flex flex-col gap-3.5">
        
        <!-- FULL NAME -->
        <div class="flex flex-col gap-1">
          <label class="trainext-label">FULL NAME</label>
          <div class="trainext-spec-input-line flex items-center gap-2 pb-2">
            <svg class="w-3.5 h-3.5 text-[#00d9ff] shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="7.5" r="4" />
              <path d="M4 21v-2a8 8 0 0 1 16 0v2z" />
            </svg>
            <input 
              v-model="fullName" 
              type="text" 
              required
              placeholder="Juan Dela Cruz"
              class="w-full bg-transparent text-white text-xs placeholder:text-[#858994] outline-none"
            />
          </div>
        </div>

        <!-- EMAIL (READONLY) -->
        <div class="flex flex-col gap-1">
          <label class="trainext-label">EMAIL ADDRESS (SYSTEM LOCKED)</label>
          <div class="trainext-spec-input-line flex items-center gap-2 pb-2 opacity-60">
            <svg class="w-3.5 h-3.5 text-[#858994] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <input 
              :value="userEmail" 
              type="email" 
              disabled
              class="w-full bg-transparent text-slate-400 text-xs cursor-not-allowed outline-none"
            />
          </div>
        </div>

        <!-- CONTACT NUMBER -->
        <div class="flex flex-col gap-1">
          <label class="trainext-label">CONTACT NUMBER</label>
          <div class="trainext-spec-input-line flex items-center gap-2 pb-2">
            <svg class="w-3.5 h-3.5 text-[#00d9ff] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <input 
              v-model="contactNumber" 
              type="tel" 
              placeholder="e.g. +63 912 345 6789"
              class="w-full bg-transparent text-white text-xs placeholder:text-[#858994] outline-none"
            />
          </div>
        </div>

        <!-- CHANGE PASSWORD SECTION -->
        <div class="pt-2 border-t border-white/10 flex flex-col gap-3">
          <span class="trainext-label text-[#00d9ff]">SECURITY (LEAVE BLANK IF NO PASSWORD CHANGE)</span>

          <!-- 1. CURRENT PASSWORD -->
          <div class="flex flex-col gap-1">
            <label class="text-[9px] text-[#858994] uppercase tracking-wider font-semibold">Current Password</label>
            <div class="trainext-spec-input-line flex items-center gap-2 pb-2">
              <svg class="w-3.5 h-3.5 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <input 
                v-model="currentPassword" 
                :type="showCurrentPassword ? 'text' : 'password'"
                placeholder="Required to set new password"
                class="w-full bg-transparent text-white text-xs placeholder:text-[#858994] outline-none"
              />
              <button 
                type="button" 
                @click="showCurrentPassword = !showCurrentPassword"
                class="text-slate-400 hover:text-white transition cursor-pointer"
              >
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>
            </div>
          </div>

          <!-- 2. NEW PASSWORD -->
          <div class="flex flex-col gap-1">
            <label class="text-[9px] text-[#858994] uppercase tracking-wider font-semibold">New Password</label>
            <div class="trainext-spec-input-line flex items-center gap-2 pb-2">
              <svg class="w-3.5 h-3.5 text-[#00d9ff] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <input 
                v-model="newPassword" 
                :type="showNewPassword ? 'text' : 'password'"
                placeholder="Min. 8 characters"
                class="w-full bg-transparent text-white text-xs placeholder:text-[#858994] outline-none"
              />
              <button 
                type="button" 
                @click="showNewPassword = !showNewPassword"
                class="text-slate-400 hover:text-white transition cursor-pointer"
              >
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>
            </div>
          </div>

          <!-- 3. CONFIRM NEW PASSWORD -->
          <div v-if="newPassword" class="flex flex-col gap-1">
            <label class="text-[9px] text-[#858994] uppercase tracking-wider font-semibold">Confirm New Password</label>
            <div class="trainext-spec-input-line flex items-center gap-2 pb-2">
              <svg class="w-3.5 h-3.5 text-[#00d9ff] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <input 
                v-model="confirmPassword" 
                :type="showNewPassword ? 'text' : 'password'"
                placeholder="Re-type new password"
                class="w-full bg-transparent text-white text-xs placeholder:text-[#858994] outline-none"
              />
            </div>
          </div>
        </div>

        <!-- ACTIONS -->
        <div class="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
          <button 
            type="button" 
            @click="emit('close')"
            :disabled="isSubmitting"
            class="px-4 py-2 rounded-full border border-white/20 text-xs text-slate-300 hover:text-white transition cursor-pointer"
          >
            Cancel
          </button>

          <button 
            type="submit" 
            :disabled="isSubmitting"
            class="trainext-btn-pill-primary h-[38px] px-5 text-xs"
          >
            {{ isSubmitting ? 'VERIFYING...' : 'SAVE CHANGES' }}
          </button>
        </div>

      </form>

    </div>
  </div>
</template>