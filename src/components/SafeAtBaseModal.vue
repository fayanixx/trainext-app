  <script setup lang="ts">
  import { ref } from 'vue';
  import { supabase } from '@/lib/supabase';

  const props = defineProps<{
    isOpen: boolean;
    logId: string;
    internId: string;
  }>();

  const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'confirmed'): void;
  }>();

  const loading = ref(false);
  const errorMessage = ref('');

  const confirmSafeAtBase = async () => {
    if (!props.logId) return;

    loading.value = true;
    errorMessage.value = '';

    try {
      let lat: number | null = null;
      let lng: number | null = null;

      if ('geolocation' in navigator) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 8000,
            });
          });
          lat = position.coords.latitude;
          lng = position.coords.longitude;
        } catch (geoErr) {
          console.warn('Could not acquire precise base GPS, proceeding with timestamp only.', geoErr);
        }
      }

      const { error } = await supabase
        .from('attendance_logs')
        .update({
          status: 'safe_at_base',
          safe_at_base_time: new Date().toISOString(),
          safe_at_base_lat: lat,
          safe_at_base_lng: lng,
        })
        .eq('id', props.logId);

      if (error) throw error;

      emit('confirmed');
      emit('close');
    } catch (err: any) {
      errorMessage.value = err.message || 'Failed to record safe at base status.';
    } finally {
      loading.value = false;
    }
  };
  </script>

  <template>
    <div 
      v-if="isOpen" 
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm select-none"
    >
      <div class="w-full max-w-sm trainext-glass-card rounded-[28px] p-6 flex flex-col gap-5 border border-white/20 shadow-2xl">
        
        <!-- HEADER & ICON -->
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center shrink-0">
            <svg class="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <div>
            <h2 class="text-base font-bold text-white tracking-tight">Confirm Safe at Base</h2>
            <p class="text-[11px] text-[#00d9ff]">Verify arrival at home or safe quarters.</p>
          </div>
        </div>

        <!-- DESCRIPTION -->
        <p class="text-xs text-slate-300 leading-relaxed">
          This marks your shift as concluded and sends confirmation to your coordinator that you have returned safely from transit.
        </p>

        <!-- ERROR FEEDBACK -->
        <div v-if="errorMessage" class="p-2.5 rounded-xl bg-red-950/60 border border-red-500/40 text-xs text-red-200">
          {{ errorMessage }}
        </div>

        <!-- BUTTON ACTIONS -->
        <div class="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
          <button 
            type="button" 
            @click="emit('close')"
            :disabled="loading"
            class="px-4 py-2 rounded-full border border-white/20 text-xs text-slate-300 hover:text-white transition cursor-pointer"
          >
            Cancel
          </button>

          <button 
            type="button" 
            @click="confirmSafeAtBase"
            :disabled="loading"
            class="trainext-btn-pill-primary h-[38px] px-5 text-xs"
          >
            {{ loading ? 'VERIFYING...' : 'YES, I AM SAFE' }}
          </button>
        </div>

      </div>
    </div>
  </template>