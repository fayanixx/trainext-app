<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{
  isOpen: boolean;
  htmlContent: string;
  title?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const previewFrame = ref<HTMLIFrameElement | null>(null);
const isRendering = ref(false);

// I-wrap ang raw HTML sa responsive mobile-friendly container para sa iframe srcdoc
const framedHtmlContent = computed(() => {
  if (!props.htmlContent) return '';
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <style>
        *, *::before, *::after {
          box-sizing: border-box;
        }
        html, body {
          margin: 0;
          padding: 0;
          background: #ffffff;
          color: #111827;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          -webkit-text-size-adjust: 100%;
        }
        body {
          padding: 12px;
          overflow-x: auto;
        }
        @media print {
          body {
            padding: 0;
          }
        }
        table {
          width: 100% !important;
          max-width: 100% !important;
          border-collapse: collapse;
        }
      </style>
    </head>
    <body>
      ${props.htmlContent}
    </body>
    </html>
  `;
});

const handlePrintFromFrame = () => {
  try {
    if (previewFrame.value?.contentWindow) {
      previewFrame.value.contentWindow.focus();
      previewFrame.value.contentWindow.print();
    }
  } catch (err) {
    console.warn('Direct frame print restricted on mobile device.', err);
  }
};
</script>

<template>
  <div 
    v-if="isOpen" 
    class="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-5 bg-black/90 backdrop-blur-md select-none overflow-y-auto"
  >
    <div class="w-full max-w-4xl h-[92vh] sm:h-[90vh] my-auto rounded-[24px] bg-[#050811]/95 border border-white/15 shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      
      <!-- MODAL TOP BAR -->
      <header class="px-4 sm:px-5 py-3.5 border-b border-white/10 flex items-center justify-between gap-3 bg-white/[0.015] shrink-0">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-[#00d9ff] shrink-0">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div class="min-w-0">
            <p class="text-[15px] sm:text-[18px] font-bold text-white tracking-wide truncate font-['Aileron',sans-serif]">
              {{ title || 'Document Verification Preview' }}
            </p>
            <p class="text-[10px] text-[#00d9ff] font-mono tracking-wider">
              FORMAL LETTERHEAD AUDIT
            </p>
          </div>
        </div>

        <!-- ACTIONS -->
        <div class="flex items-center gap-2 shrink-0">
          <button 
            type="button" 
            @click="handlePrintFromFrame"
            class="pill-cyan-btn cursor-pointer whitespace-nowrap"
            title="Print or export as PDF"
          >
            <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            <span>Print / Save PDF</span>
          </button>

          <button 
            type="button" 
            @click="emit('close')"
            class="w-8 h-8 rounded-full border border-white/15 bg-white/[0.03] text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
            aria-label="Close Preview"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </header>

      <!-- PREVIEW FRAME CONTAINER -->
      <div class="flex-1 p-2 sm:p-5 bg-black/60 overflow-hidden flex justify-center relative">
        <div class="w-full max-w-[820px] h-full rounded-2xl bg-white shadow-2xl overflow-hidden border border-white/10 relative">
          
          <iframe 
            ref="previewFrame"
            :srcdoc="framedHtmlContent"
            class="w-full h-full border-0 bg-white"
            title="PDF Document Preview"
            sandbox="allow-same-origin allow-scripts allow-modals"
          ></iframe>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.pill-cyan-btn {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 6px !important;
  height: 34px !important;
  padding: 0 14px !important;
  border-radius: 9999px !important;
  border: 1px solid rgba(0, 217, 255, 0.5) !important;
  background: rgba(0, 217, 255, 0.12) !important;
  color: #00d9ff !important;
  font-family: "Aileron", -apple-system, sans-serif !important;
  font-size: 11px !important;
  font-weight: 700 !important;
  letter-spacing: 0.3px !important;
  box-shadow: 0 0 12px rgba(0, 217, 255, 0.15) !important;
  transition: all 160ms cubic-bezier(0.16, 1, 0.3, 1) !important;
  touch-action: manipulation;
  user-select: none !important;
}

.pill-cyan-btn:hover:not(:disabled) {
  background: rgba(0, 217, 255, 0.25) !important;
  border-color: rgba(0, 217, 255, 0.85) !important;
  color: #ffffff !important;
  box-shadow: 0 0 18px rgba(0, 217, 255, 0.4) !important;
  transform: translateY(-1px) !important;
}

.pill-cyan-btn:active:not(:disabled) {
  transform: scale(0.96) !important;
}
</style>