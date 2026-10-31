<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import { useAttendanceStore } from '@/stores/attendance';
import { useAccomplishmentsStore } from '@/stores/accomplishments';
import { useGeolocation } from '@/composables/useGeolocation';
import { useToast } from '@/composables/useToast';
import type { CompanySite } from '@/types';
import AccomplishmentModal from '@/components/AccomplishmentModal.vue';
import AccomplishmentDetailModal from '@/components/AccomplishmentDetailModal.vue';
import SafeAtBaseModal from '@/components/SafeAtBaseModal.vue';
import GeofenceErrorModal from '@/components/GeofenceErrorModal.vue';
import ProofViewerModal from '@/components/ProofViewerModal.vue';
import ProfileSettingsModal from '@/components/ProfileSettingsModal.vue';
import TraiNextSpinner from '@/components/TraiNextSpinner.vue';
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
const toast = useToast();
const { coordinates, refreshLocation } = useGeolocation();

// Active Bottom Tab ('home' | 'reports' | 'attendance')
const activeMainTab = ref<'home' | 'reports' | 'attendance'>('home');

// UI Modals
const isProfileSettingsOpen = ref(false);
const isAccomplishmentModalOpen = ref(false);
const isSafeAtBaseModalOpen = ref(false);
const isProofViewerOpen = ref(false);
const showSignOutConfirm = ref(false);
const isSigningOut = ref(false);

// Detail Modal State
const isDetailModalOpen = ref(false);
const selectedLogForDetail = ref<any | null>(null);

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
const isInitialLoading = ref(true);

// State para sa pag-track kung nabisita na ang Reports tab (notif dismiss logic)
const hasViewedReportsTab = ref(false);

// Instant Click Visual Feedback State para sa Clock In/Out
const isVerifying = ref(false);

// Live Timer State
const elapsedTimeText = ref('00h 00m 00s');

// Accomplishment Filters
const activeAccomplishmentTab = ref<'all' | 'pending' | 'approved' | 'rejected'>('all');
const reportDateFilter = ref<string>(''); // Filter by Date

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

// Raw count ng mga may feedback
const rawFeedbackCount = computed(() => {
  return (accomplishmentsStore.logs || []).filter((l: any) => l.feedback && l.status !== 'pending').length;
});

// Notification Badge Counter: kapag nabisita na ang reports tab, nagiging 0 ito
const unreadFeedbackCount = computed(() => {
  if (hasViewedReportsTab.value) return 0;
  return rawFeedbackCount.value;
});

// Watcher kapag lumipat sa reports tab
watch(activeMainTab, (newTab) => {
  if (newTab === 'reports') {
    hasViewedReportsTab.value = true;
  }
});

// Watcher: kung may dumating na bagong feedback habang wala sa reports tab, ibalik ang badge
watch(rawFeedbackCount, (newVal, oldVal) => {
  if (newVal > oldVal && activeMainTab.value !== 'reports') {
    hasViewedReportsTab.value = false;
  }
});

// Filtered Accomplishments (Tab + Date Filter)
const filteredAccomplishments = computed(() => {
  let list = accomplishmentsStore.logs || [];
  if (activeAccomplishmentTab.value !== 'all') {
    list = list.filter((log: any) => log.status === activeAccomplishmentTab.value);
  }
  if (reportDateFilter.value) {
    list = list.filter((log: any) => log.report_date === reportDateFilter.value);
  }
  return list;
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

// Render Intern Leaflet Mini-Map
const renderInternGeofenceMap = () => {
  if (activeMainTab.value !== 'home') return;
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

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(internMap);

      internSiteCircle = L.circle([siteLat, siteLng], {
        color: '#00d9ff',
        fillColor: '#00d9ff',
        fillOpacity: 0.15,
        weight: 1.5,
        radius: radius,
      }).addTo(internMap);

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

      const bounds = L.latLngBounds([[siteLat, siteLng], [userLat, userLng]]);
      internMap.fitBounds(bounds, { padding: [30, 30] });
    } else {
      internMap.setView([siteLat, siteLng], 16);
    }
  });
};

watch(
  () => [supervisorSite.value, coordinates.value, activeMainTab.value],
  () => {
    if (activeMainTab.value === 'home') {
      setTimeout(renderInternGeofenceMap, 250);
    }
  },
  { deep: true }
);

// Load Supervisor Affiliation Status
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

      const { data: sites } = await supabase
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

      if (sites && sites.length > 0) {
        availableSupervisors.value = sites.map((s: any) => ({
          supervisor_id: s.supervisor_id,
          full_name: s.supervisor?.full_name || 'Assigned Supervisor',
          company_name: s.company_name || 'Designated Workplace',
          address: s.office_address,
        }));
      }
    }
  } catch (err: any) {
    console.error('Failed to load affiliation:', err.message);
  }
};

