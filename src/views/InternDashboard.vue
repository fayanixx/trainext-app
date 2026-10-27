<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import { useAttendanceStore } from '@/stores/attendance';
import { useAccomplishmentsStore } from '@/stores/accomplishments';
import type { CompanySite } from '@/types';
import AccomplishmentModal from '@/components/AccomplishmentModal.vue';
import SafeAtBaseModal from '@/components/SafeAtBaseModal.vue';
import GeofenceErrorModal from '@/components/GeofenceErrorModal.vue';
import ProofViewerModal from '@/components/ProofViewerModal.vue';
import ProfileSettingsModal from '@/components/ProfileSettingsModal.vue';
import { useGeolocation } from '@/composables/useGeolocation';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

let realtimeChannel: any = null;
let liveTimerInterval: any = null;
let internMap: L.Map | null = null;
let internUserMarker: L.CircleMarker | null = null;
let internSiteCircle: L.Circle | null = null;
let internSiteMarker: L.Marker | null = null;

const router = useRouter();
const authStore = useAuthStore();
const attendanceStore = useAttendanceStore();
const accomplishmentsStore = useAccomplishmentsStore();
const { coordinates, refreshLocation } = useGeolocation();

// UI Modals
const isProfileSettingsOpen = ref(false);
const isAccomplishmentModalOpen = ref(false);
const isSafeAtBaseModalOpen = ref(false);
const isProofViewerOpen = ref(false);
const showSignOutConfirm = ref(false);
const isSigningOut = ref(false);

const activeProofUrl = ref<string | null>(null);
const activeProofType = ref<'image' | 'document' | 'video' | null>(null);
const activeProofTitle = ref('');

// State
const supervisorSite = ref<CompanySite | null>(null);
const supervisorInfo = ref<{ full_name?: string; email?: string } | null>(null);
const internLinkStatus = ref<'none' | 'pending' | 'approved' | 'rejected'>('none');
const selectedSupervisorId = ref<string | null>(null);
const availableSupervisors = ref<any[]>([]);
const linkingLoading = ref(false);
const linkFeedback = ref<{ type: 'success' | 'error'; message: string } | null>(null);
const isInitialLoading = ref(true);

// Live Timer State
const elapsedTimeText = ref('00h 00m 00s');

// Accomplishment Filter Tabs
const activeAccomplishmentTab = ref<'all' | 'pending' | 'approved' | 'rejected'>('all');

// Geofence Error State
const geofenceError = ref<{
  isOpen: boolean;
  companyName: string;
  formattedDistance: string;
  allowedRadius: number;
}>({
  isOpen: false,
  companyName: '',
  formattedDistance: '0m',
  allowedRadius: 0,
});

// Target Hours Progress Calculation
const requiredHours = computed(() => {
  return Number((authStore.user as any)?.required_hours) || 486;
});

const renderedHours = computed(() => {
  return (attendanceStore.attendanceHistory || []).reduce(
    (acc, log) => acc + (Number(log.hours_rendered) || 0),
    0
  );
});

const progressPercentage = computed(() => {
  if (requiredHours.value <= 0) return 0;
  const pct = (renderedHours.value / requiredHours.value) * 100;
  return Math.min(Math.round(pct), 100);
});

// Shift Status Helpers
const currentShift = computed(() => attendanceStore.activeShift);
const currentStatus = computed(() => attendanceStore.activeShift?.status || null);

const currentStatusText = computed(() => {
  if (currentStatus.value === 'on_duty') return 'On Duty';
  if (currentStatus.value === 'in_transit') return 'In Transit';
  if (currentStatus.value === 'safe_at_base') return 'Safe at Base';
  return 'Not Clocked In';
});

// Filtered Accomplishments
const filteredAccomplishments = computed(() => {
  const logs = accomplishmentsStore.logs || [];
  if (activeAccomplishmentTab.value === 'all') return logs;
  return logs.filter((log: any) => log.status === activeAccomplishmentTab.value);
});

// Stopwatch Tick Calculation
const updateLiveTimer = () => {
  if (currentStatus.value === 'on_duty' && currentShift.value?.time_in) {
    const diffMs = Math.max(0, new Date().getTime() - new Date(currentShift.value.time_in).getTime());
    const totalSecs = Math.floor(diffMs / 1000);
    const hrs = String(Math.floor(totalSecs / 3600)).padStart(2, '0');
    const mins = String(Math.floor((totalSecs % 3600) / 60)).padStart(2, '0');
    const secs = String(totalSecs % 60).padStart(2, '0');
    elapsedTimeText.value = `${hrs}h ${mins}m ${secs}s`;
  } else {
    elapsedTimeText.value = '00h 00m 00s';
  }
};

