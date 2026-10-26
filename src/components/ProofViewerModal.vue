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

  // Embed Formatter for YouTube / Drive links
  const formattedVideoEmbedUrl = computed(() => {
    if (!props.mediaUrl) return '';
    const url = props.mediaUrl;

    // YouTube standard watch link
    if (url.includes('youtube.com/watch?v=')) {
      const videoId = url.split('v=')[1]?.split('&')[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }
    // YouTube shortened link
    if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1]?.split('?')[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }
    // Google Drive preview link
    if (url.includes('drive.google.com') && url.includes('/view')) {
      return url.replace('/view', '/preview');
    }

    return url;
  });
  </script>

  <template>
    <div 
      v-if="isOpen && mediaUrl" 
      class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md select-none overflow-y-auto"
    >
      <div class="w-full max-w-3xl my-auto trainext-glass-card rounded-[28px] p-5 sm:p-6 flex flex-col gap-4 border border-white/20 shadow-2xl">
        
        <!-- HEADER -->
        <div class="flex items-center justify-between pb-3 border-b border-white/10">
          <div>
            <span class="trainext-label">{{ mediaType ? mediaType.toUpperCase() : 'VERIFICATION PROOF' }}</span>
            <h2 class="text-base font-bold text-white tracking-tight truncate max-w-sm sm:max-w-md">
              {{ title || 'Accomplishment Attachment' }}
            </h2>
          </div>

          <div class="flex items-center gap-2">
            <!-- Open Raw Link in New Tab -->
            <a 
              :href="mediaUrl" 
              target="_blank" 
              rel="noopener noreferrer"
              class="px-3 py-1.5 rounded-full border border-white/20 text-[10px] text-slate-300 hover:text-white transition flex items-center gap-1.5 cursor-pointer"
            >
              <svg class="w-3.5 h-3.5 text-[#00d9ff]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              <span class="hidden sm:inline">Open Original</span>
            </a>

            <!-- Close Modal -->
            <button 
              type="button" 
              @click="emit('close')"
              class="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-slate-400 hover:text-white transition cursor-pointer"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <!-- MEDIA DISPLAY CONTAINER -->
        <div class="w-full min-h-[300px] max-h-[70vh] rounded-2xl bg-black/60 border border-white/10 flex items-center justify-center overflow-hidden">
          
          <!-- 1. IMAGE VIEWER -->
          <div v-if="mediaType === 'image'" class="w-full h-full flex items-center justify-center p-2">
            <img 
              :src="mediaUrl" 
              alt="Proof Document" 
              class="max-w-full max-h-[65vh] object-contain rounded-xl"
            />
          </div>

          <!-- 2. DOCUMENT / PDF VIEWER -->
          <div v-else-if="mediaType === 'document'" class="w-full h-[65vh]">
            <iframe 
              :src="mediaUrl" 
              class="w-full h-full border-0 rounded-xl bg-white/5"
              title="Attached Document"
            ></iframe>
          </div>

          <!-- 3. VIDEO / EMBED PLAYER -->
          <div v-else-if="mediaType === 'video'" class="w-full aspect-video max-h-[65vh]">
            <iframe 
              :src="formattedVideoEmbedUrl" 
              class="w-full h-full border-0 rounded-xl"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
              allowfullscreen
              title="Proof Video"
            ></iframe>
          </div>

          <!-- FALLBACK -->
          <div v-else class="text-center p-8 text-xs text-[#858994]">
            Unable to preview this file format directly. Please click "Open Original" above.
          </div>

        </div>

        <!-- FOOTER CLOSE -->
        <div class="flex justify-end pt-1">
          <button 
            type="button" 
            @click="emit('close')"
            class="trainext-btn-pill-primary h-[36px] px-6 text-xs"
          >
            CLOSE
          </button>
        </div>

      </div>
    </div>
  </template>