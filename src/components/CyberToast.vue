<script setup lang="ts">
import { useToast } from '@/composables/useToast';

const { toasts, removeToast } = useToast();
</script>

<template>
  <div class="fixed top-5 right-5 z-[99999] flex flex-col gap-2.5 max-w-[360px] w-full pointer-events-none px-3">
    <transition-group
      enter-active-class="transform ease-out duration-300 transition"
      enter-from-class="translate-y-[-12px] opacity-0 scale-95"
      enter-to-class="translate-y-0 opacity-100 scale-100"
      leave-active-class="transition ease-in duration-200"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-90"
    >
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="pointer-events-auto rounded-2xl p-3.5 backdrop-blur-xl border flex items-start gap-3 shadow-2xl transition-all"
        :class="{
          'bg-[#061826]/85 border-[#00d9ff]/40 shadow-[0_0_20px_rgba(0,217,255,0.18)]': toast.type === 'info',
          'bg-[#051e14]/85 border-emerald-400/40 shadow-[0_0_20px_rgba(52,211,153,0.18)]': toast.type === 'success',
          'bg-[#22070c]/85 border-rose-500/40 shadow-[0_0_20px_rgba(244,63,94,0.22)]': toast.type === 'error',
          'bg-[#211604]/85 border-amber-400/40 shadow-[0_0_20px_rgba(251,191,36,0.18)]': toast.type === 'warning',
        }"
      >
        <!-- Icon -->
        <div class="shrink-0 mt-0.5">
          <svg v-if="toast.type === 'success'" class="w-4 h-4 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
          </svg>
          <svg v-else-if="toast.type === 'error'" class="w-4 h-4 text-rose-400" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
          <svg v-else-if="toast.type === 'warning'" class="w-4 h-4 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
          <svg v-else class="w-4 h-4 text-[#00d9ff]" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
          </svg>
        </div>

        <!-- Text Content -->
        <div class="flex-1 min-w-0">
          <p v-if="toast.title" class="text-[10px] font-bold tracking-[1.2px] uppercase mb-0.5 text-white/90">
            {{ toast.title }}
          </p>
          <p class="text-[12px] text-slate-200 leading-snug break-words">
            {{ toast.message }}
          </p>
        </div>

        <!-- Close Button -->
        <button
          type="button"
          @click="removeToast(toast.id)"
          class="shrink-0 text-slate-400 hover:text-white transition p-0.5"
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>
    </transition-group>
  </div>
</template>