<script setup lang="ts">
withDefaults(
  defineProps<{
    label?: string;
  }>(),
  {
    label: 'Loading...',
  }
);
</script>

<template>
  <div class="fixed inset-0 z-[9999] flex flex-col items-center justify-center select-none p-6 animate-in fade-in duration-300 overflow-hidden bg-[#050b14]">
    <!-- Mismong Railway Background ng TraiNext -->
    <div class="trainext-bg-railway" aria-hidden="true"></div>
    <div class="trainext-bg-overlay opacity-90" aria-hidden="true"></div>

    <!-- Centered Content -->
    <div class="relative z-10 flex flex-col items-center justify-center gap-7">
      <!-- Malaking Logo sa Taas -->
      <img
        src="/assets/trainext-logo.png"
        alt="TraiNext"
        class="w-37 sm:w-45 h-auto object-contain drop-shadow-[0_0_30px_rgba(0,217,255,0.4)]"
      />

      <!-- Spinner at Centered Loading Text sa Ibaba -->
      <div class="flex flex-col items-center gap-3">
        <div class="w-8 h-8 rounded-full border-2 border-white/10 border-t-[#00d9ff] border-r-[#00d9ff]/50 animate-spin"></div>
        <p class="text-xs font-semibold tracking-widest text-slate-300 uppercase font-mono text-center">
          {{ label || 'Loading...' }}
        </p>
      </div>
    </div>
  </div>
</template>