<script setup lang="ts">
import { ref, watch } from 'vue';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/composables/useToast';

const props = defineProps<{
  isOpen: boolean;
  log: any | null;
  canEdit?: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'updated'): void;
  (e: 'view-media', url: string, type: 'image' | 'document' | 'video', title: string): void;
}>();

const toast = useToast();

// Mode States
const isEditing = ref(false);
const isSaving = ref(false);
const errorMessage = ref('');

// Editable Form Fields
const editTitle = ref('');
const editDescription = ref('');
const editReportDate = ref('');
const editVideoUrl = ref('');

// Additional Attachments
const additionalImageFiles = ref<File[]>([]);
const additionalDocFiles = ref<File[]>([]);

// In-App Document Preview Modal State
const previewDocUrl = ref<string | null>(null);

// Synchronize fields when modal opens
watch(
  () => [props.isOpen, props.log],
  ([open]) => {
    if (open && props.log) {
      isEditing.value = false;
      errorMessage.value = '';
      previewDocUrl.value = null;
      additionalImageFiles.value = [];
      additionalDocFiles.value = [];

      editTitle.value = props.log.title || '';
      editDescription.value = props.log.description || '';
      editReportDate.value = props.log.report_date || '';
      editVideoUrl.value = props.log.video_url || '';
    }
  },
  { immediate: true }
);

const handleAdditionalImageChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files) {
    additionalImageFiles.value = Array.from(target.files);
  }
};

const handleAdditionalDocChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files) {
    additionalDocFiles.value = Array.from(target.files);
  }
};

