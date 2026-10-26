<script setup lang="ts">
import { ref } from 'vue';

defineProps<{
  isOpen: boolean;
  loading?: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'confirm'): void;
}>();

const agreedToWaiver = ref(false);
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-navy-950/80 backdrop-blur-md">
      <!-- Backdrop Dismiss -->
      <div class="fixed inset-0" @click="emit('close')"></div>

      <!-- Glass Modal Sheet -->
      <div 
        class="relative w-full sm:max-w-md p-6 bg-[#0d1527]/95 border-t sm:border border-emerald-500/40 rounded-t-[2.5rem] sm:rounded-3xl
               shadow-[0_0_50px_rgba(16,185,129,0.2)] text-slate-100 z-10 backdrop-blur-2xl space-y-5 animate-in slide-in-from-bottom duration-200"
      >
        <!-- Mobile Drawer Drag Handle -->
        <div class="sm:hidden w-12 h-1 bg-slate-600/60 rounded-full mx-auto mb-2"></div>

        <!-- Header with Safety Shield Icon -->
        <div class="flex items-start gap-4">
          <div class="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-300 text-2xl shadow-[0_0_20px_rgba(16,185,129,0.3)] shrink-0">
            🛡️
          </div>
          <div>
            <h3 class="text-base font-bold text-white tracking-wide">
              Confirm Safe at Base
            </h3>
            <p class="text-xs text-emerald-400 font-medium mt-0.5">
              Conclude Daily Transit Accountability
            </p>
          </div>
        </div>

        <!-- Description & Legal Waiver Box -->
        <div class="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
          <p class="text-xs text-slate-300 leading-relaxed">
            By checking in, you certify that you have safely arrived at your designated residence, dorm, or boarding home following today's training shift.
          </p>

          <div class="pt-2 border-t border-slate-800 flex items-start gap-3">
            <input 
              id="waiver-check"
              v-model="agreedToWaiver"
              type="checkbox" 
              class="w-4 h-4 mt-0.5 rounded text-emerald-500 bg-slate-800 border-slate-700 focus:ring-emerald-400"
            />
            <label for="waiver-check" class="text-[11px] text-slate-400 leading-snug cursor-pointer select-none">
              I acknowledge that this action digitalizes the conclusion of the institution's transit monitoring for this shift.
            </label>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="pt-2 flex items-center justify-end gap-2.5">
          <button 
            type="button" 
            @click="emit('close')"
            class="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition"
          >
            Cancel
          </button>
          <button 
            type="button" 
            @click="emit('confirm')"
            :disabled="!agreedToWaiver || loading"
            class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {{ loading ? 'Logging Arrival...' : 'Confirm & Log Arrival' }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>