// Render or Update Intern Leaflet Mini-Map
const renderInternGeofenceMap = () => {
  nextTick(() => {
    const container = document.getElementById('intern-geofence-map');
    if (!container || !supervisorSite.value?.latitude || !supervisorSite.value?.longitude) return;

    const siteLat = Number(supervisorSite.value.latitude);
    const siteLng = Number(supervisorSite.value.longitude);
    const radius = Number(supervisorSite.value.radius_meters || 100);

    if (!internMap) {
      internMap = L.map('intern-geofence-map', {
        zoomControl: false,
        attributionControl: false,
      }).setView([siteLat, siteLng], 16);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(internMap);

      // Site Perimeter Circle (Cyan)
      internSiteCircle = L.circle([siteLat, siteLng], {
        color: '#00d9ff',
        fillColor: '#00d9ff',
        fillOpacity: 0.15,
        weight: 1.5,
        radius: radius,
      }).addTo(internMap);

      // Site Center Pin
      const siteIcon = L.divIcon({
        className: 'custom-leaflet-pin',
        html: `<div style="width: 12px; height: 12px; background: #00d9ff; border: 2px solid #ffffff; border-radius: 50%; box-shadow: 0 0 10px #00d9ff;"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });
      internSiteMarker = L.marker([siteLat, siteLng], { icon: siteIcon }).addTo(internMap);
    } else {
      internMap.invalidateSize();
      if (internSiteCircle) {
        internSiteCircle.setLatLng([siteLat, siteLng]);
        internSiteCircle.setRadius(radius);
      }
      if (internSiteMarker) internSiteMarker.setLatLng([siteLat, siteLng]);
    }

    // User Position Marker (Red dot)
    if (coordinates.value?.latitude && coordinates.value?.longitude) {
      const userLat = Number(coordinates.value.latitude);
      const userLng = Number(coordinates.value.longitude);

      if (!internUserMarker) {
        internUserMarker = L.circleMarker([userLat, userLng], {
          radius: 6,
          color: '#ff3b30',
          fillColor: '#ff3b30',
          fillOpacity: 1,
          weight: 2,
        }).addTo(internMap);
      } else {
        internUserMarker.setLatLng([userLat, userLng]);
      }

      const bounds = L.latLngBounds([
        [siteLat, siteLng],
        [userLat, userLng],
      ]);
      internMap.fitBounds(bounds, { padding: [30, 30] });
    } else {
      internMap.setView([siteLat, siteLng], 16);
    }
  });
};

watch(
  () => [supervisorSite.value, coordinates.value],
  () => {
    setTimeout(renderInternGeofenceMap, 250);
  },
  { deep: true }
);

// Load Intern's Supervisor Affiliation Status
const fetchAffiliation = async () => {
  if (!authStore.user?.id) return;

  try {
    const { data: linkData, error: linkErr } = await supabase
      .from('intern_supervisor_links')
      .select(`
        status, 
        supervisor_id,
        supervisor:profiles!supervisor_id (
          id,
          full_name,
          email
        )
      `)
      .eq('intern_id', authStore.user.id)
      .maybeSingle();

    if (linkErr) throw linkErr;

    if (linkData) {
      internLinkStatus.value = linkData.status;
      supervisorInfo.value = (linkData as any).supervisor || null;

      if (linkData.status === 'approved' && linkData.supervisor_id) {
        const { data: siteData } = await supabase
          .from('company_sites')
          .select('*')
          .eq('supervisor_id', linkData.supervisor_id)
          .maybeSingle();

        supervisorSite.value = (siteData as CompanySite) || null;
      } else {
        supervisorSite.value = null;
      }
    } else {
      internLinkStatus.value = 'none';
      supervisorSite.value = null;
      supervisorInfo.value = null;

      const { data: sites, error: sitesErr } = await supabase
        .from('company_sites')
        .select(`
          id,
          company_name,
          office_address,
          supervisor_id,
          supervisor:profiles!supervisor_id (
            id,
            full_name,
            email
          )
        `);

      if (!sitesErr && sites && sites.length > 0) {
        availableSupervisors.value = sites.map((s: any) => ({
          supervisor_id: s.supervisor_id,
          full_name: s.supervisor?.full_name || 'Assigned Supervisor',
          company_name: s.company_name || 'Designated Workplace',
          address: s.office_address,
        }));
      } else {
        const { data: sups } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('role', 'supervisor');

        availableSupervisors.value = (sups || []).map((sup: any) => ({
          supervisor_id: sup.id,
          full_name: sup.full_name || 'Company Supervisor',
          company_name: 'Workplace Partner',
          address: 'Office Perimeter',
        }));
      }
    }
  } catch (err: any) {
    console.error('Failed to load affiliation:', err.message);
  }
};

// Send Request to Supervisor
const requestAffiliation = async () => {
  if (!selectedSupervisorId.value || !authStore.user?.id) return;
  linkingLoading.value = true;
  linkFeedback.value = null;

  try {
    const { error } = await supabase.from('intern_supervisor_links').insert({
      intern_id: authStore.user.id,
      supervisor_id: selectedSupervisorId.value,
      status: 'pending',
    });

    if (error) throw error;
    internLinkStatus.value = 'pending';
    linkFeedback.value = {
      type: 'success',
      message: 'Request sent! Waiting for supervisor approval.',
    };
  } catch (err: any) {
    linkFeedback.value = {
      type: 'error',
      message: err.message || 'Failed to submit affiliation request.',
    };
  } finally {
    linkingLoading.value = false;
  }
};

// Reset affiliation request
const resetAffiliationRequest = async () => {
  if (!authStore.user?.id) return;
  linkingLoading.value = true;
  linkFeedback.value = null;

  try {
    const { error } = await supabase
      .from('intern_supervisor_links')
      .delete()
      .eq('intern_id', authStore.user.id);

    if (error) throw error;
    internLinkStatus.value = 'none';
    selectedSupervisorId.value = null;
    await fetchAffiliation();
  } catch (err: any) {
    linkFeedback.value = {
      type: 'error',
      message: err.message || 'Failed to reset request.',
    };
  } finally {
    linkingLoading.value = false;
  }
};

// Haversine formula
const computeDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

const handleAttendanceAction = async () => {
  if (!authStore.user?.id) return;

  try {
    const site = supervisorSite.value;
    if (!site?.latitude || !site?.longitude || !site?.radius_meters) {
      alert('No authorized workplace geofence configured yet. Please contact your supervisor.');
      return;
    }

    await refreshLocation();
    const internLat = coordinates.value?.latitude;
    const internLng = coordinates.value?.longitude;

    if (!internLat || !internLng) {
      alert('Unable to detect current GPS location. Please check device location permissions.');
      return;
    }

    const distanceMeters = computeDistanceMeters(
      internLat,
      internLng,
      site.latitude,
      site.longitude
    );

    if (distanceMeters > site.radius_meters) {
      geofenceError.value = {
        isOpen: true,
        companyName: site.company_name || 'Designated Office',
        formattedDistance: `${Math.round(distanceMeters)}m away`,
        allowedRadius: site.radius_meters,
      };
      return;
    }

    if (currentStatus.value === 'on_duty') {
      const timeOutFn = (attendanceStore as any).logTimeOut || (attendanceStore as any).timeOut;
      await timeOutFn({
        internId: authStore.user.id,
        latitude: internLat,
        longitude: internLng,
      });
    } else {
      const timeInFn = (attendanceStore as any).logTimeIn || (attendanceStore as any).timeIn;
      await timeInFn({
        internId: authStore.user.id,
        supervisorId: site.supervisor_id,
        latitude: internLat,
        longitude: internLng,
      });
    }

    await refreshData();
  } catch (err: any) {
    alert(`GPS or Attendance error: ${err.message || 'Failed to verify location.'}`);
  }
};

const inspectMedia = (url: string, type: 'image' | 'document' | 'video', title: string) => {
  activeProofUrl.value = url;
  activeProofType.value = type;
  activeProofTitle.value = title;
  isProofViewerOpen.value = true;
};

const handleSignOut = async () => {
  isSigningOut.value = true;
  try {
    await authStore.signOut();
    showSignOutConfirm.value = false;
    router.push('/auth');
  } catch (err: any) {
    console.error('Sign out error:', err.message);
  } finally {
    isSigningOut.value = false;
  }
};

const refreshData = async () => {
  if (!authStore.user?.id) return;

  const loadHistory =
    (attendanceStore as any).fetchAttendanceHistory ||
    (attendanceStore as any).fetchInternLogs ||
    (attendanceStore as any).fetchHistory;

  await Promise.allSettled([
    fetchAffiliation(),
    attendanceStore.fetchTodayShift(authStore.user.id),
    typeof loadHistory === 'function' ? loadHistory(authStore.user.id) : Promise.resolve(),
    accomplishmentsStore.fetchInternLogs(authStore.user.id),
  ]);

  setTimeout(renderInternGeofenceMap, 200);
};

onMounted(async () => {
  isInitialLoading.value = true;
  try {
    await authStore.fetchProfile();
    if (!authStore.isAuthenticated || !authStore.isIntern || !authStore.user) {
      router.push('/auth');
      return;
    }
    await refreshData();
    await refreshLocation();

    // Start live stopwatch interval
    liveTimerInterval = setInterval(updateLiveTimer, 1000);

    // Supabase Real-Time Subscriptions
    if (authStore.user?.id) {
      realtimeChannel = supabase
        .channel(`intern-live-${authStore.user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'attendance_logs',
            filter: `intern_id=eq.${authStore.user.id}`,
          },
          () => {
            refreshData();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'accomplishment_reports',
            filter: `intern_id=eq.${authStore.user.id}`,
          },
          () => {
            refreshData();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'intern_supervisor_links',
            filter: `intern_id=eq.${authStore.user.id}`,
          },
          () => {
            fetchAffiliation();
          }
        )
        .subscribe();
    }
  } finally {
    isInitialLoading.value = false;
  }
});

onUnmounted(() => {
  if (liveTimerInterval) {
    clearInterval(liveTimerInterval);
  }
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
  }
  if (internMap) {
    internMap.remove();
    internMap = null;
    internUserMarker = null;
    internSiteCircle = null;
    internSiteMarker = null;
  }
});
</script>

