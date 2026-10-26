<script setup lang="ts">
import { ref, watch } from 'vue';
import { useAccomplishmentsStore } from '@/stores/accomplishments';
import type { AccomplishmentLog } from '@/types';

const props = defineProps<{
  isOpen: boolean;
  internId: string;
  supervisorId?: string;
  initialData?: AccomplishmentLog | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'saved', log: AccomplishmentLog): void;
}>();

const accomplishmentsStore = useAccomplishmentsStore();

// Form States
const title = ref('');
const description = ref('');
const reportDate = ref(new Date().toISOString().split('T')[0]);
const renderedHours = ref<number>(8);
const proofImages = ref<string[]>([]);
const proofDocuments = ref<string[]>([]);
const videoUrl = ref('');

// UI States
const isUploading = ref(false);
const uploadProgressText = ref('');
const formError = ref('');

// Watch initial data for edit mode
watch(
  () => props.initialData,
  (log) => {
    if (log) {
      title.value = log.title;
      description.value = log.description;
      reportDate.value = log.report_date;
      renderedHours.value = log.rendered_hours;
      proofImages.value = [...(log.proof_images || [])];
      proofDocuments.value = [...(log.proof_documents || [])];
      videoUrl.value = log.video_url || '';
    } else {
      resetForm();
    }
  },
  { immediate: true }
);

function resetForm() {
  title.value = '';
  description.value = '';
  reportDate.value = new Date().toISOString().split('T')[0];
  renderedHours.value = 8;
  proofImages.value = [];
  proofDocuments.value = [];
  videoUrl.value = '';
  formError.value = '';
}

// Multi-Proof File Upload Handler
const handleFileUpload = async (event: Event, type: 'images' | 'documents' | 'videos') => {
  const target = event.target as HTMLInputElement;
  const files = target.files;
  if (!files || files.length === 0) return;

  isUploading.value = true;
  formError.value = '';

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      uploadProgressText.value = `Uploading ${file.name}...`;

      const publicUrl = await accomplishmentsStore.uploadProofFile(file, type);

      if (type === 'images') {
        proofImages.value.push(publicUrl);
      } else if (type === 'documents') {
        proofDocuments.value.push(publicUrl);
      } else if (type === 'videos') {
        videoUrl.value = publicUrl;
      }
    }
  } catch (err: any) {
    formError.value = err.message || 'File upload failed. Please try again.';
  } finally {
    isUploading.value = false;
    uploadProgressText.value = '';
    target.value = ''; // Reset input
  }
};

const removeImage = (index: number) => {
  proofImages.value.splice(index, 1);
};

const removeDocument = (index: number) => {
  proofDocuments.value.splice(index, 1);
};