const requestAffiliation = async () => {
  if (!selectedSupervisorId.value || !authStore.user?.id) return;
  linkingLoading.value = true;

  try {
    const { error } = await supabase.from('intern_supervisor_links').insert({
      intern_id: authStore.user.id,
      supervisor_id: selectedSupervisorId.value,
      status: 'pending',
    });

    if (error) throw error;
    internLinkStatus.value = 'pending';
    toast.success('Affiliation request submitted to supervisor.', 'REQUEST SENT');
  } catch (err: any) {
    toast.error(err.message || 'Failed to submit affiliation request.', 'REQUEST FAILED');
  } finally {
    linkingLoading.value = false;
  }
};

const computeDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const handleAttendanceAction = async () => {
  if (!authStore.user?.id || isVerifying.value || attendanceStore.loading) return;

  isVerifying.value = true;

  try {
    const site = supervisorSite.value;
    if (!site?.latitude || !site?.longitude || !site?.radius_meters) {
      toast.warning('No authorized workplace geofence configured yet.', 'GEOFENCE MISSING');
      return;
    }

    await refreshLocation();
    const internLat = coordinates.value?.latitude;
    const internLng = coordinates.value?.longitude;

    if (!internLat || !internLng) {
      toast.error('Unable to detect current GPS location. Please check device location settings.', 'GPS UNAVAILABLE');
      return;
    }

    const distanceMeters = computeDistanceMeters(internLat, internLng, site.latitude, site.longitude);

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
      await attendanceStore.logTimeOut({ internId: authStore.user.id, latitude: internLat, longitude: internLng });
      toast.success('Successfully clocked out. Shift marked In Transit.', 'CLOCK OUT VERIFIED');
    } else {
      await attendanceStore.logTimeIn({ internId: authStore.user.id, latitude: internLat, longitude: internLng });
      toast.success('Successfully clocked in within office perimeter.', 'CLOCK IN VERIFIED');
    }

    await refreshData();
  } catch (err: any) {
    toast.error(err.message || 'Failed to verify location.', 'ATTENDANCE ERROR');
  } finally {
    isVerifying.value = false;
  }
};

const openLogDetail = (log: any) => {
  selectedLogForDetail.value = log;
  isDetailModalOpen.value = true;
};

const inspectMedia = (url: string, type: 'image' | 'document' | 'video', title: string) => {
  activeProofUrl.value = url;
  activeProofType.value = type;
  activeProofTitle.value = title;
  isProofViewerOpen.value = true;
};

const handleSignOut = async () => {
  showSignOutConfirm.value = false;
  isSigningOut.value = true;
  try {
    await authStore.signOut();
    router.replace('/auth');
  } catch (err: any) {
    console.error('Sign out error:', err.message);
    toast.error('Failed to cleanly terminate session.', 'SIGN OUT ERROR');
  } finally {
    isSigningOut.value = false;
  }
};

const refreshData = async () => {
  if (!authStore.user?.id) return;

  await Promise.allSettled([
    fetchAffiliation(),
    attendanceStore.fetchTodayShift(authStore.user.id),
    attendanceStore.fetchAttendanceHistory(authStore.user.id),
    accomplishmentsStore.fetchInternLogs(authStore.user.id),
  ]);

  if (selectedLogForDetail.value) {
    const updated = (accomplishmentsStore.logs || []).find((l: any) => l.id === selectedLogForDetail.value.id);
    if (updated) {
      selectedLogForDetail.value = updated;
    }
  }

  if (activeMainTab.value === 'home') {
    setTimeout(renderInternGeofenceMap, 200);
  }
};

