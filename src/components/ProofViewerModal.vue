<script setup lang="ts">
import { ref, computed, watch } from 'vue';

const props = defineProps<{
  isOpen: boolean;
  mediaUrl: string | null;
  mediaType: 'image' | 'document' | 'video' | null;
  title?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const isIframeLoading = ref(true);

const isPdf = computed(() => {
  if (!props.mediaUrl) return false;
  return props.mediaUrl.toLowerCase().includes('.pdf');
});

// PDF / Document In-Frame Viewer URL
const inFrameViewerUrl = computed(() => {
  if (!props.mediaUrl) return '';
  if (isPdf.value) {
    return `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(props.mediaUrl)}`;
  }
  return `https://docs.google.com/viewer?url=${encodeURIComponent(props.mediaUrl)}&embedded=true`;
});

// Suriin kung YouTube video o Direct File (MP4/WebM/MOV)
const isYouTubeVideo = computed(() => {
  if (!props.mediaUrl) return false;
  return props.mediaUrl.includes('youtube.com') || props.mediaUrl.includes('youtu.be');
});

// Matatag na YouTube URL Parser na may playsinline=1 para sa phone
const getEmbedVideoUrl = (url: string): string => {
  if (!url) return '';
  
  let videoId = '';
  
  if (url.includes('youtu.be/')) {
    videoId = url.split('youtu.be/')[1]?.split('?')[0] || '';
  } else if (url.includes('youtube.com/shorts/')) {
    videoId = url.split('youtube.com/shorts/')[1]?.split('?')[0] || '';
  } else if (url.includes('watch?v=')) {
    const urlParams = new URLSearchParams(url.split('?')[1]);
    videoId = urlParams.get('v') || '';
  } else if (url.includes('youtube.com/embed/')) {
    videoId = url.split('youtube.com/embed/')[1]?.split('?')[0] || '';
  }

  if (videoId) {
    return `https://www.youtube.com/embed/${videoId}?playsinline=1&autoplay=0&rel=0&modestbranding=1`;
  }

  return url;
};

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      isIframeLoading.value = true;
    }
  }
);
</script>

<template>
  <div 
    v-if="isOpen && mediaUrl" 
    class="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-black/90 backdrop-blur-md select-none overflow-y-auto"
  >
    <div class="w-full max-w-4xl h-[88vh] sm:h-[90vh] my-auto rounded-[24px] bg-[#050811]/95 border border-white/15 shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      
      <!-- TOP HEADER BAR -->
      <header class="px-5 py-3.5 border-b border-white/10 flex items-center justify-between gap-3 bg-white/[0.015] shrink-0">
        <div class="min-w-0 flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-[#00d9ff] shrink-0">
            <!-- IMAGE ICON -->
            <svg v-if="mediaType === 'image'" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <!-- DOCUMENT ICON -->
            <svg v-else-if="mediaType === 'document'" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <!-- VIDEO ICON -->
            <svg v-else class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>

          <div class="min-w-0">
            <p class="text-[15px] font-bold text-white tracking-wide truncate font-['Aileron',sans-serif]">
              {{ title || 'Proof Verification Preview' }}
            </p>
            <p class="text-[10px] text-[#00d9ff] font-mono tracking-wider">
              {{ mediaType?.toUpperCase() }} PREVIEW
            </p>
          </div>
        </div>

        <!-- CLOSE BUTTON -->
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
      </header>

      <!-- MEDIA VIEWER CONTAINER -->
      <div class="flex-1 p-3 sm:p-5 bg-black/60 overflow-hidden flex items-center justify-center relative">
        
        <!-- 1. IMAGE PREVIEW -->
        <div v-if="mediaType === 'image'" class="w-full h-full flex items-center justify-center overflow-auto p-2">
          <img 
            :src="mediaUrl" 
            alt="Proof Verification" 
            class="max-w-full max-h-full object-contain rounded-2xl border border-white/10 shadow-2xl transition-transform"
          />
        </div>

        <!-- 2. DOCUMENT / PDF IN-APP IN-FRAME PREVIEW -->
        <div v-else-if="mediaType === 'document'" class="w-full h-full rounded-2xl overflow-hidden border border-white/15 bg-white relative flex flex-col">
          <div v-if="isIframeLoading" class="absolute inset-0 bg-[#070b12] flex flex-col items-center justify-center gap-2.5 z-10">
            <div class="spinner-ring border-[#00d9ff]"></div>
            <span class="text-[10px] font-mono text-slate-400 tracking-wider">Rendering document in frame...</span>
          </div>

          <iframe 
            :src="inFrameViewerUrl" 
            class="w-full h-full border-0"
            title="Document In-App Frame Preview"
            @load="isIframeLoading = false"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          ></iframe>
        </div>

        <!-- 3. VIDEO PREVIEW (TUGMA SA YOUTUBE AT DIRECT VIDEO FILES) -->
        <div v-else-if="mediaType === 'video'" class="w-full h-full max-w-3xl aspect-video rounded-2xl overflow-hidden border border-white/20 bg-black relative flex items-center justify-center shadow-2xl">
          <!-- KUNG YOUTUBE EMBED -->
          <iframe 
            v-if="isYouTubeVideo"
            :src="getEmbedVideoUrl(mediaUrl)" 
            class="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen
            playsinline
          ></iframe>

          <!-- KUNG DIRECT VIDEO FILE (MP4/WEBM/MOV MULA SA STORAGE) -->
          <video 
            v-else
            :src="mediaUrl" 
            controls 
            playsinline 
            webkit-playsinline
            preload="metadata"
            class="w-full h-full object-contain bg-black"
          >
            Your browser does not support inline video playback.
          </video>
        </div>

      </div>

    </div>
  </div>
</template>

<style scoped>
/* SPINNER RING */
.spinner-ring {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border-width: 2px;
  border-style: solid;
  border-top-color: transparent !important;
  animation: spin 0.75s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>