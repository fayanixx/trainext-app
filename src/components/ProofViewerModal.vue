<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  isOpen: boolean;
  mediaUrl: string | null;
  mediaType: 'image' | 'document' | 'video' | null;
  title?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const isPdf = computed(() => {
  if (!props.mediaUrl) return false;
  return props.mediaUrl.toLowerCase().includes('.pdf');
});

// Google Docs Viewer embed para sa .docx, .doc, at .pdf
const docViewerUrl = computed(() => {
  if (!props.mediaUrl) return '';
  if (isPdf.value) return props.mediaUrl;
  return `https://docs.google.com/viewer?url=${encodeURIComponent(props.mediaUrl)}&embedded=true`;
});

const getEmbedVideoUrl = (url: string): string => {
  if (!url) return '';
  if (url.includes('youtube.com/watch?v=')) {
    return url.replace('watch?v=', 'embed/');
  }
  if (url.includes('youtu.be/')) {
    return url.replace('youtu.be/', 'youtube.com/embed/');
  }
  return url;
};
</script>

<template>
  <div 
    v-if="isOpen && mediaUrl" 
    class="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-black/90 backdrop-blur-md select-none"
  >
    <div class="trainext-glass-card w-full max-w-4xl h-[90vh] flex flex-col rounded-3xl border border-white/20 bg-[#070b12]/95 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
      
      <!-- TOP BAR -->
      <div class="px-5 py-3.5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
        <div class="min-w-0 pr-3">
          <h3 class="text-xs sm:text-sm font-bold text-white tracking-wide uppercase truncate">
            {{ title || 'Proof Verification Preview' }}
          </h3>
          <p class="text-[10px] text-[#00d9ff] font-mono">
            {{ mediaType?.toUpperCase() }} PREVIEW
          </p>
        </div>

        <div class="flex items-center gap-2">
          <!-- Download / Open External Link -->
          <a 
            :href="mediaUrl" 
            target="_blank" 
            rel="noopener noreferrer"
            class="px-3 py-1.5 rounded-full border border-white/20 text-xs text-slate-300 hover:text-white hover:border-[#00d9ff]/50 transition flex items-center gap-1.5 cursor-pointer"
          >
            <span>External</span>
            <svg class="w-3 h-3 text-[#00d9ff]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>

          <button 
            type="button" 
            @click="emit('close')"
            class="w-8 h-8 rounded-full border border-white/20 text-slate-400 hover:text-white hover:bg-white/10 transition flex items-center justify-center cursor-pointer"
          >
            ✕
          </button>
        </div>
      </div>

      <!-- MEDIA VIEWER CONTAINER -->
      <div class="flex-1 p-3 sm:p-5 bg-black/60 overflow-hidden flex items-center justify-center">
        <!-- 1. IMAGE PREVIEW -->
        <img 
          v-if="mediaType === 'image'" 
          :src="mediaUrl" 
          alt="Proof Verification" 
          class="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
        />

        <!-- 2. DOCUMENT / PDF IN-APP PREVIEW IFRAME -->
        <div v-else-if="mediaType === 'document'" class="w-full h-full rounded-xl overflow-hidden border border-white/15 bg-white">
          <iframe 
            :src="docViewerUrl" 
            class="w-full h-full border-0"
            title="Document In-App Preview"
          ></iframe>
        </div>

        <!-- 3. VIDEO PREVIEW -->
        <div v-else-if="mediaType === 'video'" class="w-full h-full max-w-3xl aspect-video rounded-xl overflow-hidden border border-white/20 bg-black">
          <iframe 
            :src="getEmbedVideoUrl(mediaUrl)" 
            class="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
          ></iframe>
        </div>
      </div>

    </div>
  </div>
</template>