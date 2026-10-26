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
  <Transition name="fade">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-navy-950/80 backdrop-blur-md">
      <!-- Backdrop Click to Dismiss -->
      <div class="fixed inset-0" @click="emit('close')"></div>

      <!-- Glass Alert Modal Container -->
      <div 
        class="relative w-full sm:max-w-md p-6 bg-[#0d1527]/95 border-t sm:border border-amber-500/40 rounded-t-[2.5rem] sm:rounded-3xl
               shadow-[0_0_50px_rgba(245,158,11,0.2)] text-slate-100 z-10 backdrop-blur-2xl space-y-5 animate-in slide-in-from-bottom duration-200"
      >
        <!-- Mobile Drawer Drag Handle -->
        <div class="sm:hidden w-12 h-1 bg-slate-600/60 rounded-full mx-auto mb-2"></div>

        <!-- Warning Icon & Title -->
        <div class="flex items-start gap-4">
          <div class="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300 text-2xl shadow-[0_0_20px_rgba(245,158,11,0.3)] shrink-0">
            📍
          </div>
          <div>
            <h3 class="text-base font-bold text-white tracking-wide">
              Outside Geofence Perimeter
            </h3>
            <p class="text-xs text-amber-400 font-medium mt-0.5">
              Time-In Request Blocked
            </p>
          </div>
        </div>

        <!-- Distance Alert Detail Box -->
        <div class="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
          <p class="text-xs text-slate-300 leading-relaxed">
            You are currently <span class="font-bold text-amber-300 font-mono">{{ formattedDistance }}</span> away from <span class="font-bold text-white">{{ companyName }}</span>.
          </p>
          <div class="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
            <span>Allowed Office Radius:</span>
            <span class="font-mono text-cyan-400 font-bold">{{ allowedRadius }} meters</span>
          </div>
        </div>

        <p class="text-[11px] text-slate-400 leading-relaxed">
          Time-In verification requires you to be physically inside the designated office coordinates set by your supervisor. Please approach the office building and try again.
        </p>

        <!-- Actions -->
        <div class="pt-2 flex items-center justify-end gap-2.5">
          <button 
            type="button" 
            @click="emit('close')"
            class="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition"
          >
            Dismiss
          </button>
          <button 
            type="button" 
            @click="emit('retry')"
            class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg transition"
          >
            Retry GPS Check
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