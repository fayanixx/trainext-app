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

// Transform standard external links (YouTube, Loom) into embeddable URLs
const embedVideoUrl = computed(() => {
  if (!props.mediaUrl) return '';
  const url = props.mediaUrl.trim();

  // YouTube match
  const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{11})/);
  if (ytMatch) {
    return `https://www.youtube.com/embed/${ytMatch[1]}`;
  }

  // Loom match
  const loomMatch = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
  if (loomMatch) {
    return `https://www.loom.com/embed/${loomMatch[1]}`;
  }

  return url;
});

const isDirectVideoFile = computed(() => {
  if (!props.mediaUrl) return false;
  return /\.(mp4|webm|ogg|mov)$/i.test(props.mediaUrl);
});

const isPdf = computed(() => {
  if (!props.mediaUrl) return false;
  return /\.pdf$/i.test(props.mediaUrl);
});
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen && mediaUrl" class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-navy-950/85 backdrop-blur-md">
      <!-- Backdrop dismiss -->
      <div class="fixed inset-0" @click="emit('close')"></div>

      <!-- Viewer Container -->
      <div 
        class="relative w-full max-w-4xl max-h-[90vh] bg-[#0d1527]/95 border border-cyan-500/35 rounded-3xl
               shadow-[0_0_50px_rgba(6,182,212,0.25)] text-slate-100 z-10 backdrop-blur-2xl flex flex-col overflow-hidden"
      >
        <!-- Modal Top Bar -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-900/50">
          <div class="truncate max-w-[80%]">
            <h3 class="text-sm font-bold text-white tracking-wide truncate">
              {{ title || 'Proof Attachment Inspector' }}
            </h3>
            <span class="text-[10px] uppercase font-mono tracking-widest text-cyan-400">
              Type: {{ mediaType }}
            </span>
          </div>

          <div class="flex items-center gap-2">
            <a 
              :href="mediaUrl" 
              target="_blank" 
              rel="noopener noreferrer"
              class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-300 hover:text-white transition flex items-center gap-1"
            >
              <span>↗</span>
              <span>Open External</span>
            </a>
            <button 
              @click="emit('close')"
              class="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-sm transition"
            >
              ✕
            </button>
          </div>
        </div>

        <!-- Dynamic Content Viewer Area -->
        <div class="flex-1 p-4 sm:p-6 overflow-y-auto flex items-center justify-center min-h-[300px] bg-slate-950/40">
          
          <!-- 1. IMAGE VIEWER -->
          <div v-if="mediaType === 'image'" class="max-h-[70vh] flex items-center justify-center">
            <img 
              :src="mediaUrl" 
              alt="Accomplishment Proof" 
              class="max-h-[70vh] max-w-full rounded-2xl object-contain border border-slate-800 shadow-2xl"
            />
          </div>

          <!-- 2. DOCUMENT VIEWER -->
          <div v-else-if="mediaType === 'document'" class="w-full h-[65vh] flex flex-col items-center justify-center">
            <iframe 
              v-if="isPdf" 
              :src="mediaUrl" 
              class="w-full h-full rounded-2xl border border-slate-800 bg-white"
            ></iframe>
            <div v-else class="text-center p-8 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
              <div class="text-4xl">📄</div>
              <p class="text-sm text-slate-200 font-semibold truncate max-w-md">
                {{ mediaUrl.split('/').pop() }}
              </p>
              <p class="text-xs text-slate-400">
                Direct browser preview is not supported for this file type (DOCX/Binary).
              </p>
              <a 
                :href="mediaUrl" 
                download
                class="inline-block px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition"
              >
                Download Document
              </a>
            </div>
          </div>

          <!-- 3. VIDEO VIEWER -->
          <div v-else-if="mediaType === 'video'" class="w-full h-[65vh] flex items-center justify-center">
            <!-- Native Video Tag for uploaded files -->
            <video 
              v-if="isDirectVideoFile" 
              :src="mediaUrl" 
              controls 
              autoplay 
              class="max-h-[65vh] max-w-full rounded-2xl border border-slate-800 bg-black"
            ></video>

            <!-- Embedded Player for external platforms (YouTube/Loom) -->
            <iframe 
              v-else 
              :src="embedVideoUrl" 
              class="w-full h-full rounded-2xl border border-slate-800"
              allowfullscreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            ></iframe>
          </div>
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