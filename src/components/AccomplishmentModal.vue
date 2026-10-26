  <script setup lang="ts">
  import { ref } from 'vue';
  import { supabase } from '@/lib/supabase';

  const props = defineProps<{
    isOpen: boolean;
    internId: string;
  }>();

  const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'saved'): void;
  }>();

  // Form Fields
  const title = ref('');
  const description = ref('');
  const reportDate = ref(new Date().toISOString().split('T')[0]);
  const renderedHours = ref<number | ''>(8);
  const videoUrl = ref('');

  // Media Uploads
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
    if (!title.value.trim() || !description.value.trim() || !renderedHours.value) {
      errorMessage.value = 'Please provide title, description, and rendered hours.';
      return;
    }

    isUploading.value = true;
    errorMessage.value = '';

    try {
      const [uploadedImages, uploadedDocs] = await Promise.all([
        uploadFilesToBucket(imageFiles.value, 'images'),
        uploadFilesToBucket(docFiles.value, 'documents'),
      ]);

      const { error } = await supabase.from('accomplishment_reports').insert({
        intern_id: props.internId,
        title: title.value.trim(),
        description: description.value.trim(),
        report_date: reportDate.value,
        rendered_hours: Number(renderedHours.value),
        proof_images: uploadedImages,
        proof_documents: uploadedDocs,
        video_url: videoUrl.value.trim() || null,
        status: 'pending',
      });

      if (error) throw error;

      // Reset Form
      title.value = '';
      description.value = '';
      renderedHours.value = 8;
      videoUrl.value = '';
      imageFiles.value = [];
      docFiles.value = [];

      emit('saved');
      emit('close');
    } catch (err: any) {
      errorMessage.value = err.message || 'Failed to submit accomplishment report.';
    } finally {
      isUploading.value = false;
    }
  };
  </script>

  <template>
    <div 
      v-if="isOpen" 
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm select-none overflow-y-auto"
    >
      <div class="w-full max-w-lg my-auto trainext-glass-card rounded-[28px] p-6 flex flex-col gap-4 border border-white/20 shadow-2xl">
        
        <!-- HEADER -->
        <div class="flex items-center justify-between pb-2 border-b border-white/10">
          <div>
            <h2 class="text-base font-bold text-white tracking-tight">New Accomplishment Report</h2>
            <p class="text-[11px] text-[#00d9ff]">Document your daily tasks and attach verification evidence.</p>
          </div>
          <button 
            type="button" 
            @click="emit('close')"
            class="text-slate-400 hover:text-white transition cursor-pointer p-1"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- ERROR MESSAGE -->
        <div v-if="errorMessage" class="p-2.5 rounded-xl bg-red-950/60 border border-red-500/40 text-xs text-red-200">
          {{ errorMessage }}
        </div>

        <!-- FORM FIELDS -->
        <form @submit.prevent="handleSubmit" class="flex flex-col gap-3.5">
          
          <!-- TITLE -->
          <div class="flex flex-col gap-1">
            <label class="trainext-label">TASK / MODULE TITLE</label>
            <input 
              v-model="title" 
              type="text" 
              required
              placeholder="e.g. Backend API Endpoint Authentication"
              class="w-full h-9 px-3 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder:text-[#858994] outline-none focus:border-[#00d9ff]"
            />
          </div>

          <!-- DATES AND HOURS ROW -->
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1">
              <label class="trainext-label">REPORT DATE</label>
              <input 
                v-model="reportDate" 
                type="date" 
                required
                class="w-full h-9 px-3 rounded-xl bg-black/40 border border-white/15 text-xs text-white outline-none focus:border-[#00d9ff]"
              />
            </div>

            <div class="flex flex-col gap-1">
              <label class="trainext-label">HOURS RENDERED</label>
              <input 
                v-model.number="renderedHours" 
                type="number" 
                min="0.5" 
                max="24" 
                step="0.5"
                required
                placeholder="8"
                class="w-full h-9 px-3 rounded-xl bg-black/40 border border-white/15 text-xs text-white outline-none focus:border-[#00d9ff]"
              />
            </div>
          </div>

          <!-- DESCRIPTION -->
          <div class="flex flex-col gap-1">
            <label class="trainext-label">DETAILED ACCOMPLISHMENT DESCRIPTION</label>
            <textarea 
              v-model="description" 
              rows="3" 
              required
              placeholder="Summarize tasks completed, technologies utilized, challenges resolved..."
              class="w-full p-3 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder:text-[#858994] outline-none focus:border-[#00d9ff] resize-none"
            ></textarea>
          </div>

          <!-- PROOFS ATTACHMENT STRIP -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <!-- Screenshots -->
            <div class="flex flex-col gap-1">
              <label class="trainext-label">SCREENSHOTS / PHOTOS</label>
              <label class="h-9 px-3 rounded-xl bg-white/[0.03] border border-white/15 hover:border-[#00d9ff]/50 flex items-center justify-between cursor-pointer transition text-xs text-[#858994]">
                <span class="truncate">{{ imageFiles.length ? `${imageFiles.length} image(s) selected` : 'Select images...' }}</span>
                <svg class="w-3.5 h-3.5 text-[#00d9ff]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <input type="file" multiple accept="image/*" @change="handleImageChange" class="hidden" />
              </label>
            </div>

            <!-- Documents -->
            <div class="flex flex-col gap-1">
              <label class="trainext-label">DOCUMENTS / PDF</label>
              <label class="h-9 px-3 rounded-xl bg-white/[0.03] border border-white/15 hover:border-[#00d9ff]/50 flex items-center justify-between cursor-pointer transition text-xs text-[#858994]">
                <span class="truncate">{{ docFiles.length ? `${docFiles.length} file(s) selected` : 'Select files...' }}</span>
                <svg class="w-3.5 h-3.5 text-[#00d9ff]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <input type="file" multiple accept=".pdf,.doc,.docx,.txt" @change="handleDocChange" class="hidden" />
              </label>
            </div>
          </div>

          <!-- VIDEO LINK -->
          <div class="flex flex-col gap-1">
            <label class="trainext-label">DEMO VIDEO LINK (OPTIONAL)</label>
            <div class="relative">
              <input 
                v-model="videoUrl" 
                type="url" 
                placeholder="https://youtu.be/... or Drive link"
                class="w-full h-9 px-3 pl-8 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder:text-[#858994] outline-none focus:border-[#00d9ff]"
              />
              <svg class="w-3.5 h-3.5 text-[#00d9ff] absolute left-2.5 top-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
          </div>

          <!-- ACTIONS -->
          <div class="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
            <button 
              type="button" 
              @click="emit('close')"
              :disabled="isUploading"
              class="px-4 py-2 rounded-full border border-white/20 text-xs text-slate-300 hover:text-white transition cursor-pointer"
            >
              Cancel
            </button>

            <button 
              type="submit" 
              :disabled="isUploading"
              class="trainext-btn-pill-primary h-[38px] px-5 text-xs"
            >
              {{ isUploading ? 'UPLOADING...' : 'SUBMIT REPORT' }}
            </button>
          </div>

        </form>

      </div>
    </div>
  </template>