<template>
  <main class="trainext-page-shell">
    <div class="trainext-bg-railway" aria-hidden="true"></div>
    <div class="trainext-bg-overlay" aria-hidden="true"></div>

    <div class="trainext-container-layout">
      <!-- HEADER BAR -->
      <header class="trainext-glass-card trainext-header-bar">
        <div class="trainext-brand-group">
          <img src="/assets/trainext-logo.png" alt="TraiNext" class="trainext-logo-mini" />
          <div>
            <span class="trainext-badge-role">Trainee Station</span>
            <h1 class="trainext-heading-name">{{ authStore.user?.full_name || 'Intern Trainee' }}</h1>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button 
            type="button" 
            @click="isProfileSettingsOpen = true"
            class="px-3.5 py-1.5 rounded-full border border-white/20 text-xs text-slate-300 hover:text-white hover:border-[#00d9ff]/50 transition flex items-center gap-1.5 cursor-pointer"
            title="Account Settings"
          >
            <svg class="w-3.5 h-3.5 text-[#00d9ff]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span class="hidden sm:inline">Settings</span>
          </button>

          <!-- SIGN OUT BUTTON -->
          <button 
            type="button" 
            @click="showSignOutConfirm = true"
            class="trainext-btn-signout"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      <!-- INITIAL PAGE LOADER -->
      <div v-if="isInitialLoading" class="trainext-glass-card p-12 text-center flex flex-col items-center justify-center gap-3">
        <div class="w-8 h-8 rounded-full border-2 border-[#00d9ff]/20 border-t-[#00d9ff] animate-spin"></div>
        <p class="text-xs text-slate-300 tracking-wider uppercase font-semibold">Synchronizing Trainee Profile...</p>
      </div>

      <template v-else>
        <!-- AFFILIATION BANNER -->
        <section v-if="internLinkStatus !== 'approved'" class="trainext-glass-card flex flex-col gap-3">
          <div class="flex items-center gap-3">
            <svg class="w-6 h-6 text-[#00d9ff] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <div>
              <h2 class="trainext-title text-base">Host Training Company Status</h2>
              <p class="trainext-subtitle text-[11px]">Connect with your assigned OJT supervisor to enable geofenced tracking.</p>
            </div>
          </div>

          <div v-if="linkFeedback" class="p-2.5 rounded-xl text-xs" :class="linkFeedback.type === 'success' ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300' : 'bg-red-950/60 border border-red-500/40 text-red-300'">
            {{ linkFeedback.message }}
          </div>

          <!-- REJECTED STATE -->
          <div v-if="internLinkStatus === 'rejected'" class="flex flex-col gap-2 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30">
            <div class="flex items-center gap-2 text-rose-300 font-semibold text-xs">
              <svg class="w-4 h-4 shrink-0 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 9l-6 6M9 9l6 6" />
              </svg>
              <span>Affiliation Request Declined</span>
            </div>
            <p class="text-[11px] text-slate-300 leading-relaxed">
              Your previous request to link with the selected company supervisor was declined. You can select another supervisor from the directory to proceed.
            </p>
            <div class="pt-1">
              <button
                type="button"
                @click="resetAffiliationRequest"
                :disabled="linkingLoading"
                class="px-3.5 py-1.5 rounded-full border border-rose-500/50 text-xs text-rose-200 hover:bg-rose-500/20 transition cursor-pointer"
              >
                {{ linkingLoading ? 'Resetting...' : 'Choose Another Supervisor' }}
              </button>
            </div>
          </div>

          <!-- PENDING STATE -->
          <div v-else-if="internLinkStatus === 'pending'" class="flex items-center gap-2.5 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
            <span class="w-2 h-2 rounded-full bg-[#00d9ff] animate-ping"></span>
            <p class="text-xs text-slate-200">Your request is currently awaiting supervisor verification and geofence activation.</p>
          </div>

          <!-- NONE / SELECT SUPERVISOR -->
          <div v-else-if="internLinkStatus === 'none'" class="flex flex-col gap-1.5 pt-1">
            <label class="trainext-label">SELECT SUPERVISOR</label>
            <div class="flex flex-col sm:flex-row gap-2">
              <select v-model="selectedSupervisorId" class="trainext-select-glass flex-1 text-xs">
                <option :value="null" disabled>Choose assigned company supervisor...</option>
                <option 
                  v-for="sup in availableSupervisors" 
                  :key="sup.supervisor_id" 
                  :value="sup.supervisor_id"
                >
                  {{ sup.full_name }} — {{ sup.company_name }}
                </option>
              </select>
              <button 
                type="button" 
                @click="requestAffiliation"
                :disabled="!selectedSupervisorId || linkingLoading"
                class="trainext-btn-pill-primary px-5 h-10 text-xs shrink-0"
              >
                {{ linkingLoading ? 'SENDING...' : 'CONNECT' }}
              </button>
            </div>
          </div>
        </section>

        <!-- METRICS & PROGRESS ROW -->
        <section class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="trainext-glass-card flex flex-col justify-between gap-3">
            <span class="trainext-label">CUMULATIVE PROGRESS</span>
            <div class="flex items-baseline gap-2">
              <span class="text-3xl font-bold tracking-tight text-white">{{ renderedHours.toFixed(1) }}</span>
              <span class="text-xs font-semibold text-[#858994]">/ {{ requiredHours }} hrs</span>            
            </div>
            <div class="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div class="h-full rounded-full bg-gradient-to-r from-[#00d9ff] to-[#53d8f8] shadow-[0_0_8px_#00d9ff]" :style="{ width: `${progressPercentage}%` }"></div>
            </div>
            <span class="text-[10px] font-semibold text-[#00d9ff]">{{ progressPercentage }}% completed target</span>
          </div>

          <!-- OFFICE PERIMETER WITH MINI-MAP -->
          <div class="trainext-glass-card flex flex-col justify-between gap-2">
            <div class="flex items-center justify-between">
              <span class="trainext-label">OFFICE PERIMETER & SUPERVISOR</span>
              <span v-if="supervisorSite" class="text-[10px] font-semibold text-[#00d9ff]">
                Radius: {{ supervisorSite.radius_meters }}m
              </span>
            </div>

            <div>
              <h3 class="text-base font-bold text-white">{{ supervisorSite?.company_name || 'No Site Linked' }}</h3>
              <p class="text-xs text-[#858994] mt-0.5 truncate">{{ supervisorSite?.office_address || 'Geofence access pending supervisor approval' }}</p>
            </div>

            <!-- LIVE MINI-MAP CONTAINER[cite: 7] -->
            <div v-if="supervisorSite" class="w-full h-32 rounded-xl overflow-hidden border border-white/15 my-1 relative">
              <div id="intern-geofence-map" class="w-full h-full z-10"></div>
              <div class="absolute bottom-1.5 left-2 z-[400] bg-black/75 backdrop-blur-sm px-2 py-0.5 rounded text-[9.5px] text-slate-300 border border-white/10 flex items-center gap-2.5">
                <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-[#00d9ff]"></span> Workplace</span>
                <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-[#ff3b30]"></span> You</span>
              </div>
            </div>

            <!-- SUPERVISOR DETAILS -->
            <div v-if="supervisorInfo" class="pt-1.5 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-300">
              <span class="font-medium text-white truncate max-w-[150px]">Supervisor: {{ supervisorInfo.full_name || 'Assigned' }}</span>
              <span class="text-[#00d9ff] font-mono text-[10px] truncate max-w-[140px]">{{ supervisorInfo.email }}</span>
            </div>
          </div>
        </section>

        <!-- MAIN ATTENDANCE & SAFETY ACTION PANEL -->
        <section class="trainext-glass-card flex flex-col gap-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span class="trainext-label">CURRENT SHIFT STATUS</span>
              <div class="mt-1.5 flex items-center gap-3">
                <span 
                  class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider"
                  :class="{
                    'border border-[#00d9ff]/50 bg-[#00d9ff]/10 text-white': currentStatus === 'on_duty',
                    'border border-amber-500/50 bg-amber-500/10 text-amber-300': currentStatus === 'in_transit',
                    'border border-emerald-500/50 bg-emerald-500/10 text-emerald-300': currentStatus === 'safe_at_base',
                    'border border-white/20 bg-white/5 text-[#858994]': !currentStatus
                  }"
                >
                  <span class="w-1.5 h-1.5 rounded-full" :class="{
                    'bg-[#00d9ff] shadow-[0_0_8px_#00d9ff]': currentStatus === 'on_duty',
                    'bg-amber-400 shadow-[0_0_8px_#f59e0b]': currentStatus === 'in_transit',
                    'bg-emerald-400': currentStatus === 'safe_at_base',
                    'bg-[#858994]': !currentStatus
                  }"></span>
                  <span>{{ currentStatusText }}</span>
                </span>

                <!-- LIVE SHIFT STOPWATCH -->
                <div v-if="currentStatus === 'on_duty'" class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-xs font-mono font-bold text-[#00d9ff]">
                  <span class="w-1.5 h-1.5 rounded-full bg-[#00d9ff] animate-ping"></span>
                  <span>{{ elapsedTimeText }}</span>
                </div>
              </div>
            </div>

            <div class="flex gap-2.5">
              <div v-if="currentShift?.time_in" class="p-2 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col">
                <span class="text-[7px] font-bold text-[#858994] tracking-wider uppercase">TIME IN</span>
                <span class="text-xs font-bold text-white font-mono">{{ new Date(currentShift.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}</span>
              </div>
              <div v-if="currentShift?.time_out" class="p-2 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col">
                <span class="text-[7px] font-bold text-[#858994] tracking-wider uppercase">TIME OUT</span>
                <span class="text-xs font-bold text-white font-mono">{{ new Date(currentShift.time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}</span>
              </div>
            </div>
          </div>

          <div class="flex justify-center pt-2">
            <button 
              type="button"
              v-if="currentStatus !== 'in_transit' && currentStatus !== 'safe_at_base'"
              @click="handleAttendanceAction"
              :disabled="attendanceStore.loading || internLinkStatus !== 'approved'"
              class="trainext-btn-pill-primary w-[174px] h-[48px]"
            >
              {{ attendanceStore.loading ? 'CHECKING GPS...' : (currentStatus === 'on_duty' ? 'CLOCK OUT' : 'CLOCK IN') }}
            </button>

            <!-- PULSATING TRANSIT SAFETY ACTION BUTTON -->
            <button 
              type="button"
              v-if="currentStatus === 'in_transit'"
              @click="isSafeAtBaseModalOpen = true"
              class="h-[48px] px-6 rounded-full border border-[#00d9ff]/60 bg-[#00d9ff]/20 shadow-[0_0_20px_rgba(0,217,255,0.35)] text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2.5 cursor-pointer transition hover:bg-[#00d9ff]/30 animate-pulse"
            >
              <svg class="w-4 h-4 text-[#00d9ff]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span>I AM SAFE AT BASE</span>
            </button>
          </div>
        </section>

        <!-- ACCOMPLISHMENTS SECTION -->
        <section class="trainext-glass-card flex flex-col gap-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="trainext-title">Daily Task Accomplishment Reports</h2>
              <p class="trainext-subtitle text-[11px]">Submit daily tasks and attached verification proofs for supervisor approval.</p>
            </div>

            <button 
              type="button" 
              @click="isAccomplishmentModalOpen = true"
              :disabled="internLinkStatus !== 'approved'"
              class="trainext-btn-pill-primary h-[38px] px-4 text-[11px]"
            >
              + NEW REPORT
            </button>
          </div>

          <!-- Accomplishment Filter Tabs -->
          <div class="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto">
            <button 
              v-for="tab in (['all', 'pending', 'approved', 'rejected'] as const)"
              :key="tab"
              type="button"
              @click="activeAccomplishmentTab = tab"
              class="px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider transition cursor-pointer shrink-0"
              :class="activeAccomplishmentTab === tab ? 'bg-cyan-500/20 text-[#00d9ff] border border-cyan-500/50' : 'text-[#858994] hover:text-white'"
            >
              {{ tab }}
            </button>
          </div>

          <div v-if="filteredAccomplishments.length === 0" class="p-8 text-center text-xs text-[#858994]">
            No reports found under '{{ activeAccomplishmentTab }}' filter.
          </div>

          <div v-else class="flex flex-col gap-3">
            <div 
              v-for="log in filteredAccomplishments" 
              :key="log.id"
              class="p-4 rounded-2xl bg-white/[0.02] border border-white/10 flex flex-col gap-2.5"
            >
              <div class="flex items-start justify-between gap-3">
                <div>
                  <h3 class="text-sm font-bold text-white">{{ log.title }}</h3>
                  <div class="flex items-center gap-1.5 text-[10.5px] text-[#858994] mt-0.5">
                    <span class="font-mono">{{ log.report_date }}</span>
                    <span>•</span>
                    <span class="text-[#00d9ff] font-semibold">{{ log.rendered_hours }} hrs rendered</span>
                  </div>
                </div>

                <span 
                  class="trainext-chip"
                  :class="{
                    'chip-emerald': log.status === 'approved',
                    'chip-amber': log.status === 'pending',
                    'chip-rose': log.status === 'rejected'
                  }"
                >
                  {{ log.status }}
                </span>
              </div>

              <p class="text-xs text-slate-300 leading-relaxed">{{ log.description }}</p>

              <div v-if="(log as any).feedback" class="p-2.5 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-200">
                <span class="text-[8px] font-bold uppercase tracking-wider text-red-400 block mb-0.5">SUPERVISOR FEEDBACK:</span>
                <p>{{ (log as any).feedback }}</p>
              </div>

              <div class="flex flex-wrap items-center gap-3 pt-2 border-t border-white/10 text-xs">
                <div v-if="log.proof_images?.length" class="flex items-center gap-1.5">
                  <span class="text-[8px] font-bold uppercase text-[#858994]">IMAGES:</span>
                  <button 
                    v-for="img in log.proof_images" 
                    :key="img"
                    type="button"
                    @click="inspectMedia(img, 'image', log.title)"
                    class="w-8 h-8 rounded-lg overflow-hidden border border-[#00d9ff]/30 bg-black cursor-pointer hover:scale-105 transition"
                  >
                    <img :src="img" alt="Proof" class="w-full h-full object-cover" />
                  </button>
                </div>

                <div v-if="log.proof_documents?.length" class="flex items-center gap-1.5">
                  <span class="text-[8px] font-bold uppercase text-[#858994]">DOCS:</span>
                  <button 
                    v-for="doc in log.proof_documents" 
                    :key="doc"
                    type="button"
                    @click="inspectMedia(doc, 'document', log.title)"
                    class="px-2 py-1 rounded-md bg-white/5 border border-white/20 text-[10px] text-[#00d9ff] flex items-center gap-1 cursor-pointer"
                  >
                    <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <span class="truncate max-w-[90px]">{{ doc.split('/').pop() }}</span>
                  </button>
                </div>

                <div v-if="log.video_url" class="flex items-center gap-1.5">
                  <span class="text-[8px] font-bold uppercase text-[#858994]">VIDEO:</span>
                  <button 
                    type="button"
                    @click="inspectMedia(log.video_url, 'video', log.title)"
                    class="px-2.5 py-1 rounded-md bg-[#00d9ff]/10 border border-[#00d9ff]/30 text-[10px] text-white flex items-center gap-1 cursor-pointer"
                  >
                    <svg class="w-2.5 h-2.5 text-[#00d9ff]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                    <span>Play Demo</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- ATTENDANCE LOGS HISTORY TABLE (PREVIOUS DUTY SESSIONS) -->
        <section class="trainext-glass-card flex flex-col gap-4">
          <div>
            <h2 class="trainext-title">Attendance Shift Records</h2>
            <p class="trainext-subtitle text-[11px]">Audit trail of all previous check-ins, transit clearances, and verified rendered hours.</p>
          </div>

          <div v-if="attendanceStore.attendanceHistory.length === 0" class="p-8 text-center text-xs text-[#858994]">
            No attendance records logged yet. Complete your first duty shift to populate this feed.
          </div>

          <div v-else class="flex flex-col gap-2 pt-1">
            <div 
              v-for="hist in attendanceStore.attendanceHistory" 
              :key="hist.id"
              class="p-3.5 rounded-2xl bg-white/[0.02] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div>
                <div class="flex items-center gap-2">
                  <span class="font-mono text-xs font-bold text-white">{{ hist.date }}</span>
                  <span 
                    class="trainext-chip text-[10px]"
                    :class="{
                      'chip-cyan': hist.status === 'on_duty',
                      'chip-amber': hist.status === 'in_transit',
                      'chip-emerald': hist.status === 'safe_at_base' || (hist.status as string) === 'completed'
                    }"
                  >
                    {{ String(hist.status).replace(/_/g, ' ') }}
                  </span>
                </div>

                <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#858994] mt-1 font-mono">
                  <span>In: {{ hist.time_in ? new Date(hist.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—' }}</span>
                  <span>•</span>
                  <span>Out: {{ hist.time_out ? new Date(hist.time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—' }}</span>
                  <span v-if="(hist as any).safe_at_base_time">•</span>
                  <span v-if="(hist as any).safe_at_base_time" class="text-emerald-400">Safe: {{ new Date((hist as any).safe_at_base_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}</span>
                </div>
              </div>

              <div class="sm:text-right flex items-center justify-between sm:justify-end gap-2 border-t sm:border-t-0 border-white/10 pt-2 sm:pt-0">
                <span class="text-[8px] font-bold uppercase tracking-wider text-[#858994] block sm:inline">RENDERED:</span>
                <span class="text-xs font-bold text-[#00d9ff] font-mono">{{ Number(hist.hours_rendered || 0).toFixed(1) }} hrs</span>
              </div>
            </div>
          </div>
        </section>
      </template>

      <!-- FOOTER -->
      <footer class="trainext-footer-tagline">
        <span>Smart Tracking.</span>
        <span>Real-Time Safety.</span>
      </footer>
    </div>

    <!-- SIGN OUT CONFIRMATION MODAL -->
    <div
      v-if="showSignOutConfirm"
      class="fixed inset-0 z-50 flex items-center justify-center bg-[#05070b]/75 p-4 backdrop-blur-md"
    >
      <div
        class="trainext-glass-card relative w-full max-w-sm overflow-hidden rounded-2xl border border-cyan-400/20 bg-[#0b1019]/95 p-6 shadow-[0_0_40px_rgba(34,211,238,0.08)] animate-in fade-in zoom-in-95 duration-200"
      >
        <div class="absolute left-8 right-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/70 to-transparent"></div>

        <div class="flex items-start gap-4">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-rose-400/25 bg-rose-400/10 text-rose-300">
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </div>

          <div class="min-w-0 flex-1">
            <h3 class="text-base font-semibold tracking-tight text-white">Confirm Sign Out</h3>
            <p class="mt-1.5 text-sm leading-relaxed text-slate-400">Are you sure you want to end your current session?</p>
          </div>
        </div>

        <div class="mt-5 flex items-center justify-end gap-3 border-t border-white/[0.08] pt-4">
          <button
            type="button"
            @click="showSignOutConfirm = false"
            :disabled="isSigningOut"
            class="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-300 transition-all duration-200 hover:border-white/20 hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            @click="handleSignOut"
            :disabled="isSigningOut"
            class="rounded-xl border border-rose-400/30 bg-rose-500/15 px-4 py-2.5 text-sm font-semibold text-rose-300 transition-all duration-200 hover:border-rose-400/50 hover:bg-rose-500/25 hover:shadow-[0_0_18px_rgba(244,63,94,0.12)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {{ isSigningOut ? 'Signing out...' : 'Yes, Sign Out' }}
          </button>
        </div>
      </div>
    </div>

    <!-- MODALS -->
    <AccomplishmentModal 
      :is-open="isAccomplishmentModalOpen"
      :intern-id="authStore.user?.id || ''"
      @close="isAccomplishmentModalOpen = false"
      @saved="refreshData"
    />

    <ProfileSettingsModal 
      :is-open="isProfileSettingsOpen"
      @close="isProfileSettingsOpen = false"
      @saved="authStore.fetchProfile()"
    />

    <SafeAtBaseModal 
      :is-open="isSafeAtBaseModalOpen"
      :log-id="currentShift?.id || ''"
      :intern-id="authStore.user?.id || ''"
      @close="isSafeAtBaseModalOpen = false"
      @confirmed="refreshData"
    />

    <ProofViewerModal 
      :is-open="isProofViewerOpen"
      :media-url="activeProofUrl"
      :media-type="activeProofType"
      :title="activeProofTitle"
      @close="isProofViewerOpen = false"
    />

    <GeofenceErrorModal 
      :is-open="geofenceError.isOpen"
      :company-name="geofenceError.companyName"
      :formatted-distance="geofenceError.formattedDistance"
      :allowed-radius="geofenceError.allowedRadius"
      @close="geofenceError.isOpen = false"
      @retry="geofenceError.isOpen = false; handleAttendanceAction();"
    />
  </main>
</template>