  <script setup lang="ts">
  import { ref, watch, nextTick } from 'vue';
  import { supabase } from '@/lib/supabase';
  import type { CompanySite } from '@/types';
  import L from 'leaflet';
  import 'leaflet/dist/leaflet.css';

  const props = defineProps<{
    isOpen: boolean;
    supervisorId: string;
    initialData?: CompanySite | null;
  }>();

  const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'saved', site: CompanySite): void;
  }>();

  // Form Fields
  const companyName = ref('');
  const officeAddress = ref('');
  const latitude = ref<number>(13.4115);
  const longitude = ref<number>(121.1803);
  const radiusMeters = ref<number>(100);

  // UI States
  const isSubmitting = ref(false);
  const isLocating = ref(false);
  const errorMessage = ref('');

  // Leaflet Map References
  let map: L.Map | null = null;
  let marker: L.Marker | null = null;
  let circle: L.Circle | null = null;

  // Initialize or Update Map
  const initMap = () => {
    nextTick(() => {
      const mapContainer = document.getElementById('geofence-map');
      if (!mapContainer) return;

      if (!map) {
        map = L.map('geofence-map').setView([latitude.value, longitude.value], 16);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);

        // Custom Cyan Pin
        const cyanIcon = L.divIcon({
          className: 'custom-leaflet-pin',
          html: `<div style="width: 14px; height: 14px; background: #00d9ff; border: 2px solid #ffffff; border-radius: 50%; box-shadow: 0 0 10px #00d9ff;"></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });

        marker = L.marker([latitude.value, longitude.value], { icon: cyanIcon, draggable: true }).addTo(map);

        circle = L.circle([latitude.value, longitude.value], {
          color: '#00d9ff',
          fillColor: '#00d9ff',
          fillOpacity: 0.18,
          weight: 1.5,
          radius: radiusMeters.value,
        }).addTo(map);

        marker.on('dragend', () => {
          if (!marker) return;
          const pos = marker.getLatLng();
          latitude.value = parseFloat(pos.lat.toFixed(6));
          longitude.value = parseFloat(pos.lng.toFixed(6));
          if (circle) circle.setLatLng(pos);
        });

        map.on('click', (e: L.LeafletMouseEvent) => {
          latitude.value = parseFloat(e.latlng.lat.toFixed(6));
          longitude.value = parseFloat(e.latlng.lng.toFixed(6));
          if (marker) marker.setLatLng(e.latlng);
          if (circle) circle.setLatLng(e.latlng);
        });
      } else {
        map.invalidateSize();
        map.setView([latitude.value, longitude.value], 16);
        if (marker) marker.setLatLng([latitude.value, longitude.value]);
        if (circle) {
          circle.setLatLng([latitude.value, longitude.value]);
          circle.setRadius(radiusMeters.value);
        }
      }
    });
  };

  // Acquire Current GPS Coordinates
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      errorMessage.value = 'Geolocation is not supported by your browser.';
      return;
    }

    isLocating.value = true;
    errorMessage.value = '';

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        latitude.value = parseFloat(pos.coords.latitude.toFixed(6));
        longitude.value = parseFloat(pos.coords.longitude.toFixed(6));
        if (map) {
          map.setView([latitude.value, longitude.value], 17);
          if (marker) marker.setLatLng([latitude.value, longitude.value]);
          if (circle) circle.setLatLng([latitude.value, longitude.value]);
        }
        isLocating.value = false;
      },
      (err) => {
        errorMessage.value = `Location error: ${err.message}`;
        isLocating.value = false;
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Watch for Radius Slider Changes
  watch(radiusMeters, (newRadius) => {
    if (circle) {
      circle.setRadius(newRadius);
    }
  });

  // Watch isOpen to populate data and trigger map layout
  watch(
    () => props.isOpen,
    (open) => {
      if (open) {
        if (props.initialData) {
          companyName.value = props.initialData.company_name;
          officeAddress.value = props.initialData.office_address;
          latitude.value = props.initialData.latitude;
          longitude.value = props.initialData.longitude;
          radiusMeters.value = props.initialData.radius_meters;
        }
        setTimeout(initMap, 200);
      } else {
        if (map) {
          map.remove();
          map = null;
          marker = null;
          circle = null;
        }
      }
    }
  );

  // Save or Update Geofence
  const handleSave = async () => {
    if (!companyName.value.trim() || !officeAddress.value.trim()) {
      errorMessage.value = 'Please provide company name and office address.';
      return;
    }

    isSubmitting.value = true;
    errorMessage.value = '';

    try {
      const payload = {
        supervisor_id: props.supervisorId,
        company_name: companyName.value.trim(),
        office_address: officeAddress.value.trim(),
        latitude: latitude.value,
        longitude: longitude.value,
        radius_meters: Number(radiusMeters.value),
      };

      let resultData: CompanySite;

      if (props.initialData?.id) {
        const { data, error } = await supabase
          .from('company_sites')
          .update(payload)
          .eq('id', props.initialData.id)
          .select()
          .single();

        if (error) throw error;
        resultData = data as CompanySite;
      } else {
        const { data, error } = await supabase
          .from('company_sites')
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        resultData = data as CompanySite;
      }

      emit('saved', resultData);
      emit('close');
    } catch (err: any) {
      errorMessage.value = err.message || 'Failed to save geofence settings.';
    } finally {
      isSubmitting.value = false;
    }
  };
  </script>

  <template>
    <div 
      v-if="isOpen" 
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm select-none overflow-y-auto"
    >
      <div class="w-full max-w-xl my-auto trainext-glass-card rounded-[28px] p-6 flex flex-col gap-4 border border-white/20 shadow-2xl">
        
        <!-- HEADER -->
        <div class="flex items-center justify-between pb-2 border-b border-white/10">
          <div>
            <h2 class="text-base font-bold text-white tracking-tight">Configure Office Perimeter</h2>
            <p class="text-[11px] text-[#00d9ff]">Set the precise GPS boundaries for automatic intern attendance verification.</p>
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

        <!-- ERROR FEEDBACK -->
        <div v-if="errorMessage" class="p-2.5 rounded-xl bg-red-950/60 border border-red-500/40 text-xs text-red-200">
          {{ errorMessage }}
        </div>

        <!-- FORM FIELDS -->
        <form @submit.prevent="handleSave" class="flex flex-col gap-3.5">
          
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <!-- COMPANY NAME -->
            <div class="flex flex-col gap-1">
              <label class="trainext-label">COMPANY / AGENCY NAME</label>
              <input 
                v-model="companyName" 
                type="text" 
                required
                placeholder="e.g. Provincial Capitol IT Division"
                class="w-full h-9 px-3 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder:text-[#858994] outline-none focus:border-[#00d9ff]"
              />
            </div>

            <!-- OFFICE ADDRESS -->
            <div class="flex flex-col gap-1">
              <label class="trainext-label">OFFICE PHYSICAL ADDRESS</label>
              <input 
                v-model="officeAddress" 
                type="text" 
                required
                placeholder="e.g. Gov. Infantado St., Calapan City"
                class="w-full h-9 px-3 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder:text-[#858994] outline-none focus:border-[#00d9ff]"
              />
            </div>
          </div>

          <!-- LEAFLET MAP CONTAINER -->
          <div class="flex flex-col gap-1.5 pt-1">
            <div class="flex items-center justify-between">
              <label class="trainext-label">MAP POSITION & PIN (CLICK OR DRAG)</label>
              <button 
                type="button" 
                @click="getCurrentLocation"
                :disabled="isLocating"
                class="text-[10.5px] text-[#00d9ff] hover:underline flex items-center gap-1 font-semibold cursor-pointer"
              >
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="12" cy="12" r="3" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 2v3m0 14v3m10-10h-3M5 12H2" />
                </svg>
                <span>{{ isLocating ? 'Locating...' : 'Use My Current GPS' }}</span>
              </button>
            </div>

            <div 
              id="geofence-map" 
              class="w-full h-44 rounded-xl overflow-hidden border border-white/20 z-10"
            ></div>
          </div>

          <!-- COORDINATES & RADIUS STRIP -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div class="flex flex-col gap-1">
              <label class="trainext-label">LATITUDE</label>
              <input 
                v-model.number="latitude" 
                type="number" 
                step="any"
                required
                class="w-full h-8 px-2.5 rounded-lg bg-black/40 border border-white/15 text-xs text-slate-300 font-mono outline-none"
              />
            </div>

            <div class="flex flex-col gap-1">
              <label class="trainext-label">LONGITUDE</label>
              <input 
                v-model.number="longitude" 
                type="number" 
                step="any"
                required
                class="w-full h-8 px-2.5 rounded-lg bg-black/40 border border-white/15 text-xs text-slate-300 font-mono outline-none"
              />
            </div>

            <div class="flex flex-col gap-1">
              <div class="flex justify-between items-center">
                <label class="trainext-label">RADIUS</label>
                <span class="text-[10px] font-bold text-[#00d9ff] font-mono">{{ radiusMeters }}m</span>
              </div>
              <input 
                v-model.number="radiusMeters" 
                type="range" 
                min="20" 
                max="1000" 
                step="10"
                class="w-full accent-[#00d9ff] cursor-pointer mt-1"
              />
            </div>
          </div>

          <!-- ACTIONS -->
          <div class="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
            <button 
              type="button" 
              @click="emit('close')"
              :disabled="isSubmitting"
              class="px-4 py-2 rounded-full border border-white/20 text-xs text-slate-300 hover:text-white transition cursor-pointer"
            >
              Cancel
            </button>

            <button 
              type="submit" 
              :disabled="isSubmitting"
              class="trainext-btn-pill-primary h-[38px] px-5 text-xs"
            >
              {{ isSubmitting ? 'SAVING...' : 'SAVE PERIMETER' }}
            </button>
          </div>

        </form>

      </div>
    </div>
  </template>