const uploadFilesToBucket = async (files: File[], folder: string): Promise<string[]> => {
  const urls: string[] = [];
  for (const file of files) {
    const fileExt = file.name.split('.').pop();
    const filePath = `${props.log.intern_id}/${folder}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage.from('proofs').upload(filePath, file);
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('proofs').getPublicUrl(filePath);
    if (data?.publicUrl) {
      urls.push(data.publicUrl);
    }
  }
  return urls;
};

const handleSaveChanges = async () => {
  if (!editTitle.value.trim() || !editDescription.value.trim()) {
    errorMessage.value = 'Title and description cannot be empty.';
    return;
  }

  isSaving.value = true;
  errorMessage.value = '';

  try {
    toast.info('Updating accomplishment report...', 'SAVING');

    // Upload any newly appended attachments
    const [newImages, newDocs] = await Promise.all([
      uploadFilesToBucket(additionalImageFiles.value, 'images'),
      uploadFilesToBucket(additionalDocFiles.value, 'documents'),
    ]);

    const updatedImages = [...(props.log.proof_images || []), ...newImages];
    const updatedDocs = [...(props.log.proof_documents || []), ...newDocs];

    const { error } = await supabase
      .from('accomplishment_reports')
      .update({
        title: editTitle.value.trim(),
        description: editDescription.value.trim(),
        report_date: editReportDate.value,
        video_url: editVideoUrl.value.trim() || null,
        proof_images: updatedImages,
        proof_documents: updatedDocs,
      })
      .eq('id', props.log.id);

    if (error) throw error;

    toast.success('Report updated successfully.', 'UPDATED');
    emit('updated');
    emit('close');
  } catch (err: any) {
    errorMessage.value = err.message || 'Failed to update report.';
    toast.error(err.message || 'Failed to update report.', 'UPDATE ERROR');
  } finally {
    isSaving.value = false;
  }
};

const openDocInAppPreview = (url: string) => {
  previewDocUrl.value = url;
};
</script>

<template>
  <div 
    v-if="isOpen && log" 
    class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md select-none overflow-y-auto"
  >
    <!-- MODAL CONTAINER (DEEP CYBER-GLASS CARD) -->
    <div class="w-full max-w-[560px] my-auto rounded-[24px] bg-[#050811]/95 border border-white/15 shadow-[0_10px_40px_rgba(0,0,0,0.8),0_0_30px_rgba(0,217,255,0.08)] backdrop-blur-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      
      <!-- MODAL TOP BAR (NO TEXT WRAP / ONE LINE HEADER) -->
      <header class="px-5 sm:px-6 py-4 border-b border-white/10 flex items-center justify-between gap-3 bg-white/[0.015]">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-[#00d9ff] shrink-0 shadow-[0_0_12px_rgba(0,217,255,0.2)]">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <div class="min-w-0">
            <p class="text-[18px] sm:text-[20px] font-bold text-white whitespace-nowrap truncate font-['Aileron',sans-serif]">
              {{ isEditing ? 'Edit Accomplishment Report' : 'Accomplishment Details' }}
            </p>
            <p class="text-[10px] text-[#00d9ff] font-mono tracking-wider truncate">
              AUDIT TRAIL &amp; VERIFICATION LOG
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
            <!-- EDIT TOGGLE BUTTON -->
            <button
            v-if="canEdit && log.status === 'pending' && !isEditing"
            type="button"
            @click="isEditing = true"
            class="edit-pill-btn"
            >
            <svg class="w-3.5 h-3.5 text-[#00d9ff] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span>Edit</span>
            </button>
        </div>
      </header>

      <!-- ERROR FEEDBACK -->
      <div v-if="errorMessage" class="mx-5 sm:mx-6 mt-4 p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-[11px] text-rose-200 flex items-center gap-2">
        <svg class="w-4 h-4 text-rose-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="10" stroke-width="2" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01" />
        </svg>
        <span class="leading-tight">{{ errorMessage }}</span>
      </div>

      <!-- ================= VIEW MODE ================= -->
      <div v-if="!isEditing" class="p-5 sm:p-6 flex flex-col gap-4 overflow-y-auto max-h-[calc(85vh-75px)]">
        
        <!-- HEADER METRICS STRIP -->
        <div class="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/10">
          <div>
            <span class="field-label">DATE PERFORMED</span>
            <span class="block text-xs font-mono text-white font-bold mt-0.5">{{ log.report_date }}</span>
          </div>

          <div class="text-right">
            <span class="field-label">APPROVAL STATUS</span>
            <div class="mt-0.5">
              <span 
                class="trainext-chip text-[10px]"
                :class="{
                  'chip-emerald': log.status === 'approved',
                  'chip-amber': log.status === 'pending',
                  'chip-rose': log.status === 'rejected'
                }"
              >
                {{ log.status }}
              </span>
            </div>
          </div>
        </div>

        <!-- TASK TITLE -->
        <div class="flex flex-col gap-1">
          <span class="field-label">TASK TITLE</span>
          <h3 class="text-sm sm:text-base font-bold text-white tracking-wide">
            {{ log.title }}
          </h3>
        </div>

        <!-- DESCRIPTION -->
        <div class="flex flex-col gap-1">
          <span class="field-label">DETAILED ACCOMPLISHMENT</span>
          <div class="p-3.5 rounded-xl bg-black/40 border border-white/10 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
            {{ log.description }}
          </div>
        </div>

        <!-- DYNAMIC SUPERVISOR FEEDBACK (GREEN IF APPROVED, RED IF REJECTED) -->
        <div 
          v-if="log.feedback"
          class="p-3.5 rounded-xl border flex flex-col gap-1 animate-in fade-in duration-200"
          :class="log.status === 'approved' 
            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200' 
            : 'bg-rose-950/40 border-rose-500/40 text-rose-200'"
        >
          <div class="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider font-mono"
            :class="log.status === 'approved' ? 'text-emerald-400' : 'text-rose-400'"
          >
            <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <span>SUPERVISOR REMARKS:</span>
          </div>
          <p class="text-xs leading-relaxed pl-5">{{ log.feedback }}</p>
        </div>

        <!-- ATTACHMENT PROOFS (IMAGES, DOCUMENTS, VIDEO) -->
        <div class="flex flex-col gap-2.5 pt-1">
          <span class="field-label">VERIFICATION PROOFS &amp; ATTACHMENTS</span>
          
          <!-- Image Previews -->
          <div v-if="log.proof_images?.length" class="flex flex-col gap-1.5">
            <span class="text-[9.5px] font-mono text-slate-400">Captured Photos:</span>
            <div class="flex flex-wrap gap-2">
              <button 
                v-for="(img, idx) in log.proof_images" 
                :key="img"
                type="button"
                @click="emit('view-media', img, 'image', `${log.title} Photo`)"
                class="w-14 h-14 rounded-xl overflow-hidden border border-[#00d9ff]/30 bg-black cursor-pointer hover:scale-105 hover:border-[#00d9ff] transition"
              >
                <img :src="img" alt="Proof" class="w-full h-full object-cover" />
              </button>
            </div>
          </div>

        <!-- Document Attachments Strip -->
          <div v-if="log.proof_documents?.length" class="flex flex-col gap-1.5 pt-1">
            <span class="text-[9.5px] font-mono text-slate-400">Attached Documents:</span>
            <div class="flex flex-col gap-1.5">
              <div 
                v-for="doc in log.proof_documents" 
                :key="doc"
                class="p-2.5 rounded-xl bg-white/[0.03] border border-white/15 flex items-center justify-between gap-2"
              >
                <div class="flex items-center gap-2 min-w-0">
                  <svg class="w-4 h-4 text-[#00d9ff] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <span class="text-xs text-white truncate max-w-[200px] sm:max-w-[260px] font-mono">{{ doc.split('/').pop() }}</span>
                </div>

                <!-- ICON-ONLY ROUND PILL ACTION BUTTONS -->
                <div class="flex items-center gap-1.5 shrink-0">
                  <!-- PREVIEW ICON BUTTON -->
                  <button 
                    type="button" 
                    @click="openDocInAppPreview(doc)"
                    class="action-pill-btn preview-btn"
                    title="Preview Document"
                    aria-label="Preview Document"
                  >
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>

                  <!-- DOWNLOAD ICON BUTTON -->
                  <a 
                    :href="doc" 
                    target="_blank" 
                    download
                    class="action-pill-btn download-btn"
                    title="Download File"
                    aria-label="Download File"
                  >
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
          <!-- Video Link -->
          <div v-if="log.video_url" class="pt-1">
            <span class="text-[9.5px] font-mono text-slate-400 block mb-1">Demonstration Link:</span>
            <button 
              type="button"
              @click="emit('view-media', log.video_url, 'video', log.title)"
              class="w-full p-2.5 rounded-xl bg-[#00d9ff]/10 border border-[#00d9ff]/30 text-xs text-white flex items-center justify-between cursor-pointer hover:bg-[#00d9ff]/15 transition"
            >
              <div class="flex items-center gap-2 truncate">
                <svg class="w-4 h-4 text-[#00d9ff] shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
                <span class="truncate font-mono">{{ log.video_url }}</span>
              </div>
              <span class="text-[10px] text-[#00d9ff] font-bold uppercase shrink-0">Open Demo</span>
            </button>
          </div>
        </div>

        <!-- IN-APP DOCUMENT PREVIEW IFRAME -->
        <div v-if="previewDocUrl" class="mt-2 pt-3 border-t border-white/10 flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <span class="field-label text-[#00d9ff]">DOCUMENT PREVIEW</span>
            <!-- CLOSE PREVIEW ICON BUTTON -->
            <button 
              type="button" 
              @click="previewDocUrl = null"
              class="action-pill-btn close-preview-btn"
              title="Close Preview"
              aria-label="Close Preview"
            >
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="w-full h-64 rounded-xl overflow-hidden border border-white/20 bg-white shadow-inner">
            <iframe :src="previewDocUrl" class="w-full h-full border-0" title="PDF Document Viewer"></iframe>
          </div>
        </div>

        <!-- FOOTER CLOSE -->
        <footer class="flex items-center justify-end pt-4 border-t border-white/10 mt-1">
        <button 
        type="button" 
        @click="emit('close')"
        class="close-pill-btn"
        >
        Close Details
        </button>
        </footer>

      </div>

      <!-- ================= EDIT MODE (ONLY FOR PENDING) ================= -->
      <form v-else @submit.prevent="handleSaveChanges" class="p-5 sm:p-6 flex flex-col gap-4 overflow-y-auto max-h-[calc(85vh-75px)]">
        
        <!-- EDIT TITLE -->
        <div class="flex flex-col gap-1.5">
          <label class="field-label">EDIT TASK / ACTIVITY TITLE</label>
          <div class="relative flex items-center">
            <input 
              v-model="editTitle" 
              type="text" 
              required
              class="cyber-input pl-9"
            />
            <svg class="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
        </div>

        <!-- EDIT DATE -->
        <div class="flex flex-col gap-1.5">
          <label class="field-label">DATE PERFORMED</label>
          <div class="relative flex items-center">
            <input 
              v-model="editReportDate" 
              type="date" 
              required
              class="cyber-input pl-9 font-mono"
            />
            <svg class="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        </div>

        <!-- EDIT DESCRIPTION -->
        <div class="flex flex-col gap-1.5">
          <label class="field-label">ACCOMPLISHMENT DETAILS</label>
          <textarea 
            v-model="editDescription" 
            rows="3" 
            required
            class="cyber-textarea"
          ></textarea>
        </div>

        <!-- ADD MORE PROOFS -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
          <div class="flex flex-col gap-1.5">
            <label class="field-label">ADD MORE PHOTOS</label>
            <label class="attachment-tile group">
              <span class="text-xs text-slate-300 truncate">
                {{ additionalImageFiles.length ? `${additionalImageFiles.length} new image(s)` : 'Add photos...' }}
              </span>
              <span class="text-[9.5px] font-mono text-[#00d9ff] font-semibold">Upload</span>
              <input type="file" multiple accept="image/*" @change="handleAdditionalImageChange" class="hidden" />
            </label>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="field-label">ADD MORE DOCUMENTS</label>
            <label class="attachment-tile group">
              <span class="text-xs text-slate-300 truncate">
                {{ additionalDocFiles.length ? `${additionalDocFiles.length} new file(s)` : 'Add docs...' }}
              </span>
              <span class="text-[9.5px] font-mono text-[#00d9ff] font-semibold">Browse</span>
              <input type="file" multiple accept=".pdf,.doc,.docx,.txt" @change="handleAdditionalDocChange" class="hidden" />
            </label>
          </div>
        </div>

        <!-- EDIT VIDEO LINK -->
        <div class="flex flex-col gap-1.5">
          <label class="field-label">DEMO VIDEO LINK (OPTIONAL)</label>
          <div class="relative flex items-center">
            <input 
              v-model="editVideoUrl" 
              type="url" 
              class="cyber-input pl-9"
              placeholder="https://youtu.be/... or Google Drive link"
            />
            <svg class="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
        </div>

        <!-- EDIT ACTIONS -->
        <footer class="flex items-center justify-end gap-3 pt-4 border-t border-white/10 mt-1">
          <button 
            type="button" 
            @click="isEditing = false"
            :disabled="isSaving"
            class="h-9 px-5 rounded-full border border-white/20 bg-white/[0.02] text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer font-['Aileron',sans-serif]"
          >
            Cancel Edit
          </button>

          <button 
            type="submit" 
            :disabled="isSaving"
            class="submit-pill-btn cursor-pointer"
          >
            <div v-if="isSaving" class="w-3.5 h-3.5 rounded-full border-2 border-[#050609] border-t-transparent animate-spin"></div>
            <span>{{ isSaving ? 'SAVING...' : 'SAVE CHANGES' }}</span>
          </button>
        </footer>

      </form>

    </div>
  </div>
</template>

<style scoped>
/* ICON-ONLY ROUND PILL ACTIONS */
.action-pill-btn {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 30px !important;
  height: 30px !important;
  border-radius: 9999px !important; /* Ganap na round pill */
  transition: all 160ms ease !important;
  cursor: pointer !important;
  user-select: none !important;
}

/* Preview Icon Style */
.preview-btn {
  background: rgba(0, 217, 255, 0.1) !important;
  border: 1px solid rgba(0, 217, 255, 0.45) !important;
  color: #00d9ff !important;
  box-shadow: 0 0 8px rgba(0, 217, 255, 0.15) !important;
}

.preview-btn:hover {
  background: rgba(0, 217, 255, 0.25) !important;
  border-color: rgba(0, 217, 255, 0.8) !important;
  color: #ffffff !important;
  transform: translateY(-1px) !important;
}

/* Download Icon Style */
.download-btn {
  background: rgba(255, 255, 255, 0.04) !important;
  border: 1px solid rgba(255, 255, 255, 0.18) !important;
  color: #cbd5e1 !important;
}

.download-btn:hover {
  background: rgba(255, 255, 255, 0.1) !important;
  border-color: rgba(255, 255, 255, 0.35) !important;
  color: #ffffff !important;
  transform: translateY(-1px) !important;
}

/* Close Preview Icon Style */
.close-preview-btn {
  width: 26px !important;
  height: 26px !important;
  background: rgba(244, 63, 94, 0.12) !important;
  border: 1px solid rgba(244, 63, 94, 0.35) !important;
  color: #fca5a5 !important;
}

.close-preview-btn:hover {
  background: rgba(244, 63, 94, 0.25) !important;
  border-color: rgba(244, 63, 94, 0.7) !important;
  color: #ffffff !important;
  transform: translateY(-1px) !important;
}

.action-pill-btn:active {
  transform: scale(0.92) !important;
}
.field-label {
  font-family: "Aileron", -apple-system, sans-serif;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: #858994;
}

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

.cyber-input[type="date"]::-webkit-calendar-picker-indicator {
  cursor: pointer;
  filter: invert(0.8) sepia(100%) saturate(300%) hue-rotate(150deg);
  opacity: 0.75;
}

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
}

/* FORCED PILL ROUNDING PARA SA EDIT BUTTON */
.edit-pill-btn {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 6px !important;
  height: 32px !important;
  padding: 0 14px !important;
  border-radius: 9999px !important; /* Ganap na bilog/pill shape */
  border: 1px solid rgba(0, 217, 255, 0.45) !important;
  background: rgba(0, 217, 255, 0.1) !important;
  color: #00d9ff !important;
  font-family: "Aileron", -apple-system, sans-serif !important;
  font-size: 11px !important;
  font-weight: 700 !important;
  letter-spacing: 0.3px !important;
  cursor: pointer !important;
  user-select: none !important;
  box-shadow: 0 0 10px rgba(0, 217, 255, 0.15) !important;
  transition: all 160ms ease !important;
}

.edit-pill-btn:hover {
  background: rgba(0, 217, 255, 0.22) !important;
  border-color: rgba(0, 217, 255, 0.8) !important;
  color: #ffffff !important;
  box-shadow: 0 0 14px rgba(0, 217, 255, 0.3) !important;
  transform: translateY(-1px) !important;
}

.edit-pill-btn:active {
  transform: scale(0.96) !important;
}
/* FORCED PILL ROUNDING PARA SA CLOSE DETAILS BUTTON */
.close-pill-btn {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  height: 36px !important;
  padding: 0 22px !important;
  border-radius: 9999px !important; /* Full pill curve */
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
  background: rgba(255, 255, 255, 0.03) !important;
  color: #cbd5e1 !important;
  font-family: "Aileron", -apple-system, sans-serif !important;
  font-size: 11.5px !important;
  font-weight: 600 !important;
  letter-spacing: 0.3px !important;
  cursor: pointer !important;
  user-select: none !important;
  transition: all 160ms ease !important;
}

.close-pill-btn:hover {
  color: #ffffff !important;
  background: rgba(255, 255, 255, 0.08) !important;
  border-color: rgba(255, 255, 255, 0.35) !important;
  transform: translateY(-1px) !important;
}

.close-pill-btn:active {
  transform: scale(0.97) !important;
}
</style>