// Save / Submit Form
const handleSubmit = async () => {
  formError.value = '';

  if (!title.value.trim() || !description.value.trim()) {
    formError.value = 'Please provide both a task title and description.';
    return;
  }

  if (renderedHours.value <= 0) {
    formError.value = 'Rendered hours must be greater than zero.';
    return;
  }

  try {
    if (props.initialData?.id) {
      // Edit Mode
      const updated = await accomplishmentsStore.updateLog(props.initialData.id, {
        title: title.value,
        description: description.value,
        report_date: reportDate.value,
        rendered_hours: renderedHours.value,
        proof_images: proofImages.value,
        proof_documents: proofDocuments.value,
        video_url: videoUrl.value || null,
      });
      if (updated) emit('saved', updated);
    } else {
      // Create Mode
      const created = await accomplishmentsStore.createLog({
        internId: props.internId,
        supervisorId: props.supervisorId,
        title: title.value,
        description: description.value,
        reportDate: reportDate.value,
        renderedHours: renderedHours.value,
        proofImages: proofImages.value,
        proofDocuments: proofDocuments.value,
        videoUrl: videoUrl.value || null,
      });
      if (created) emit('saved', created);
    }
    emit('close');
  } catch (err: any) {
    formError.value = err.message || 'Failed to save accomplishment log.';
  }
};
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-navy-950/80 backdrop-blur-md">
      <!-- Backdrop Dismiss -->
      <div class="fixed inset-0" @click="emit('close')"></div>

      <!-- Glass Modal Sheet Container -->
      <div 
        class="relative w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto z-10 flex flex-col
               bg-[#0d1527]/95 border-t sm:border border-cyan-500/35 rounded-t-[2.5rem] sm:rounded-3xl
               shadow-[0_0_50px_rgba(6,182,212,0.22)] text-slate-100 backdrop-blur-2xl"
      >
        <!-- Mobile Drawer Drag Handle -->
        <div class="sm:hidden w-12 h-1 bg-slate-600/60 rounded-full mx-auto mt-3 mb-1"></div>

        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-800/80">
          <div>
            <h3 class="text-base font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-400">
              {{ initialData ? 'Edit Accomplishment Log' : 'New Accomplishment Log' }}
            </h3>
            <p class="text-[11px] text-slate-400 mt-0.5">
              Document completed work with multi-proof attachments
            </p>
          </div>
          <button 
            @click="emit('close')"
            class="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800/70 hover:bg-slate-700 text-slate-300 text-sm transition"
          >
            ✕
          </button>
        </div>

        <!-- Form Fields -->
        <div class="p-6 space-y-4 overflow-y-auto">
          <!-- Error Banner -->
          <div v-if="formError" class="p-3.5 rounded-xl bg-red-950/60 border border-red-500/40 text-xs text-red-300 font-medium">
            {{ formError }}
          </div>

          <!-- Uploading Spinner Banner -->
          <div v-if="isUploading" class="p-3 rounded-xl bg-cyan-950/60 border border-cyan-500/40 text-xs text-cyan-300 flex items-center gap-2">
            <span class="animate-spin">⏳</span>
            <span>{{ uploadProgressText }}</span>
          </div>

          <!-- Task Title -->
          <div class="space-y-1">
            <label class="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Task Title</label>
            <input 
              v-model="title" 
              type="text" 
              required
              placeholder="e.g., Developed API Endpoints / Office Network Configuration"
              class="w-full px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-100 text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none transition"
            />
          </div>

          <!-- Date & Rendered Hours Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="space-y-1">
              <label class="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Date</label>
              <input 
                v-model="reportDate" 
                type="date" 
                required
                class="w-full px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-100 text-sm focus:border-cyan-400 outline-none transition"
              />
            </div>
            <div class="space-y-1">
              <label class="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Hours Rendered</label>
              <input 
                v-model.number="renderedHours" 
                type="number" 
                step="0.5" 
                min="0.5" 
                max="24"
                required
                class="w-full px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-100 text-sm font-mono focus:border-cyan-400 outline-none transition"
              />
            </div>
          </div>

          <!-- Task Details & Description -->
          <div class="space-y-1">
            <label class="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Description & Outputs</label>
            <textarea 
              v-model="description" 
              rows="3" 
              required
              placeholder="Provide a detailed breakdown of tasks finished, tools utilized, and challenges addressed..."
              class="w-full px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-100 text-xs focus:border-cyan-400 outline-none transition"
            ></textarea>
          </div>

          <!-- MULTI-PROOF ATTACHMENTS SECTION -->
          <div class="pt-2 border-t border-slate-800/80 space-y-3">
            <label class="text-[11px] font-bold text-cyan-400 uppercase tracking-wider block">
              Multi-Proof Attachments
            </label>

            <!-- 1. Photos / Screenshots -->
            <div class="space-y-2">
              <div class="flex items-center justify-between text-xs">
                <span class="text-slate-300 font-semibold">Photos & Screenshots ({{ proofImages.length }})</span>
                <label class="text-[11px] text-cyan-400 hover:text-cyan-300 font-bold cursor-pointer">
                  + Add Images
                  <input type="file" multiple accept="image/*" class="hidden" @change="handleFileUpload($event, 'images')" />
                </label>
              </div>

              <!-- Images Preview Chips -->
              <div v-if="proofImages.length > 0" class="flex flex-wrap gap-2">
                <div 
                  v-for="(img, idx) in proofImages" 
                  :key="idx" 
                  class="relative group rounded-xl overflow-hidden border border-cyan-500/30 w-16 h-16 bg-slate-900"
                >
                  <img :src="img" alt="Proof" class="w-full h-full object-cover" />
                  <button 
                    @click="removeImage(idx)" 
                    class="absolute inset-0 bg-red-950/80 text-white font-bold text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>

            <!-- 2. Documents (PDF / DOCX) -->
            <div class="space-y-2 pt-2 border-t border-slate-800/60">
              <div class="flex items-center justify-between text-xs">
                <span class="text-slate-300 font-semibold">Documents & Sheets ({{ proofDocuments.length }})</span>
                <label class="text-[11px] text-cyan-400 hover:text-cyan-300 font-bold cursor-pointer">
                  + Add File (PDF/DOCX)
                  <input type="file" multiple accept=".pdf,.doc,.docx" class="hidden" @change="handleFileUpload($event, 'documents')" />
                </label>
              </div>

              <div v-if="proofDocuments.length > 0" class="space-y-1">
                <div 
                  v-for="(doc, idx) in proofDocuments" 
                  :key="idx"
                  class="p-2 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] flex items-center justify-between"
                >
                  <span class="truncate max-w-[80%] text-slate-300">📄 {{ doc.split('/').pop() }}</span>
                  <button @click="removeDocument(idx)" class="text-red-400 hover:text-red-300 font-bold px-2">✕</button>
                </div>
              </div>
            </div>

            <!-- 3. Video Walkthrough (File Upload or External Link) -->
            <div class="space-y-2 pt-2 border-t border-slate-800/60">
              <div class="flex items-center justify-between text-xs">
                <span class="text-slate-300 font-semibold">Video Walkthrough (Clip or External URL)</span>
                <label class="text-[11px] text-cyan-400 hover:text-cyan-300 font-bold cursor-pointer">
                  + Upload Video File
                  <input type="file" accept="video/*" class="hidden" @change="handleFileUpload($event, 'videos')" />
                </label>
              </div>

              <input 
                v-model="videoUrl" 
                type="url" 
                placeholder="Or paste video link (e.g., Google Drive, Loom, YouTube)"
                class="w-full px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-100 text-xs focus:border-cyan-400 outline-none transition"
              />
            </div>
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="px-6 py-4 border-t border-slate-800/80 bg-slate-900/40 flex items-center justify-end gap-3">
          <button 
            type="button" 
            @click="emit('close')"
            class="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition"
          >
            Cancel
          </button>
          <button 
            type="button" 
            @click="handleSubmit"
            :disabled="accomplishmentsStore.loading || isUploading"
            class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(6,182,212,0.35)] disabled:opacity-50 transition"
          >
            {{ accomplishmentsStore.loading ? 'Saving Log...' : (initialData ? 'Save Changes' : 'Submit Accomplishment') }}
          </button>
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