onMounted(async () => {
  isInitialLoading.value = true;
  try {
    await authStore.fetchProfile();
    if (!authStore.isAuthenticated || !authStore.isIntern || !authStore.user) {
      router.replace('/auth');
      return;
    }
    await refreshData();
    await refreshLocation();

    liveTimerInterval = setInterval(updateLiveTimer, 1000);

    if (authStore.user?.id) {
      realtimeChannel = supabase
        .channel(`intern-live-${authStore.user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'attendance_logs', filter: `intern_id=eq.${authStore.user.id}` },
          () => refreshData()
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'accomplishment_reports', filter: `intern_id=eq.${authStore.user.id}` },
          (payload: any) => {
            refreshData();
            if (payload.new && payload.new.feedback) {
              toast.info(`Supervisor remarked: "${payload.new.feedback}"`, 'FEEDBACK RECEIVED');
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'intern_supervisor_links', filter: `intern_id=eq.${authStore.user.id}` },
          () => fetchAffiliation()
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'company_sites' },
          async () => {
            await fetchAffiliation();
            renderInternGeofenceMap();
          }
        )
        .subscribe();
    }
  } finally {
    isInitialLoading.value = false;
  }
});

onUnmounted(() => {
  if (liveTimerInterval) clearInterval(liveTimerInterval);
  if (realtimeChannel) supabase.removeChannel(realtimeChannel);
  if (internMap) {
    internMap.remove();
    internMap = null;
  }
});
</script>

<template>
  <main class="trainext-page-shell pb-24">
    <div class="trainext-bg-railway" aria-hidden="true"></div>
    <div class="trainext-bg-overlay" aria-hidden="true"></div>

    <!-- FULLSCREEN BRANDED SPINNERS -->
    <TraiNextSpinner v-if="isInitialLoading" label="Loading..." />
    <TraiNextSpinner v-if="isSigningOut" label="Signing Out..." />

    <!-- STICKY HEADER BAR (FLAT, ZERO CORNER ROUNDING PARA FLAT SA SCROLL) -->
    <header class="trainext-glass-card sticky-intern-header flex items-center justify-between gap-2 px-3.5 sm:px-5 py-3">
      <div class="trainext-brand-group flex items-center gap-2.5 min-w-0">
        <img src="/assets/trainext-logo.png" alt="TraiNext" class="w-8 h-8 sm:w-9 sm:h-9 object-contain shrink-0" />
        <div class="min-w-0">
          <span class="trainext-badge-role text-[9px] sm:text-[10px] tracking-wider block">Trainee Station</span>
          <h1 class="trainext-heading-name text-xs sm:text-sm font-bold text-white truncate max-w-[150px] sm:max-w-none">
            {{ authStore.user?.full_name || 'Intern Trainee' }}
          </h1>
        </div>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <button 
          type="button" 
          @click="isProfileSettingsOpen = true"
          class="header-action-btn flex items-center justify-center cursor-pointer transition-all"
          title="Account Settings"
          aria-label="Account Settings"
        >
          <svg class="w-4 h-4 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        <button 
          type="button" 
          @click="showSignOutConfirm = true"
          class="header-action-btn flex items-center justify-center gap-1.5 text-xs font-semibold text-rose-300 hover:text-rose-200 border-rose-500/30 hover:border-rose-500/50 hover:bg-rose-500/10 cursor-pointer transition-all px-3"
          title="Sign Out"
        >
          <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </header>

    <div v-show="!isInitialLoading && !isSigningOut" class="trainext-container-layout pt-3">
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

        <div v-if="internLinkStatus === 'none'" class="flex flex-col gap-1.5 pt-1">
          <label class="trainext-label text-[10px]">SELECT SUPERVISOR</label>
          <div class="flex flex-col sm:flex-row gap-2">
            <select v-model="selectedSupervisorId" class="trainext-select-glass flex-1 text-xs">
              <option :value="null" disabled>Choose assigned company supervisor...</option>
              <option v-for="sup in availableSupervisors" :key="sup.supervisor_id" :value="sup.supervisor_id">
                {{ sup.full_name }} — {{ sup.company_name }}
              </option>
            </select>
            <button 
              type="button" 
              @click="requestAffiliation"
              :disabled="!selectedSupervisorId || linkingLoading"
              class="new-report-pill-btn h-10 px-5 text-xs shrink-0 cursor-pointer"
            >
              {{ linkingLoading ? 'SENDING...' : 'CONNECT' }}
            </button>
          </div>
        </div>
      </section>

      <!-- ================= TAB 1: HOME TAB ================= -->
      <div v-show="activeMainTab === 'home'" class="tab-pane-container">
        <!-- CUMULATIVE PROGRESS -->
        <section class="trainext-glass-card p-4 sm:p-5 flex flex-col gap-2.5">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span class="text-xs sm:text-[12px] font-bold uppercase tracking-wider text-slate-200 font-['Aileron',sans-serif]">
                CUMULATIVE PROGRESS
              </span>
              <div class="flex items-baseline gap-2 mt-0.5">
                <span class="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">{{ renderedHours.toFixed(1) }}</span>
                <span class="text-xs font-semibold text-slate-400">/ {{ requiredHours }} hrs target</span>
              </div>
            </div>
            <div class="text-right">
              <span class="text-xs font-bold text-[#00d9ff] font-mono">{{ progressPercentage }}%</span>
              <span class="block text-[9.5px] text-[#858994] font-medium">Verified Rendered</span>
            </div>
          </div>

          <div class="w-full h-2 rounded-full bg-white/10 overflow-hidden relative">
            <div 
              class="h-full rounded-full bg-gradient-to-r from-[#00d9ff] to-[#53d8f8] shadow-[0_0_10px_#00d9ff] transition-all duration-500 ease-out" 
              :style="{ width: `${progressPercentage}%` }"
            ></div>
          </div>
        </section>

        <!-- OFFICE PERIMETER & SHIFT STATUS ROW -->
        <section class="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
          <!-- OFFICE PERIMETER -->
          <div class="trainext-glass-card flex flex-col justify-between gap-1 p-4 sm:p-5">
            <div class="flex items-center justify-between">
              <span class="text-xs sm:text-[12px] font-bold uppercase tracking-wider text-slate-200 font-['Aileron',sans-serif]">
                OFFICE PERIMETER &amp; SUPERVISOR
              </span>
              <span v-if="supervisorSite" class="text-[10px] font-semibold text-[#00d9ff] font-mono">
                Radius: {{ supervisorSite.radius_meters }}m
              </span>
            </div>

            <div>
              <h3 class="text-sm sm:text-base font-bold text-white">{{ supervisorSite?.company_name || 'No Site Linked' }}</h3>
              <p class="text-xs text-[#858994] mt-0.5 truncate">{{ supervisorSite?.office_address || 'Geofence access pending supervisor approval' }}</p>
            </div>

            <!-- MINI MAP -->
            <div v-if="supervisorSite" class="w-full h-52 sm:h-60 rounded-2xl overflow-hidden border border-white/20 relative my-2 shadow-inner">
              <div id="intern-geofence-map" class="w-full h-full z-10"></div>
              <div class="absolute bottom-2.5 left-2.5 z-[400] bg-black/85 backdrop-blur-md px-3 py-1.5 rounded-lg text-[10px] text-slate-200 border border-white/15 flex items-center gap-3 shadow-lg">
                <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-[#00d9ff] shadow-[0_0_8px_#00d9ff]"></span> Workplace</span>
                <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-[#ff3b30] shadow-[0_0_8px_#ff3b30]"></span> You</span>
              </div>
            </div>

            <div v-if="supervisorInfo" class="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-300">
              <span class="font-medium text-white truncate max-w-[160px]">Supervisor: {{ supervisorInfo.full_name || 'Assigned' }}</span>
              <span class="text-[#00d9ff] font-mono text-[10px] truncate max-w-[140px]">{{ supervisorInfo.email }}</span>
            </div>
          </div>

          <!-- CURRENT SHIFT STATUS & ACTION PANEL -->
          <div class="trainext-glass-card flex flex-col justify-between gap-3 p-4 sm:p-5">
            <div>
              <span class="text-xs sm:text-[12px] font-bold uppercase tracking-wider text-slate-200 font-['Aileron',sans-serif]">
                CURRENT SHIFT STATUS
              </span>
              <div class="mt-2 flex flex-wrap items-center gap-1.5">
                <span 
                  class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider"
                  :class="{
                    'border border-[#00d9ff]/50 bg-[#00d9ff]/10 text-white': currentStatus === 'on_duty',
                    'border border-amber-500/50 bg-amber-500/10 text-amber-300': currentStatus === 'in_transit',
                    'border border-emerald-500/50 bg-emerald-500/10 text-emerald-300': currentStatus === 'safe_at_base',
                    'border border-white/20 bg-white/5 text-[#858994]': !currentStatus
                  }"
                >
                  <span class="w-2 h-2 rounded-full" :class="{
                    'bg-[#00d9ff] shadow-[0_0_8px_#00d9ff]': currentStatus === 'on_duty',
                    'bg-amber-400 shadow-[0_0_8px_#f59e0b]': currentStatus === 'in_transit',
                    'bg-emerald-400': currentStatus === 'safe_at_base',
                    'bg-[#858994]': !currentStatus
                  }"></span>
                  <span>{{ currentStatusText }}</span>
                </span>

                <div v-if="currentStatus === 'on_duty'" class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-xs font-mono font-bold text-[#00d9ff]">
                  <span class="w-1.5 h-1.5 rounded-full bg-[#00d9ff] animate-ping"></span>
                  <span>{{ elapsedTimeText }}</span>
                </div>
              </div>
            </div>

            <!-- TIMESTAMPS ROW -->
            <div class="grid grid-cols-2 gap-2.5">
              <div class="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col">
                <span class="text-[8px] font-bold text-[#858994] tracking-wider uppercase">TODAY IN</span>
                <span class="text-xs font-bold text-white font-mono mt-0.5">
                  {{ currentShift?.time_in ? new Date(currentShift.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—' }}
                </span>
              </div>
              <div class="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col">
                <span class="text-[8px] font-bold text-[#858994] tracking-wider uppercase">TODAY OUT</span>
                <span class="text-xs font-bold text-white font-mono mt-0.5">
                  {{ currentShift?.time_out ? new Date(currentShift.time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—' }}
                </span>
              </div>
            </div>

            <!-- ATTENDANCE BUTTON ACTIONS -->
            <div class="pt-2 flex items-center justify-center w-full">
              <!-- CLOCK IN (CYAN) -->
              <button 
                type="button"
                v-if="!currentStatus || currentStatus === 'safe_at_base'"
                @click="handleAttendanceAction"
                :disabled="isVerifying || attendanceStore.loading || internLinkStatus !== 'approved'"
                class="attendance-pill-btn clock-in-pill-btn cursor-pointer"
              >
                <div v-if="isVerifying || attendanceStore.loading" class="spinner-ring border-[#00d9ff]"></div>
                <svg v-else class="w-4 h-4 text-[#00d9ff] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                <span>{{ (isVerifying || attendanceStore.loading) ? 'VERIFYING GPS...' : 'CLOCK IN' }}</span>
              </button>

              <!-- CLOCK OUT (RED/ROSE ALERT) -->
              <button 
                type="button"
                v-else-if="currentStatus === 'on_duty'"
                @click="handleAttendanceAction"
                :disabled="isVerifying || attendanceStore.loading || internLinkStatus !== 'approved'"
                class="attendance-pill-btn clock-out-pill-btn cursor-pointer"
              >
                <div v-if="isVerifying || attendanceStore.loading" class="spinner-ring border-rose-400"></div>
                <svg v-else class="w-4 h-4 text-rose-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>{{ (isVerifying || attendanceStore.loading) ? 'VERIFYING GPS...' : 'CLOCK OUT' }}</span>
              </button>

              <!-- I AM SAFE AT BASE (EMERALD GREEN) -->
              <button 
                type="button"
                v-else-if="currentStatus === 'in_transit'"
                @click="isSafeAtBaseModalOpen = true"
                class="attendance-pill-btn safe-base-pill-btn cursor-pointer"
              >
                <svg class="w-4 h-4 text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span>I AM SAFE AT BASE</span>
              </button>
            </div>
          </div>
        </section>
      </div>

      <!-- ================= TAB 2: REPORTS TAB ================= -->
      <div v-show="activeMainTab === 'reports'" class="tab-pane-container">
        <section class="trainext-glass-card flex flex-col gap-4 p-4 sm:p-5">
          <!-- TOP BAR -->
          <div class="flex items-center justify-between gap-3">
            <div>
              <h2 class="trainext-title text-sm sm:text-base">Accomplishment Reports</h2>
              <p class="trainext-subtitle text-[11px]">Review daily logs and supervisor verification.</p>
            </div>

            <!-- RIGHT-ALIGNED + NEW REPORT BUTTON -->
            <button 
              type="button" 
              @click="isAccomplishmentModalOpen = true"
              :disabled="internLinkStatus !== 'approved'"
              class="new-report-pill-btn shrink-0 cursor-pointer"
            >
              <svg class="w-3.5 h-3.5 text-[#00d9ff] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 4v16m8-8H4" />
              </svg>
              <span>New Report</span>
            </button>
          </div>

          <!-- FULL-WIDTH DATE FILTER BAR -->
          <div class="flex items-center gap-2 pt-1 w-full">
            <div class="relative flex-1 flex items-center min-w-0">
              <span class="absolute left-3.5 pointer-events-none text-[10px] font-bold text-slate-400 uppercase tracking-wider font-['Aileron',sans-serif]">
                Filter Date:
              </span>
              <input 
                v-model="reportDateFilter" 
                type="date"
                class="filter-date-input-full w-full pl-24 pr-3 font-mono"
              />
            </div>

            <button 
              v-if="reportDateFilter"
              type="button"
              @click="reportDateFilter = ''"
              class="clear-date-btn shrink-0 cursor-pointer"
            >
              Clear
            </button>
          </div>

          <!-- AUTHVIEW-STYLE TABS -->
          <nav class="report-tabs-nav" aria-label="Accomplishment Filter Tabs">
            <template v-for="(tab, index) in (['all', 'pending', 'approved', 'rejected'] as const)" :key="tab">
              <button 
                type="button"
                @click="activeAccomplishmentTab = tab"
                class="report-tab-btn"
                :class="{ active: activeAccomplishmentTab === tab }"
              >
                <span>{{ tab.toUpperCase() }}</span>
                <span v-if="activeAccomplishmentTab === tab" class="tab-indicator"></span>
              </button>

              <span v-if="index < 3" class="tab-divider" aria-hidden="true"></span>
            </template>
          </nav>

          <div v-if="filteredAccomplishments.length === 0" class="p-8 text-center text-xs text-[#858994] font-mono">
            No reports found for the selected criteria.
          </div>

          <!-- COMPACT REPORT CARDS -->
          <div v-else class="flex flex-col gap-1.5">
            <div 
              v-for="log in filteredAccomplishments" 
              :key="log.id"
              @click="openLogDetail(log)"
              class="report-item-card group cursor-pointer"
            >
              <div class="min-w-0 flex-1">
                <p class="text-xs sm:text-sm font-semibold text-white group-hover:text-[#00d9ff] transition-colors truncate">
                  {{ log.title }}
                </p>
                
                <div class="flex items-center gap-2 text-[10.5px] text-[#858994] mt-1 font-mono">
                  <span>{{ log.report_date }}</span>
                  <span v-if="log.feedback" class="text-emerald-400 font-bold">• with Feedback</span>
                </div>
              </div>

              <div class="flex items-center gap-2.5 shrink-0">
                <span 
                  class="trainext-chip text-[9.5px]"
                  :class="{
                    'chip-emerald': log.status === 'approved',
                    'chip-amber': log.status === 'pending',
                    'chip-rose': log.status === 'rejected'
                  }"
                >
                  {{ log.status }}
                </span>
                
                <svg class="w-4 h-4 text-slate-500 group-hover:text-white group-hover:translate-x-0.5 transition-all" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- ================= TAB 3: ATTENDANCE TAB ================= -->
      <div v-show="activeMainTab === 'attendance'" class="tab-pane-container">
        <section class="trainext-glass-card flex flex-col gap-4 p-4 sm:p-5">
          <div>
            <h2 class="trainext-title">Attendance Shift Records</h2>
            <p class="trainext-subtitle text-[11px]">Audit trail of all previous check-ins, transit clearances, and verified rendered hours.</p>
          </div>

          <div v-if="attendanceStore.attendanceHistory.length === 0" class="p-8 text-center text-xs text-[#858994] font-mono">
            No attendance records logged yet.
          </div>

          <div v-else class="flex flex-col gap-2 pt-1">
            <div 
              v-for="hist in attendanceStore.attendanceHistory" 
              :key="hist.id"
              class="p-3.5 rounded-2xl bg-white/[0.02] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-white/20 transition-colors"
            >
              <div>
                <div class="flex items-center gap-2">
                  <span class="font-mono text-xs font-bold text-white">{{ hist.date }}</span>
                  <span 
                    class="trainext-chip text-[10px]"
                    :class="{
                      'chip-cyan': hist.status === 'on_duty',
                      'chip-amber': hist.status === 'in_transit',
                      'chip-emerald': hist.status === 'safe_at_base'
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
      </div>

      <footer class="trainext-footer-tagline pt-4 mb-2">
        <span>Smart Tracking.</span>
        <span>Real-Time Safety.</span>
      </footer>
    </div>

    <!-- ================= FIXED BOTTOM NAV (ICON-ONLY + AUTO-DISMISS NOTIF BADGE) ================= -->
    <nav class="fixed-bottom-bar" aria-label="Bottom Navigation">
      <div class="bottom-bar-inner">
        <!-- TAB 1: HOME -->
        <button 
          type="button" 
          @click="activeMainTab = 'home'"
          class="bottom-nav-item"
          :class="{ active: activeMainTab === 'home' }"
          aria-label="Home Station"
        >
          <div class="relative flex items-center justify-center">
            <svg class="w-5 h-5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <span v-if="activeMainTab === 'home'" class="active-dot"></span>
        </button>

        <!-- TAB 2: REPORTS (MAWAWALA ANG BADGE KAPAG NABISITA O PININDOT NA) -->
        <button 
          type="button" 
          @click="activeMainTab = 'reports'; hasViewedReportsTab = true;"
          class="bottom-nav-item"
          :class="{ active: activeMainTab === 'reports' }"
          aria-label="Accomplishment Reports"
        >
          <div class="relative flex items-center justify-center">
            <svg class="w-5 h-5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span v-if="unreadFeedbackCount > 0" class="nav-badge-count">
              {{ unreadFeedbackCount > 99 ? '99+' : unreadFeedbackCount }}
            </span>
          </div>
          <span v-if="activeMainTab === 'reports'" class="active-dot"></span>
        </button>

        <!-- TAB 3: ATTENDANCE -->
        <button 
          type="button" 
          @click="activeMainTab = 'attendance'"
          class="bottom-nav-item"
          :class="{ active: activeMainTab === 'attendance' }"
          aria-label="Attendance Records"
        >
          <div class="relative flex items-center justify-center">
            <svg class="w-5 h-5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span v-if="activeMainTab === 'attendance'" class="active-dot"></span>
        </button>
      </div>
    </nav>

    <!-- SIGN OUT CONFIRMATION MODAL -->
    <div 
      v-if="showSignOutConfirm" 
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
    >
      <div class="trainext-glass-card max-w-sm w-full p-6 flex flex-col gap-4 border border-white/20 animate-in fade-in zoom-in-95 duration-150">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </div>
          <div>
            <h3 class="text-sm font-bold text-white">Confirm Sign Out</h3>
            <p class="text-xs text-[#858994]">Are you sure you want to end your current session?</p>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
          <button 
            type="button" 
            @click="showSignOutConfirm = false" 
            :disabled="isSigningOut" 
            class="px-4 py-2 rounded-full border border-white/20 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
          
          <button 
            type="button" 
            @click="handleSignOut" 
            :disabled="isSigningOut" 
            class="modal-signout-btn cursor-pointer"
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

    <AccomplishmentDetailModal 
      :is-open="isDetailModalOpen"
      :log="selectedLogForDetail"
      :can-edit="true"
      @close="isDetailModalOpen = false"
      @updated="refreshData"
      @view-media="inspectMedia"
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

<style scoped>
/* STICKY HEADER (FLAT, ZERO CORNER ROUNDING, NAKA-LOCK SA TAAS) */
.sticky-intern-header {
  position: sticky !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  width: 100% !important;
  z-index: 40 !important;
  border-radius: 0 !important;
  border-left: 0 !important;
  border-right: 0 !important;
  border-top: 0 !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12) !important;
  background: rgba(5, 8, 17, 0.92) !important;
  backdrop-filter: blur(20px) !important;
  -webkit-backdrop-filter: blur(20px) !important;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5) !important;
}

/* TAB CONTAINER SMOOTH TRANSITIONS */
.tab-pane-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  animation: tabFadeSlide 240ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes tabFadeSlide {
  0% {
    opacity: 0;
    transform: translateY(6px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

/* MOBILE-SAFE HEADER ACTION BUTTON */
.header-action-btn {
  height: 34px;
  min-width: 34px;
  border-radius: 9999px !important;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.15);
  transition: all 180ms ease;
  user-select: none;
}

.header-action-btn:hover {
  background: rgba(0, 217, 255, 0.08);
  border-color: rgba(0, 217, 255, 0.4);
}

.header-action-btn:active {
  transform: scale(0.96);
}

/* NEW REPORT PILL BUTTON */
.new-report-pill-btn {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 6px !important;
  height: 34px !important;
  padding: 0 16px !important;
  border-radius: 9999px !important;
  border: 1px solid rgba(0, 217, 255, 0.45) !important;
  background: rgba(0, 217, 255, 0.1) !important;
  color: #00d9ff !important;
  font-family: "Aileron", -apple-system, sans-serif !important;
  font-size: 11.5px !important;
  font-weight: 700 !important;
  letter-spacing: 0.3px !important;
  cursor: pointer !important;
  user-select: none !important;
  box-shadow: 0 0 12px rgba(0, 217, 255, 0.15) !important;
  transition: all 160ms ease !important;
}

.new-report-pill-btn:hover:not(:disabled) {
  background: rgba(0, 217, 255, 0.22) !important;
  border-color: rgba(0, 217, 255, 0.8) !important;
  color: #ffffff !important;
  box-shadow: 0 0 16px rgba(0, 217, 255, 0.35) !important;
  transform: translateY(-1px) !important;
}

.new-report-pill-btn:active:not(:disabled) {
  transform: scale(0.96) !important;
}

.new-report-pill-btn:disabled {
  opacity: 0.45 !important;
  cursor: not-allowed !important;
  filter: grayscale(0.5) !important;
}

/* ================= ATTENDANCE PILL CONTROLS (RAPID TOUCH, ACCURATE TARGET) ================= */
.attendance-pill-btn {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 8px !important;
  height: 44px !important;
  min-width: 170px !important;
  padding: 0 32px !important;
  border-radius: 9999px !important;
  touch-action: manipulation;
  font-family: "Aileron", -apple-system, sans-serif !important;
  font-size: 12px !important;
  font-weight: 700 !important;
  letter-spacing: 0.5px !important;
  user-select: none !important;
  cursor: pointer !important;
  transition: transform 120ms ease, background 160ms ease, border-color 160ms ease !important;
}

/* CLOCK IN: NEON CYAN */
.clock-in-pill-btn {
  border: 1px solid rgba(0, 217, 255, 0.5) !important;
  background: rgba(0, 217, 255, 0.12) !important;
  color: #00d9ff !important;
  box-shadow: 0 0 15px rgba(0, 217, 255, 0.2) !important;
}

.clock-in-pill-btn:hover:not(:disabled) {
  background: rgba(0, 217, 255, 0.25) !important;
  border-color: rgba(0, 217, 255, 0.85) !important;
  color: #ffffff !important;
  box-shadow: 0 0 20px rgba(0, 217, 255, 0.4) !important;
  transform: translateY(-1px) !important;
}

.clock-in-pill-btn:active:not(:disabled) {
  transform: scale(0.95) !important;
}

/* CLOCK OUT: NEON RED / ROSE ALERT */
.clock-out-pill-btn {
  border: 1px solid rgba(244, 63, 94, 0.55) !important;
  background: rgba(244, 63, 94, 0.15) !important;
  color: #fca5a5 !important;
  box-shadow: 0 0 15px rgba(244, 63, 94, 0.2) !important;
}

.clock-out-pill-btn:hover:not(:disabled) {
  background: rgba(244, 63, 94, 0.3) !important;
  border-color: rgba(244, 63, 94, 0.9) !important;
  color: #ffffff !important;
  box-shadow: 0 0 22px rgba(244, 63, 94, 0.45) !important;
  transform: translateY(-1px) !important;
}

.clock-out-pill-btn:active:not(:disabled) {
  transform: scale(0.95) !important;
}

/* SAFE AT BASE: EMERALD GREEN */
.safe-base-pill-btn {
  border: 1px solid rgba(52, 211, 153, 0.55) !important;
  background: rgba(5, 46, 30, 0.7) !important;
  color: #6ee7b7 !important;
  box-shadow: 0 0 15px rgba(52, 211, 153, 0.2) !important;
}

.safe-base-pill-btn:hover:not(:disabled) {
  background: rgba(6, 78, 59, 0.85) !important;
  border-color: rgba(52, 211, 153, 0.9) !important;
  color: #ffffff !important;
  box-shadow: 0 0 22px rgba(52, 211, 153, 0.45) !important;
  transform: translateY(-1px) !important;
}

.safe-base-pill-btn:active:not(:disabled) {
  transform: scale(0.95) !important;
}

.attendance-pill-btn:disabled {
  opacity: 0.55 !important;
  cursor: not-allowed !important;
  filter: grayscale(0.4) !important;
  transform: none !important;
}

/* INLINE SPINNER RING */
.spinner-ring {
  width: 15px;
  height: 15px;
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

/* MODAL SIGN OUT BUTTON */
.modal-signout-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  padding: 0 18px;
  border-radius: 9999px !important;
  border: 1px solid rgba(244, 63, 94, 0.6);
  background: rgba(244, 63, 94, 0.2);
  color: #fecdd3;
  font: 700 12px/1 "Aileron", sans-serif;
  letter-spacing: 0.2px;
  transition: all 150ms ease;
  user-select: none;
}

.modal-signout-btn:hover:not(:disabled) {
  background: rgba(244, 63, 94, 0.35);
  color: #ffffff;
  border-color: rgba(244, 63, 94, 0.9);
  box-shadow: 0 0 12px rgba(244, 63, 94, 0.3);
}

.modal-signout-btn:active:not(:disabled) {
  transform: scale(0.97);
}

/* FULL-WIDTH FILTER INPUT */
.filter-date-input-full {
  height: 36px;
  border-radius: 9999px !important;
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #ffffff;
  font-size: 11.5px;
  outline: none;
  transition: border-color 160ms ease, box-shadow 160ms ease;
  color-scheme: dark;
}

.filter-date-input-full:focus {
  border-color: #00d9ff;
  box-shadow: 0 0 10px rgba(0, 217, 255, 0.25);
}

.filter-date-input-full::-webkit-calendar-picker-indicator {
  cursor: pointer;
  filter: invert(0.8) sepia(100%) saturate(300%) hue-rotate(150deg);
  opacity: 0.8;
}

.clear-date-btn {
  height: 28px;
  padding: 0 12px;
  border-radius: 9999px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.04);
  color: #cbd5e1;
  font-family: "Aileron", sans-serif;
  font-size: 10px;
  font-weight: 600;
  transition: all 160ms ease;
}

.clear-date-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.35);
}

/* COMPACT REPORT ITEM CARDS */
.report-item-card {
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  transition: all 180ms ease;
}

.report-item-card:hover {
  border-color: rgba(0, 217, 255, 0.35);
  background: rgba(0, 217, 255, 0.03);
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
}

.report-item-card:active {
  transform: scale(0.99);
}

/* AUTHVIEW-INSPIRED TABS */
.report-tabs-nav {
  position: relative;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  align-items: center;
  height: 40px;
  margin-top: 6px;
  margin-bottom: 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.report-tab-btn {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  padding: 0 4px 6px;
  border: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.95);
  font: 700 11px/1 "Aileron", sans-serif;
  letter-spacing: 0.6px;
  cursor: pointer;
  transition: color 150ms ease;
}

.report-tab-btn:not(.active) {
  color: rgba(255, 255, 255, 0.45);
}

.report-tab-btn:hover:not(.active) {
  color: rgba(255, 255, 255, 0.85);
}

.tab-indicator {
  position: absolute;
  bottom: -1px;
  left: 50%;
  width: 75%;
  height: 3px;
  border-radius: 3px;
  background: #00d9ff;
  box-shadow: 0 0 10px #00d9ff;
  transform: translateX(-50%);
}

.tab-divider {
  position: absolute;
  height: 18px;
  width: 1px;
  background: rgba(255, 255, 255, 0.15);
  transform: translateX(-50%);
}

.report-tabs-nav .tab-divider:nth-of-type(1) { left: 25%; }
.report-tabs-nav .tab-divider:nth-of-type(2) { left: 50%; }
.report-tabs-nav .tab-divider:nth-of-type(3) { left: 75%; }

/* FIXED CYBER-GLASS BOTTOM NAVIGATION (ICON-ONLY) */
.fixed-bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 40;
  padding: 0 16px 12px;
  pointer-events: none;
}

.bottom-bar-inner {
  pointer-events: auto;
  max-width: 320px;
  margin: 0 auto;
  height: 54px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: center;
  border-radius: 9999px;
  background: rgba(7, 11, 18, 0.88);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6), 0 0 15px rgba(0, 217, 255, 0.12);
  padding: 0 8px;
}

.bottom-nav-item {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  border: 0;
  background: transparent;
  color: #858994;
  cursor: pointer;
  transition: all 180ms ease;
  user-select: none;
}

.bottom-nav-item svg {
  color: #858994;
  transition: all 180ms ease;
}

.bottom-nav-item:hover svg {
  color: #e2e8f0;
}

.bottom-nav-item.active svg {
  color: #00d9ff;
  transform: translateY(-2px);
}

/* NOTIFICATION BADGE NA MAY BILANG */
.nav-badge-count {
  position: absolute;
  top: -6px;
  right: -9px;
  min-width: 17px;
  height: 17px;
  padding: 0 4px;
  border-radius: 9999px;
  background: #00d9ff;
  color: #050811;
  font-family: "Aileron", -apple-system, sans-serif;
  font-size: 9.5px;
  font-weight: 800;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 10px rgba(0, 217, 255, 0.7);
  border: 1.5px solid #070b12;
  user-select: none;
  pointer-events: none;
}

/* ACTIVE TAB INDICATOR SA ILALIM */
.active-dot {
  position: absolute;
  bottom: 6px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #00d9ff;
  box-shadow: 0 0 6px #00d9ff;
}
</style>