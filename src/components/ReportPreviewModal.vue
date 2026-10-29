<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';

const props = defineProps<{
  isOpen: boolean;
  htmlContent: string;
  title?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const previewFrame = ref<HTMLIFrameElement | null>(null);

const renderIframeContent = () => {
  nextTick(() => {
    if (previewFrame.value && props.htmlContent) {
      const doc = previewFrame.value.contentDocument || previewFrame.value.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(props.htmlContent);
        doc.close();
      }
    }
  });
};

watch(
  () => [props.isOpen, props.htmlContent],
  ([open]) => {
    if (open) {
      setTimeout(renderIframeContent, 100);
    }
  }
);

const handlePrintFromFrame = () => {
  if (previewFrame.value?.contentWindow) {
    previewFrame.value.contentWindow.focus();
    previewFrame.value.contentWindow.print();
  }
};
</script>

<template>
  <div 
    v-if="isOpen" 
    class="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md"
  >
    <div class="trainext-glass-card w-full max-w-4xl h-[92vh] flex flex-col rounded-3xl border border-white/20 bg-[#070b12]/90 shadow-[0_0_50px_rgba(0,217,255,0.15)] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      
      <!-- MODAL TOP BAR -->
      <div class="px-5 py-3.5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-[#00d9ff]">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h2 class="text-xs sm:text-sm font-bold text-white tracking-wide uppercase">
              {{ title || 'Document Print Preview' }}
            </h2>
            <p class="text-[10px] text-[#00d9ff] font-mono">Formal A4 Letterhead Layout</p>
          </div>
        </div>

        <!-- ACTIONS -->
        <div class="flex items-center gap-2">
          <button 
            type="button" 
            @click="handlePrintFromFrame"
            class="trainext-btn-pill-primary h-8 px-4 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            <span>Print / Save PDF</span>
          </button>

          <button 
            type="button" 
            @click="emit('close')"
            class="w-8 h-8 rounded-full border border-white/20 text-slate-400 hover:text-white hover:bg-white/10 transition flex items-center justify-center cursor-pointer"
          >
            ✕
          </button>
        </div>
      </div>

      <!-- PREVIEW FRAME CONTAINER -->
      <div class="flex-1 p-3 sm:p-5 bg-[#03060a] overflow-hidden flex justify-center">
        <div class="w-full max-w-[820px] h-full rounded-xl bg-white shadow-2xl overflow-hidden border border-slate-300">
          <iframe 
            ref="previewFrame"
            class="w-full h-full border-0"
            title="PDF Document Preview"
          ></iframe>
        </div>
      </div>

    </div>
  </div>
</template>