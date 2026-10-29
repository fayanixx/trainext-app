<script setup lang="ts">
import { ref } from 'vue';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/composables/useToast';

const props = defineProps<{
  isOpen: boolean;
  internId: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'saved'): void;
}>();

const toast = useToast();

// Form Fields
const title = ref('');
const description = ref('');
const reportDate = ref(new Date().toISOString().split('T')[0]);
const videoUrl = ref('');

// Media Attachments State
const imageFiles = ref<File[]>([]);
const docFiles = ref<File[]>([]);
const isUploading = ref(false);
const errorMessage = ref('');

const handleImageChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files) {
    imageFiles.value = Array.from(target.files);
  }
};

const handleDocChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files) {
    docFiles.value = Array.from(target.files);
  }
};

const uploadFilesToBucket = async (files: File[], folder: string): Promise<string[]> => {
  const urls: string[] = [];
  for (const file of files) {
    const fileExt = file.name.split('.').pop();
    const filePath = `${props.internId}/${folder}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('proofs')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('proofs').getPublicUrl(filePath);
    if (data?.publicUrl) {
      urls.push(data.publicUrl);
    }
  }
  return urls;
};

const handleSubmit = async () => {
  if (!title.value.trim() || !description.value.trim()) {
    errorMessage.value = 'Please provide a task title and detailed accomplishment description.';
    return;
  }

  isUploading.value = true;
  errorMessage.value = '';

  try {
    toast.info('Uploading attachments and recording report...', 'SUBMITTING');

    const [uploadedImages, uploadedDocs] = await Promise.all([
      uploadFilesToBucket(imageFiles.value, 'images'),
      uploadFilesToBucket(docFiles.value, 'documents'),
    ]);

    const { error } = await supabase.from('accomplishment_reports').insert({
      intern_id: props.internId,
      title: title.value.trim(),
      description: description.value.trim(),
      report_date: reportDate.value,
      proof_images: uploadedImages,
      proof_documents: uploadedDocs,
      video_url: videoUrl.value.trim() || null,
      status: 'pending',
    });

    if (error) throw error;

    toast.success('Daily accomplishment report submitted successfully.', 'REPORT SAVED');

    // Reset Form Fields
    title.value = '';
    description.value = '';
    reportDate.value = new Date().toISOString().split('T')[0];
    videoUrl.value = '';
    imageFiles.value = [];
    docFiles.value = [];

    emit('saved');
    emit('close');
  } catch (err: any) {
    errorMessage.value = err.message || 'Failed to submit accomplishment report.';
    toast.error(err.message || 'Failed to submit accomplishment report.', 'SUBMISSION FAILED');
  } finally {
    isUploading.value = false;
  }
};
</script>

<template>
  <div 
    v-if="isOpen" 
    class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md select-none overflow-y-auto"
  >
    <!-- MAIN MODAL CONTAINER (DEEP CYBER-GLASS CARD) -->
    <div class="w-full max-w-[540px] my-auto rounded-[24px] bg-[#050811]/95 border border-white/15 shadow-[0_10px_40px_rgba(0,0,0,0.8),0_0_30px_rgba(0,217,255,0.08)] backdrop-blur-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      
      <!-- MODAL TOP BAR (NO TEXT WRAP / ONE LINE HEADER) -->
      <header class="px-5 sm:px-6 py-4 border-b border-white/10 flex items-center justify-between gap-3 bg-white/[0.015]">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-[#00d9ff] shrink-0 shadow-[0_0_12px_rgba(0,217,255,0.2)]">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div class="min-w-0">
            <p class="text-[20px] sm:text-[20px] font-bold text-white whitespace-nowrap truncate font-['Aileron',sans-serif]">
              New Accomplishment Report
            </p>
            <p class="text-[10px] text-[#00d9ff] font-mono tracking-wider truncate">
              TASK SUBMISSION &amp; VERIFICATION
            </p>
          </div>
        </div>

        <button 
          type="button" 
          @click="emit('close')"
          :disabled="isUploading"
          class="w-8 h-8 rounded-full border border-white/15 bg-white/[0.03] text-slate-400 hover:text-white hover:bg-white/10 hover:border-white/30 flex items-center justify-center transition-all cursor-pointer shrink-0"
          aria-label="Close Modal"
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </header>

      <!-- ERROR NOTIFICATION -->
      <div v-if="errorMessage" class="mx-5 sm:mx-6 mt-4 p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-[11px] text-rose-200 flex items-center gap-2">
        <svg class="w-4 h-4 text-rose-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="10" stroke-width="2" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01" />
        </svg>
        <span class="leading-tight">{{ errorMessage }}</span>
      </div>

      <!-- FORM BODY -->
      <form @submit.prevent="handleSubmit" class="p-5 sm:p-6 flex flex-col gap-4 overflow-y-auto max-h-[calc(85vh-75px)]">
        
        <!-- TASK TITLE FIELD -->
        <div class="flex flex-col gap-1.5">
          <label class="field-label">TASK / ACTIVITY TITLE</label>
          <div class="relative flex items-center">
            <input 
              v-model="title" 
              type="text" 
              required
              placeholder="e.g. Database schema migration & API endpoints"
              class="cyber-input pl-9"
            />
            <svg class="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
        </div>

        <!-- REPORT DATE FIELD -->
        <div class="flex flex-col gap-1.5">
          <label class="field-label">DATE PERFORMED</label>
          <div class="relative flex items-center">
            <input 
              v-model="reportDate" 
              type="date" 
              required
              class="cyber-input pl-9 font-mono"
            />
            <svg class="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        </div>

        <!-- DESCRIPTION FIELD -->
        <div class="flex flex-col gap-1.5">
          <label class="field-label">ACCOMPLISHMENT DETAILS</label>
          <textarea 
            v-model="description" 
            rows="3" 
            required
            placeholder="Summarize tasks completed, modules built, key outcomes, or issues resolved..."
            class="cyber-textarea"
          ></textarea>
        </div>

        <!-- PROOFS & ATTACHMENTS STRIP -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
          
          <!-- IMAGE SELECTOR -->
          <div class="flex flex-col gap-1.5">
            <label class="field-label">PHOTOS / SCREENSHOTS</label>
            <label class="attachment-tile group">
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-[#00d9ff] shrink-0">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <span class="text-xs text-slate-300 group-hover:text-white transition truncate">
                  {{ imageFiles.length ? `${imageFiles.length} image(s)` : 'Select images' }}
                </span>
              </div>
              <span class="text-[9.5px] font-mono text-[#00d9ff] font-semibold">Upload</span>
              <input type="file" multiple accept="image/*" @change="handleImageChange" class="hidden" />
            </label>
          </div>

          <!-- DOCUMENT SELECTOR -->
          <div class="flex flex-col gap-1.5">
            <label class="field-label">DOCUMENTS / PDF</label>
            <label class="attachment-tile group">
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-[#00d9ff] shrink-0">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <span class="text-xs text-slate-300 group-hover:text-white transition truncate">
                  {{ docFiles.length ? `${docFiles.length} doc(s)` : 'Select files' }}
                </span>
              </div>
              <span class="text-[9.5px] font-mono text-[#00d9ff] font-semibold">Browse</span>
              <input type="file" multiple accept=".pdf,.doc,.docx,.txt" @change="handleDocChange" class="hidden" />
            </label>
          </div>

        </div>

        <!-- VIDEO LINK -->
        <div class="flex flex-col gap-1.5">
          <label class="field-label">DEMO VIDEO LINK (OPTIONAL)</label>
          <div class="relative flex items-center">
            <input 
              v-model="videoUrl" 
              type="url" 
              placeholder="https://youtu.be/... or Google Drive link"
              class="cyber-input pl-9"
            />
            <svg class="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
        </div>

        <!-- MODAL FOOTER & ACTION BUTTONS -->
        <footer class="flex items-center justify-end gap-3 pt-4 border-t border-white/10 mt-1">
          <button 
            type="button" 
            @click="emit('close')"
            :disabled="isUploading"
            class="h-9 px-5 rounded-full border border-white/20 bg-white/[0.02] text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/[0.08] hover:border-white/30 transition-all cursor-pointer font-['Aileron',sans-serif]"
          >
            Cancel
          </button>

          <button 
            type="submit" 
            :disabled="isUploading"
            class="submit-pill-btn cursor-pointer"
          >
            <div v-if="isUploading" class="w-3.5 h-3.5 rounded-full border-2 border-[#050609] border-t-transparent animate-spin"></div>
            <span>{{ isUploading ? 'SUBMITTING...' : 'SUBMIT REPORT' }}</span>
          </button>
        </footer>

      </form>

    </div>
  </div>
</template>

<style scoped>
/* TYPOGRAPHY & FIELD LABELS */
.field-label {
  font-family: "Aileron", -apple-system, sans-serif;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: #858994;
}

/* CYBER INPUT STYLING */
.cyber-input {
  width: 100%;
  height: 40px;
  padding-right: 14px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #ffffff;
  font-family: "Aileron", -apple-system, sans-serif;
  font-size: 12px;
  outline: none;
  transition: border-color 160ms ease, box-shadow 160ms ease;
  color-scheme: dark;
}

.cyber-input:focus {
  border-color: #00d9ff;
  box-shadow: 0 0 10px rgba(0, 217, 255, 0.25);
}

.cyber-input::placeholder {
  color: #555d6e;
}

/* CUSTOM CALENDAR PICKER THEME */
.cyber-input[type="date"]::-webkit-calendar-picker-indicator {
  cursor: pointer;
  filter: invert(0.8) sepia(100%) saturate(300%) hue-rotate(150deg);
  opacity: 0.75;
  transition: opacity 160ms ease;
}

.cyber-input[type="date"]::-webkit-calendar-picker-indicator:hover {
  opacity: 1;
}

/* CYBER TEXTAREA */
.cyber-textarea {
  width: 100%;
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #ffffff;
  font-family: "Aileron", -apple-system, sans-serif;
  font-size: 12px;
  line-height: 1.5;
  outline: none;
  resize: none;
  transition: border-color 160ms ease, box-shadow 160ms ease;
}

.cyber-textarea:focus {
  border-color: #00d9ff;
  box-shadow: 0 0 10px rgba(0, 217, 255, 0.25);
}

.cyber-textarea::placeholder {
  color: #555d6e;
}

/* ATTACHMENT UPLOAD TILES */
.attachment-tile {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 40px;
  padding: 0 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid rgba(255, 255, 255, 0.12);
  cursor: pointer;
  transition: all 160ms ease;
}

.attachment-tile:hover {
  background: rgba(0, 217, 255, 0.05);
  border-color: rgba(0, 217, 255, 0.4);
}

/* SUBMIT BUTTON (MATCHING LOGIN / PRIMARY BUTTONS) */
.submit-pill-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 38px;
  padding: 0 20px;
  border-radius: 999px;
  border: 0;
  color: #050609;
  background: linear-gradient(180deg, #f7fcff 0%, #c6f0ff 52%, #63daf7 100%);
  box-shadow: 0 3px 12px rgba(0, 217, 255, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.95);
  font: 700 11.5px/1 "Aileron", sans-serif;
  letter-spacing: 0.5px;
  transition: all 160ms ease;
  user-select: none;
}

.submit-pill-btn:hover:not(:disabled) {
  filter: brightness(1.06);
  box-shadow: 0 5px 16px rgba(0, 217, 255, 0.45);
  transform: translateY(-1px);
}

.submit-pill-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.submit-pill-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  filter: grayscale(0.4);
}
</style>