<script setup lang="ts">
import { ref } from 'vue';
import { useAttendanceStore } from '@/stores/attendance';

const props = defineProps<{
  isOpen: boolean;
  logId: string;
  internId: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'confirmed'): void;
}>();

const attendanceStore = useAttendanceStore();
const loading = ref(false);
const errorMessage = ref('');
const transitNotes = ref('');

const confirmSafeAtBase = async () => {
  if (!props.logId) return;

  loading.value = true;
  errorMessage.value = '';

  try {
    let lat: number | undefined = undefined;
    let lng: number | undefined = undefined;

    if ('geolocation' in navigator) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 10000,
          });
        });
        lat = position.coords.latitude;
        lng = position.coords.longitude;
      } catch (geoErr) {
        console.warn('Could not acquire precise base GPS, proceeding with timestamp only.', geoErr);
      }
    }

    // Gamitin ang store method para synchronized ang state at safe ang column payload
    await attendanceStore.confirmSafeAtBase({
      logId: props.logId,
      internId: props.internId,
      latitude: lat,
      longitude: lng,
      transitNotes: transitNotes.value.trim() || undefined,
    });

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
    <div class="w-full max-w-sm trainext-glass-card rounded-[28px] p-6 flex flex-col gap-4 border border-white/20 shadow-2xl">
      
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
        This marks your shift as officially concluded and confirms to your coordinator and supervisor that you have arrived safely from transit.
      </p>

      <!-- TRANSIT REMARKS (OPTIONAL) -->
      <div class="flex flex-col gap-1">
        <label class="trainext-label">OPTIONAL TRANSIT NOTE</label>
        <input 
          v-model="transitNotes"
          type="text"
          placeholder="e.g. Arrived safely at boarding house"
          class="w-full h-8 px-3 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder:text-[#858994] outline-none focus:border-[#00d9ff]"
        />
      </div>

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