  <script setup lang="ts">
  import { ref } from 'vue';
  import { useRouter } from 'vue-router';
  import { supabase } from '@/lib/supabase';

  const router = useRouter();

  const email = ref('');
  const loading = ref(false);
  const errorMessage = ref('');
  const successMessage = ref('');

  const handleReset = async () => {
    errorMessage.value = '';
    successMessage.value = '';

    if (!email.value.trim()) {
      errorMessage.value = 'Please provide your registered email address.';
      return;
    }

    loading.value = true;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.value.trim(), {
        redirectTo: `${window.location.origin}/auth?reset=true`,
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
        <div class="w-full flex justify-center mb-8">
          <img 
            src="/assets/trainext-logo.png" 
            alt="TraiNext Logo" 
            class="w-[118px] h-auto object-contain"
          />
        </div>

        <!-- FROSTED GLASS CARD -->
        <div class="w-full trainext-spec-glass p-6 sm:p-8 flex flex-col">
          
          <!-- HEADINGS -->
          <div class="mb-6">
            <h1 class="text-white text-[30px] font-bold tracking-[-0.8px] leading-tight">
              Reset Password
            </h1>
            <p class="text-[#00D9FF] text-[13px] font-normal mt-1 leading-snug">
              Enter your account email to receive recovery instructions.
            </p>
          </div>

          <!-- FEEDBACK NOTIFICATIONS -->
          <div v-if="errorMessage" class="mb-4 p-2.5 rounded-xl bg-red-950/80 border border-red-500/50 text-[11px] text-red-200">
            {{ errorMessage }}
          </div>
          <div v-if="successMessage" class="mb-4 p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-[11px] text-emerald-200">
            {{ successMessage }}
          </div>

          <!-- FORM -->
          <form @submit.prevent="handleReset" class="flex flex-col">
            
            <!-- EMAIL INPUT -->
            <div class="mb-7">
              <label class="block text-[8.5px] font-semibold text-[#cbd5e1] tracking-[1.2px] uppercase mb-1.5">
                REGISTERED EMAIL
              </label>
              <div class="trainext-spec-input-line flex items-center gap-2.5 pb-2">
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

            <!-- PRIMARY SUBMIT BUTTON -->
            <div class="flex justify-center mb-6">
              <button 
                type="submit" 
                :disabled="loading"
                class="trainext-spec-btn-primary w-[190px]"
              >
                {{ loading ? 'SENDING...' : 'SEND RESET LINK' }}
              </button>
            </div>

            <!-- BACK TO SIGN IN LINK -->
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

        </div>

        <!-- FOOTER TAGLINE -->
        <div class="text-center mt-7 text-[9.5px] tracking-[0.5px]">
          <span class="text-white/80 font-normal">Smart Tracking. </span>
          <span class="text-[#00D9FF] font-semibold">Real-Time Safety.</span>
        </div>

      </div>
    </main>
  </template>