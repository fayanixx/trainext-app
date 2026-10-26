<script setup lang="ts">
import { ref, watch } from 'vue';
import { supabase } from '@/lib/supabase';
import type { CompanySite } from '@/types';

const props = defineProps<{
  isOpen: boolean;
  supervisorId: string;
  initialData?: CompanySite | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'saved', site: CompanySite): void;
}>();

// Form States
const companyName = ref('');
const officeAddress = ref('');
const latitude = ref<number>(13.4115);
const longitude = ref<number>(121.1803);
const radiusMeters = ref<number>(150);

const loading = ref(false);
const locating = ref(false);
const errorMsg = ref('');
const successMsg = ref('');

// Populate fields whenever initial data changes or modal opens
watch(
  () => props.initialData,
  (site) => {
    if (site) {
      companyName.value = site.company_name;
      officeAddress.value = site.office_address;
      latitude.value = site.latitude;
      longitude.value = site.longitude;
      radiusMeters.value = site.radius_meters || 150;
    }
  },
  { immediate: true }
);

// Fetch current supervisor device GPS location
const fetchCurrentCoordinates = () => {
  if (!navigator.geolocation) {
    errorMsg.value = 'Geolocation is not supported by your current browser or device.';
    return;
  }

  locating.value = true;
  errorMsg.value = '';

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      latitude.value = Number(pos.coords.latitude.toFixed(6));
      longitude.value = Number(pos.coords.longitude.toFixed(6));
      locating.value = false;
      successMsg.value = 'Current location pinned successfully!';
      setTimeout(() => {
        successMsg.value = '';
      }, 3000);
    },
    (err) => {
      locating.value = false;
      errorMsg.value = `Unable to fetch location: ${err.message}. Please allow location access.`;
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
};

// Save or Update Company Site Record
const handleSave = async () => {
  errorMsg.value = '';
  successMsg.value = '';

  if (!companyName.value.trim() || !officeAddress.value.trim()) {
    errorMsg.value = 'Please provide both company name and office address.';
    return;
  }

  if (!latitude.value || !longitude.value) {
    errorMsg.value = 'Valid GPS coordinates are required.';
    return;
  }

  loading.value = true;
  try {
    const payload = {
      supervisor_id: props.supervisorId,
      company_name: companyName.value.trim(),
      office_address: officeAddress.value.trim(),
      latitude: latitude.value,
      longitude: longitude.value,
      radius_meters: radiusMeters.value,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('company_sites')
      .upsert(payload, { onConflict: 'supervisor_id' })
      .select()
      .single();

    if (error) throw error;

    emit('saved', data as CompanySite);
    emit('close');
  } catch (err: any) {
    errorMsg.value = err.message || 'Failed to save company geofence parameters.';
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-navy-950/80 backdrop-blur-md">
      <!-- Backdrop Click to Dismiss -->
      <div class="fixed inset-0" @click="emit('close')"></div>

      <!-- Glass Modal Sheet Container -->
      <div 
        class="relative w-full sm:max-w-lg max-h-[90vh] overflow-y-auto z-10 flex flex-col
               bg-[#0d1527]/95 border-t sm:border border-cyan-500/35 rounded-t-[2.5rem] sm:rounded-2xl
               shadow-[0_0_50px_rgba(6,182,212,0.22)] text-slate-100 backdrop-blur-2xl"
      >
        <!-- iOS Sheet Drag Handle (Mobile Only) -->
        <div class="sm:hidden w-12 h-1 bg-slate-600/60 rounded-full mx-auto mt-3 mb-1"></div>

        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-800/80">
          <div>
            <h3 class="text-base font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-400">
              Office Geofence Setup
            </h3>
            <p class="text-[11px] text-slate-400 mt-0.5">
              Configure company address, office pin, and allowed radius
            </p>
          </div>
          <button 
            @click="emit('close')"
            class="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800/70 hover:bg-slate-700/80 text-slate-300 text-sm transition"
          >
            ✕
          </button>
        </div>

        <!-- Form Content -->
        <div class="p-6 space-y-4 overflow-y-auto">
          <!-- Notification Banners -->
          <div v-if="successMsg" class="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-300 font-medium">
            {{ successMsg }}
          </div>
          <div v-if="errorMsg" class="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-xs text-red-300 font-medium">
            {{ errorMsg }}
          </div>

          <!-- Company Name -->
          <div class="space-y-1">
            <label class="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Company / Agency Name</label>
            <input 
              v-model="companyName" 
              type="text" 
              required
              placeholder="e.g., Tech Solutions Inc. / City Hall"
              class="w-full px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-100 text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none transition"
            />
          </div>

          <!-- Main Office Address -->
          <div class="space-y-1">
            <label class="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Main Office Address</label>
            <input 
              v-model="officeAddress" 
              type="text" 
              required
              placeholder="e.g., Building Name, Street, Barangay, City"
              class="w-full px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-100 text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none transition"
            />
          </div>

          <!-- GPS Coordinates Grid with GPS Pin Action -->
          <div class="space-y-2 pt-1">
            <div class="flex items-center justify-between">
              <label class="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Office GPS Coordinates</label>
              <button 
                type="button" 
                @click="fetchCurrentCoordinates"
                :disabled="locating"
                class="inline-flex items-center gap-1.5 text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 transition"
              >
                <span>📍</span>
                <span>{{ locating ? 'Locating...' : 'Use Current Device Pin' }}</span>
              </button>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <span class="text-[10px] text-slate-400 font-medium">Latitude</span>
                <input 
                  v-model.number="latitude" 
                  type="number" 
                  step="any"
                  required
                  class="w-full px-3.5 py-2 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-100 text-xs font-mono focus:border-cyan-400 outline-none transition"
                />
              </div>
              <div>
                <span class="text-[10px] text-slate-400 font-medium">Longitude</span>
                <input 
                  v-model.number="longitude" 
                  type="number" 
                  step="any"
                  required
                  class="w-full px-3.5 py-2 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-100 text-xs font-mono focus:border-cyan-400 outline-none transition"
                />
              </div>
            </div>
          </div>

          <!-- Geofence Radius Slider -->
          <div class="space-y-2 pt-2">
            <div class="flex items-center justify-between text-xs">
              <span class="font-bold text-slate-300 uppercase tracking-wider text-[11px]">Geofence Perimeter Radius</span>
              <span class="font-mono font-bold text-cyan-400 bg-cyan-950/60 px-2.5 py-1 rounded-md border border-cyan-500/30">
                {{ radiusMeters }} meters
              </span>
            </div>
            <input 
              v-model.number="radiusMeters" 
              type="range" 
              min="50" 
              max="500" 
              step="10" 
              class="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div class="flex justify-between text-[10px] text-slate-400">
              <span>50m (Strict Room/Floor)</span>
              <span>150m (Standard Compound)</span>
              <span>500m (Large Campus)</span>
            </div>
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="px-6 py-4 border-t border-slate-800/80 bg-slate-900/40 flex items-center justify-end gap-3">
          <button 
            type="button" 
            @click="emit('close')" 
            class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition"
          >
            Cancel
          </button>
          <button 
            type="button" 
            @click="handleSave"
            :disabled="loading"
            class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(6,182,212,0.35)] disabled:opacity-50 transition"
          >
            {{ loading ? 'Saving...' : 'Save Office Geofence' }}
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