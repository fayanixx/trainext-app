  <script setup lang="ts">
  defineProps<{
    isOpen: boolean;
    companyName: string;
    formattedDistance: string;
    allowedRadius: number;
  }>();

  const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'retry'): void;
  }>();
  </script>

  <template>
    <div 
      v-if="isOpen" 
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none"
    >
      <div class="w-full max-w-sm trainext-glass-card rounded-[28px] p-6 flex flex-col items-center text-center gap-4 border border-rose-500/30 shadow-[0_0_30px_rgba(244,63,94,0.15)]">
        
        <!-- WARNING ICON -->
        <div class="w-12 h-12 rounded-full bg-rose-500/15 border border-rose-500/40 flex items-center justify-center text-rose-400">
          <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <!-- TITLE & DETAILS -->
        <div>
          <h2 class="text-base font-bold text-white tracking-tight">Outside Authorized Perimeter</h2>
          <p class="text-[11px] text-rose-300/90 mt-0.5">{{ companyName }}</p>
        </div>

        <!-- DISTANCE METRICS BADGE -->
        <div class="w-full p-3 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-around text-xs">
          <div class="flex flex-col">
            <span class="text-[8px] font-bold uppercase tracking-wider text-[#858994]">YOUR DISTANCE</span>
            <span class="text-rose-400 font-bold font-mono text-sm">{{ formattedDistance }}</span>
          </div>
          <div class="h-6 w-px bg-white/10"></div>
          <div class="flex flex-col">
            <span class="text-[8px] font-bold uppercase tracking-wider text-[#858994]">MAX ALLOWED</span>
            <span class="text-[#00d9ff] font-bold font-mono text-sm">{{ allowedRadius }}m</span>
          </div>
        </div>

        <p class="text-xs text-slate-300 leading-relaxed px-1">
          Your current GPS position is outside the designated training boundary. Please ensure you are within the workplace premises before attempting to clock in.
        </p>

        <!-- BUTTON ACTIONS -->
        <div class="w-full flex items-center justify-center gap-2 pt-2 border-t border-white/10">
          <button 
            type="button" 
            @click="emit('close')"
            class="flex-1 py-2 rounded-full border border-white/20 text-xs text-slate-300 hover:text-white transition cursor-pointer"
          >
            Dismiss
          </button>

          <button 
            type="button" 
            @click="emit('retry')"
            class="flex-1 trainext-btn-pill-primary h-[38px] text-xs"
          >
            Re-check GPS
          </button>
        </div>

      </div>
    </div>
  </template>