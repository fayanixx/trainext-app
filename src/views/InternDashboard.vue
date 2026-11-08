<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import { useAttendanceStore } from '@/stores/attendance';
import { useAccomplishmentsStore } from '@/stores/accomplishments';
import { useGeolocation } from '@/composables/useGeolocation';
import { useToast } from '@/composables/useToast';
import { generateCivilServiceDtrHtml, type IndividualLogRecord } from '@/lib/exportUtils';
import type { CompanySite } from '@/types';
import AccomplishmentModal from '@/components/AccomplishmentModal.vue';
import AccomplishmentDetailModal from '@/components/AccomplishmentDetailModal.vue';
import SafeAtBaseModal from '@/components/SafeAtBaseModal.vue';
import GeofenceErrorModal from '@/components/GeofenceErrorModal.vue';
import ProofViewerModal from '@/components/ProofViewerModal.vue';
import ProfileSettingsModal from '@/components/ProfileSettingsModal.vue';
import ReportPreviewModal from '@/components/ReportPreviewModal.vue';
import TraiNextSpinner from '@/components/TraiNextSpinner.vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const router = useRouter();
const authStore = useAuthStore();
const attendanceStore = useAttendanceStore();
const accomplishmentsStore = useAccomplishmentsStore();
const toast = useToast();
const { coordinates, refreshLocation } = useGeolocation();

let realtimeChannel: any = null;
let internMap: L.Map | null = null;
let internUserMarker: L.CircleMarker | null = null;
let internSiteCircle: L.Circle | null = null;
let internSiteMarker: L.Marker | null = null;

const touchStartY = ref(0);
const pullDistance = ref(0);
const isPulling = ref(false);
const isRefreshing = ref(false);
const MAX_PULL_HEIGHT = 80;

const handleTouchStart = (e: TouchEvent) => {
  if (window.scrollY === 0) {
    touchStartY.value = e.touches[0].clientY;
    isPulling.value = true;
  }
};

const handleTouchMove = (e: TouchEvent) => {
  if (!isPulling.value || isRefreshing.value) return;
  const currentY = e.touches[0].clientY;
  const diff = currentY - touchStartY.value;
  if (diff > 0) {
    pullDistance.value = Math.min(diff * 0.4, MAX_PULL_HEIGHT);
  } else {
    pullDistance.value = 0;
  }
};

const handleTouchEnd = async () => {
  if (!isPulling.value || isRefreshing.value) return;
  isPulling.value = false;
  if (pullDistance.value >= 50) {
    isRefreshing.value = true;
    try {
      await refreshData();
    } catch {
      toast.error('Failed to sync data.', 'ERROR');
    } finally {
      isRefreshing.value = false;
    }
  }
  pullDistance.value = 0;
};

const handleManualRefresh = async () => {
  isInitialLoading.value = true;
  try {
    await refreshData();
  } catch {
    toast.error('Failed to sync data.', 'ERROR');
  } finally {
    isInitialLoading.value = false;
  }
};

const activeMainTab = ref<'home' | 'reports' | 'attendance'>('home');

const isProfileSettingsOpen = ref(false);
const isAccomplishmentModalOpen = ref(false);
const isSafeAtBaseModalOpen = ref(false);
const isProofViewerOpen = ref(false);
const showSignOutConfirm = ref(false);
const isSigningOut = ref(false);

const isDetailModalOpen = ref(false);
const selectedLogForDetail = ref<any | null>(null);

const isReportPreviewOpen = ref(false);
const previewHtml = ref('');
const previewDocTitle = ref('');
const isExportingDtr = ref(false);
const isExportingSafeAudit = ref(false);

const activeProofUrl = ref<string | null>(null);
const activeProofType = ref<'image' | 'document' | 'video' | null>(null);
const activeProofTitle = ref('');

const supervisorSite = ref<CompanySite | null>(null);
const supervisorInfo = ref<{ full_name?: string; email?: string } | null>(null);
const internLinkStatus = ref<'none' | 'pending' | 'approved' | 'rejected'>('none');
const selectedSupervisorId = ref<string | null>(null);
const availableSupervisors = ref<any[]>([]);
const linkingLoading = ref(false);
const isInitialLoading = ref(true);

const hasViewedReportsTab = ref(false);
const isVerifying = ref(false);

const activeAccomplishmentTab = ref<'all' | 'pending' | 'approved' | 'rejected'>('all');
const reportDateFilter = ref<string>('');

const isCustomDropdownOpen = ref(false);
const selectedSupervisorName = computed(() => {
  const found = availableSupervisors.value.find(s => s.supervisor_id === selectedSupervisorId.value);
  return found ? `${found.full_name} — ${found.company_name}` : '';
});

const selectSupervisorItem = (sup: any) => {
  selectedSupervisorId.value = sup.supervisor_id;
  isCustomDropdownOpen.value = false;
};

const geofenceError = ref({
  isOpen: false,
  companyName: '',
  formattedDistance: '0m',
  allowedRadius: 0,
});

const isPmTime = computed(() => {
  return new Date().getHours() >= 12;
});

const requiredHours = computed(() => {
  return Number((authStore.user as any)?.required_hours) || 486;
});

// Ayusin ang types para tumanggap ng string | null | undefined para maiwasan ang TS2345 error
const calculateHoursBetween = (start: string | null | undefined, end: string | null | undefined): number => {
  if (!start || !end) return 0;
  try {
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) return 0;
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const diff = endMinutes - startMinutes;
    return diff > 0 ? diff / 60 : 0;
  } catch {
    return 0;
  }
};

const renderedHours = computed(() => {
  return (attendanceStore.attendanceHistory || []).reduce((acc, log) => {
    const hours = Number(log.hours_rendered);
    if (!isNaN(hours) && hours > 0) {
      return acc + hours;
    }
    const am = calculateHoursBetween(log.am_arrival, log.am_departure);
    const pm = calculateHoursBetween(log.pm_arrival, log.pm_departure);
    return acc + am + pm;
  }, 0);
});

const progressPercentage = computed(() => {
  if (requiredHours.value <= 0) return 0;
  const pct = (renderedHours.value / requiredHours.value) * 100;
  return Math.min(Math.round(pct), 100);
});

const currentShift = computed(() => attendanceStore.activeShift);
const hasAMIn = computed(() => !!currentShift.value?.am_arrival);
const hasAMOut = computed(() => !!currentShift.value?.am_departure);
const hasPMIn = computed(() => !!currentShift.value?.pm_arrival);
const hasPMOut = computed(() => !!currentShift.value?.pm_departure);
const hasSafeAtBase = computed(() => !!currentShift.value?.safe_at_base_time);

const currentShiftStatusText = computed(() => {
  if (!hasAMIn.value && !hasPMIn.value) return 'Not Clocked In Yet';
  if (hasAMIn.value && !hasAMOut.value) return 'On Duty (AM Shift)';
  if (hasAMOut.value && !hasPMIn.value) return 'Lunch Break / Out';
  if (hasPMIn.value && !hasPMOut.value) return 'On Duty (PM Shift)';
  return 'Shift Completed Today';
});

const isWithinGeofence = computed(() => {
  const site = supervisorSite.value;
  const lat = coordinates.value?.latitude;
  const lng = coordinates.value?.longitude;
  if (!site?.latitude || !site?.longitude || !site?.radius_meters || !lat || !lng) {
    return false;
  }
  const distance = computeDistanceMeters(lat, lng, site.latitude, site.longitude);
  return distance <= site.radius_meters;
});

const formatTimeToHoursMinutes = (timestamp: string | null) => {
  if (!timestamp) return 'Not Confirmed';
  try {
    if (timestamp.includes('T') || timestamp.includes('Z')) {
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
      }
    }

    if (timestamp.includes(':')) {
      const parts = timestamp.split(':');
      if (parts.length >= 2) {
        let hours = parseInt(parts[0], 10);
        const minutes = parts[1].slice(0, 2);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        return `${hours}:${minutes} ${ampm}`;
      }
    }
    const date = new Date(timestamp);
    if (!isNaN(date.getTime())) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    }
    return timestamp;
  } catch {
    return timestamp;
  }
};

const unreadFeedbackCount = computed(() => {
  if (hasViewedReportsTab.value) return 0;
  return accomplishmentsStore.unreadCount || 0;
});

watch(activeMainTab, (newTab) => {
  if (newTab === 'reports') {
    hasViewedReportsTab.value = true;
    accomplishmentsStore.markAllAsRead();
  }
});

watch(() => accomplishmentsStore.unreadCount, (newVal, oldVal) => {
  if (newVal > oldVal && activeMainTab.value !== 'reports') {
    hasViewedReportsTab.value = false;
  }
});

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

const handleViewDtrAudit = async () => {
  if (!authStore.user?.id) return;
  isExportingDtr.value = true;
  try {
    const logs = attendanceStore.attendanceHistory || [];
    const totalRendered = renderedHours.value;

    previewDocTitle.value = `DTR Audit — ${authStore.user.full_name || 'Intern'}`;
    previewHtml.value = generateCivilServiceDtrHtml({
      internName: authStore.user.full_name || 'Intern Trainee',
      companyName: supervisorSite.value?.company_name || 'Designated Training Agency',
      supervisorName: supervisorInfo.value?.full_name || 'Assigned Supervisor',
      contactNumber: (authStore.user as any)?.contact_number,
      coordinatorName: 'OJT Coordinator',
      totalRendered: totalRendered,
      logs: logs as IndividualLogRecord[],
    });

    isReportPreviewOpen.value = true;
  } catch (err: any) {
    toast.error(err.message || 'Failed to generate DTR audit.', 'AUDIT ERROR');
  } finally {
    isExportingDtr.value = false;
  }
};

const handleViewSafeAudit = async () => {
  if (!authStore.user?.id) return;
  isExportingSafeAudit.value = true;
  try {
    const logs = attendanceStore.attendanceHistory || [];
    const safeLogsCount = logs.filter((l: any) => l.safe_at_base_time).length;

    previewDocTitle.value = `Safe Audit Log — ${authStore.user.full_name || 'Intern'}`;
    previewHtml.value = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; background: #ffffff;">
        <h2 style="text-align: center; color: #0588cc;">TraiNext Safe-At-Base Audit Log</h2>
        <p><strong>Trainee:</strong> ${authStore.user.full_name || 'Intern Trainee'}</p>
        <p><strong>Company:</strong> ${supervisorSite.value?.company_name || 'Designated Training Agency'}</p>
        <p><strong>Total Safe Check-ins Recorded:</strong> ${safeLogsCount}</p>
        <hr style="border: 1px solid #ddd; margin: 15px 0;" />
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: #f2f2f2;">
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Date</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Safe at Base Time</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Transit / Safety Notes</th>
            </tr>
          </thead>
          <tbody>
            ${logs.map((l: any) => `
              <tr>
                <td style="border: 1px solid #ddd; padding: 8px;">${l.date || '—'}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${formatTimeToHoursMinutes(l.safe_at_base_time)}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${l.transit_notes || 'Standard daily transit'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    isReportPreviewOpen.value = true;
  } catch (err: any) {
    toast.error(err.message || 'Failed to generate Safe audit.', 'AUDIT ERROR');
  } finally {
    isExportingSafeAudit.value = false;
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

const handleTimeSlotAction = async (slot: 'am_arrival' | 'am_departure' | 'pm_arrival' | 'pm_departure') => {
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

    await attendanceStore.logAttendanceTime({
      internId: authStore.user.id,
      slot: slot,
      latitude: internLat,
      longitude: internLng
    });

    toast.success(`Successfully recorded ${slot.replace('_', ' ').toUpperCase()}.`, 'ATTENDANCE VERIFIED');
    await refreshData();
  } catch (err: any) {
    toast.error(err.message || 'Failed to record attendance slot.', 'ATTENDANCE ERROR');
  } finally {
    isVerifying.value = false;
  }
};

const handleSafeAtBaseClick = () => {
  isSafeAtBaseModalOpen.value = true;
};

const openLogDetail = (log: any) => {
  selectedLogForDetail.value = log;
  accomplishmentsStore.markAsRead(log.id);
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
  } catch {
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

    if (authStore.user?.id) {
      accomplishmentsStore.subscribeToRealtime(authStore.user.id, 'intern');

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
  if (realtimeChannel) supabase.removeChannel(realtimeChannel);
  accomplishmentsStore.unsubscribeRealtime();
  if (internMap) {
    internMap.remove();
    internMap = null;
  }
});
</script>

<template>
  <main 
    class="trainext-page-shell pb-24 min-h-screen relative"
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
  >
    <div 
      class="pull-refresh-indicator"
      :style="{ height: `${pullDistance}px`, opacity: pullDistance > 10 ? 1 : 0 }"
    >
      <div class="flex items-center justify-center gap-2 text-xs text-[#00d9ff] font-mono py-2">
        <svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <span>{{ pullDistance >= 50 ? 'Release to refresh system...' : 'Pull down to refresh system' }}</span>
      </div>
    </div>

    <div v-if="isRefreshing" class="absolute top-2 left-0 right-0 z-50 flex justify-center pointer-events-none">
      <div class="px-4 py-1.5 rounded-full bg-[#050811]/90 border border-cyan-500/40 text-[11px] text-[#00d9ff] font-mono shadow-lg backdrop-blur-md flex items-center gap-2">
        <svg class="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <span>Syncing entire system data...</span>
      </div>
    </div>

    <div class="trainext-bg-railway" aria-hidden="true"></div>
    <div class="trainext-bg-overlay" aria-hidden="true"></div>

    <TraiNextSpinner v-if="isInitialLoading" label="Loading..." />
    <TraiNextSpinner v-if="isSigningOut" label="Signing Out..." />

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
          @click="handleManualRefresh"
          class="header-action-btn flex items-center justify-center cursor-pointer transition-all"
          title="Refresh All Data"
          aria-label="Refresh All Data"
        >
          <svg class="w-4 h-4 text-slate-300 hover:text-[#00d9ff]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>

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

        <div v-if="internLinkStatus === 'none'" class="flex flex-col gap-2.5 pt-2">
          <label class="trainext-label text-[11px] tracking-wider text-slate-300 font-bold">SELECT SUPERVISOR</label>
          <div class="flex flex-col sm:flex-row gap-3">
            
            <div class="relative flex-1 supervisor-custom-dropdown">
              <div 
                @click="isCustomDropdownOpen = !isCustomDropdownOpen"
                class="w-full h-[48px] px-3.5 pr-11 rounded-xl bg-[#03050a] border border-white/25 text-white text-[11px] sm:text-sm flex items-center justify-between cursor-pointer shadow-lg select-none relative"
              >
                <span class="truncate pr-4" :class="{ 'text-slate-400 text-[10.5px] sm:text-sm': !selectedSupervisorId }">
                  {{ selectedSupervisorName || 'Choose assigned company supervisor...' }}
                </span>
                <div class="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#00d9ff] flex items-center justify-center">
                  <svg class="w-4 h-4 transition-transform duration-150" :class="{ 'rotate-180': isCustomDropdownOpen }" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              <div 
                v-if="isCustomDropdownOpen" 
                class="absolute left-0 right-0 top-full mt-2 rounded-xl bg-[#03050a] border-2 border-[#00d9ff] shadow-[0_10px_30px_rgba(0,0,0,0.95)] z-50 overflow-hidden"
              >
                <div 
                  v-for="sup in availableSupervisors" 
                  :key="sup.supervisor_id"
                  @click="selectSupervisorItem(sup)"
                  class="px-4 py-3 text-xs sm:text-sm text-white hover:bg-[#00d9ff] hover:text-[#03050a] border-b border-white/10 last:border-none cursor-pointer transition-colors font-medium"
                >
                  <div class="font-bold">{{ sup.full_name }}</div>
                  <div class="text-[10.5px] opacity-80 mt-0.5">{{ sup.company_name }}</div>
                </div>
                <div v-if="availableSupervisors.length === 0" class="px-4 py-3 text-xs text-slate-400 text-center">
                  No supervisors available.
                </div>
              </div>
            </div>

            <button 
              type="button" 
              @click="requestAffiliation"
              :disabled="!selectedSupervisorId || linkingLoading"
              class="new-report-pill-btn h-[48px] px-6 text-xs sm:text-sm shrink-0 cursor-pointer"
            >
              {{ linkingLoading ? 'SENDING...' : 'CONNECT' }}
            </button>
          </div>
        </div>
      </section>

      <div v-show="activeMainTab === 'home'" class="tab-pane-container">
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

        <section class="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
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

          <div class="trainext-glass-card flex flex-col justify-between gap-3 p-4 sm:p-5">
            <div class="flex items-center justify-between">
              <div>
                <span class="text-xs sm:text-[12px] font-bold uppercase tracking-wider text-slate-200 font-['Aileron',sans-serif]">
                  DAILY ATTENDANCE LOG
                </span>
                <p class="text-[11px] text-[#858994] mt-0.5">{{ currentShiftStatusText }}</p>
              </div>

              <button 
                type="button"
                @click="handleSafeAtBaseClick"
                :disabled="!hasPMOut"
                class="safe-audit-pill-btn cursor-pointer text-[10.5px] h-[30px] px-3 flex items-center gap-1"
                title="Safe at Base Check-in"
              >
                <svg class="w-3 h-3 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>Safe at Base</span>
              </button>
            </div>

            <div class="grid grid-cols-2 gap-2.5">
              <div class="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col">
                <span class="text-[8px] font-bold text-[#858994] tracking-wider uppercase">AM ARRIVAL</span>
                <span class="text-xs font-bold text-white font-mono mt-0.5">
                  {{ currentShift?.am_arrival || '—' }}
                </span>
              </div>
              <div class="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col">
                <span class="text-[8px] font-bold text-[#858994] tracking-wider uppercase">AM DEPARTURE</span>
                <span class="text-xs font-bold text-white font-mono mt-0.5">
                  {{ currentShift?.am_departure || '—' }}
                </span>
              </div>
              <div class="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col">
                <span class="text-[8px] font-bold text-[#858994] tracking-wider uppercase">PM ARRIVAL</span>
                <span class="text-xs font-bold text-white font-mono mt-0.5">
                  {{ currentShift?.pm_arrival || '—' }}
                </span>
              </div>
              <div class="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col">
                <span class="text-[8px] font-bold text-[#858994] tracking-wider uppercase">PM DEPARTURE</span>
                <span class="text-xs font-bold text-white font-mono mt-0.5">
                  {{ currentShift?.pm_departure || '—' }}
                </span>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2.5 pt-1">
              <button 
                type="button"
                @click="handleTimeSlotAction('am_arrival')"
                :disabled="isVerifying || attendanceStore.loading || hasAMIn || isPmTime || !isWithinGeofence || internLinkStatus !== 'approved'"
                class="attendance-slot-btn cursor-pointer flex items-center justify-center gap-2"
              >
                <svg v-if="isVerifying" class="w-4 h-4 animate-spin text-[#00d9ff]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <svg v-else class="w-4 h-4 text-[#00d9ff]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                <span>AM IN</span>
              </button>

              <button 
                type="button"
                @click="handleTimeSlotAction('am_departure')"
                :disabled="isVerifying || attendanceStore.loading || !hasAMIn || hasAMOut || isPmTime || !isWithinGeofence || internLinkStatus !== 'approved'"
                class="attendance-slot-btn cursor-pointer flex items-center justify-center gap-2"
              >
                <svg v-if="isVerifying" class="w-4 h-4 animate-spin text-[#00d9ff]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <svg v-else class="w-4 h-4 text-[#00d9ff]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>AM OUT</span>
              </button>

              <button 
                type="button"
                @click="handleTimeSlotAction('pm_arrival')"
                :disabled="isVerifying || attendanceStore.loading || hasPMIn || !isPmTime || !isWithinGeofence || internLinkStatus !== 'approved'"
                class="attendance-slot-btn cursor-pointer flex items-center justify-center gap-2"
              >
                <svg v-if="isVerifying" class="w-4 h-4 animate-spin text-[#00d9ff]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <svg v-else class="w-4 h-4 text-[#00d9ff]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                <span>PM IN</span>
              </button>

              <button 
                type="button"
                @click="handleTimeSlotAction('pm_departure')"
                :disabled="isVerifying || attendanceStore.loading || !hasPMIn || hasPMOut || !isPmTime || !isWithinGeofence || internLinkStatus !== 'approved'"
                class="attendance-slot-btn cursor-pointer flex items-center justify-center gap-2"
              >
                <svg v-if="isVerifying" class="w-4 h-4 animate-spin text-[#00d9ff]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <svg v-else class="w-4 h-4 text-[#00d9ff]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>PM OUT</span>
              </button>
            </div>
          </div>
        </section>
      </div>

      <div v-show="activeMainTab === 'reports'" class="tab-pane-container">
        <section class="trainext-glass-card flex flex-col gap-4 p-4 sm:p-5">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h2 class="trainext-title text-sm sm:text-base">Accomplishment Reports</h2>
              <p class="trainext-subtitle text-[11px]">Review daily logs and supervisor verification.</p>
            </div>

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

          <div class="flex items-center gap-2.5 pt-1 w-full flex-wrap sm:flex-nowrap">
            <div class="filter-date-wrapper relative flex items-center w-full sm:w-[240px]">
              <span class="filter-date-prefix">Date:</span>
              <input 
                v-model="reportDateFilter" 
                type="date"
                class="filter-date-input-refined w-full font-mono"
              />
            </div>

            <button 
              v-if="reportDateFilter"
              type="button"
              @click="reportDateFilter = ''"
              class="clear-date-btn shrink-0 cursor-pointer"
            >
              Clear Filter
            </button>
          </div>

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

      <div v-show="activeMainTab === 'attendance'" class="tab-pane-container">
        <section class="trainext-glass-card flex flex-col gap-4 p-4 sm:p-5">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
            <div>
              <h2 class="trainext-title text-sm sm:text-base">Attendance Shift Records (CSC Format)</h2>
              <p class="trainext-subtitle text-[11px]">Audit trail of all 4-time entry check-ins and rendered hours.</p>
            </div>

            <div class="flex items-center gap-2 shrink-0 self-start sm:self-auto">
              <button 
                type="button" 
                @click="handleViewDtrAudit"
                :disabled="isExportingDtr"
                class="new-report-pill-btn cursor-pointer text-xs h-[34px] px-4 flex items-center gap-1.5"
              >
                <div v-if="isExportingDtr" class="spinner-ring border-[#00d9ff]"></div>
                <svg v-else class="w-3.5 h-3.5 text-[#00d9ff]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>View DTR Audit</span>
              </button>

              <button 
                type="button" 
                @click="handleViewSafeAudit"
                :disabled="isExportingSafeAudit"
                class="safe-audit-pill-btn cursor-pointer text-xs h-[34px] px-4 flex items-center gap-1.5"
              >
                <div v-if="isExportingSafeAudit" class="spinner-ring border-emerald-400"></div>
                <svg v-else class="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>View Safe Audit</span>
              </button>
            </div>
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
                </div>

                <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] text-[#858994] mt-1 font-mono">
                  <span>AM In: {{ hist.am_arrival || '—' }}</span>
                  <span>•</span>
                  <span>AM Out: {{ hist.am_departure || '—' }}</span>
                  <span>•</span>
                  <span>PM In: {{ hist.pm_arrival || '—' }}</span>
                  <span>•</span>
                  <span>PM Out: {{ hist.pm_departure || '—' }}</span>
                </div>
              </div>

              <div class="sm:text-right flex items-center justify-between sm:justify-end gap-2 border-t sm:border-t-0 border-white/10 pt-2 sm:pt-0">
                <span class="text-[8px] font-bold uppercase tracking-wider text-[#858994] block sm:inline">RENDERED:</span>
                <span class="text-xs font-bold text-[#00d9ff] font-mono">
                  {{ Number(hist.hours_rendered || (calculateHoursBetween(hist.am_arrival ?? null, hist.am_departure ?? null) + calculateHoursBetween(hist.pm_arrival ?? null, hist.pm_departure ?? null))).toFixed(1) }} hrs
                </span>
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

    <nav class="fixed-bottom-bar" aria-label="Bottom Navigation">
      <div class="bottom-bar-inner">
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

        <button 
          type="button" 
          @click="activeMainTab = 'reports'; hasViewedReportsTab = true; accomplishmentsStore.markAllAsRead();"
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
      :already-submitted="hasSafeAtBase"
      :existing-notes="currentShift?.transit_notes || ''"
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
      @retry="geofenceError.isOpen = false;"
    />

    <ReportPreviewModal
      :is-open="isReportPreviewOpen"
      :html-content="previewHtml"
      :title="previewDocTitle"
      @close="isReportPreviewOpen = false"
    />
  </main>
</template>

<style scoped>
.supervisor-custom-dropdown {
  position: relative;
  user-select: none;
}

.pull-refresh-indicator {
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  transition: height 150ms ease-out, opacity 150ms ease-out;
  background: rgba(0, 217, 255, 0.03);
  border-bottom: 1px solid rgba(0, 217, 255, 0.1);
}

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

.safe-audit-pill-btn {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 6px !important;
  height: 34px !important;
  padding: 0 16px !important;
  border-radius: 9999px !important;
  border: 1px solid rgba(52, 211, 153, 0.45) !important;
  background: rgba(52, 211, 153, 0.1) !important;
  color: #34d399 !important;
  font-family: "Aileron", -apple-system, sans-serif !important;
  font-size: 11.5px !important;
  font-weight: 700 !important;
  letter-spacing: 0.3px !important;
  cursor: pointer !important;
  user-select: none !important;
  box-shadow: 0 0 12px rgba(52, 211, 153, 0.15) !important;
  transition: all 160ms ease !important;
}

.safe-audit-pill-btn:hover:not(:disabled) {
  background: rgba(52, 211, 153, 0.22) !important;
  border-color: rgba(52, 211, 153, 0.8) !important;
  color: #ffffff !important;
  box-shadow: 0 0 16px rgba(52, 211, 153, 0.35) !important;
  transform: translateY(-1px) !important;
}

.safe-audit-pill-btn:active:not(:disabled) {
  transform: scale(0.96) !important;
}

.safe-audit-pill-btn:disabled {
  opacity: 0.45 !important;
  cursor: not-allowed !important;
  filter: grayscale(0.5) !important;
}

.attendance-slot-btn {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  height: 42px !important;
  border-radius: 12px !important;
  border: 1px solid rgba(0, 217, 255, 0.4) !important;
  background: rgba(0, 217, 255, 0.1) !important;
  color: #00d9ff !important;
  font-family: "Aileron", -apple-system, sans-serif !important;
  font-size: 11px !important;
  font-weight: 700 !important;
  letter-spacing: 0.5px !important;
  cursor: pointer !important;
  transition: all 160ms ease !important;
  user-select: none !important;
}

.attendance-slot-btn:hover:not(:disabled) {
  background: rgba(0, 217, 255, 0.22) !important;
  border-color: rgba(0, 217, 255, 0.8) !important;
  color: #ffffff !important;
  box-shadow: 0 0 14px rgba(0, 217, 255, 0.3) !important;
  transform: translateY(-1px) !important;
}

.attendance-slot-btn:active:not(:disabled) {
  transform: scale(0.96) !important;
}

.attendance-slot-btn:disabled {
  opacity: 0.4 !important;
  cursor: not-allowed !important;
  filter: grayscale(0.5) !important;
  transform: none !important;
}

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

.filter-date-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.filter-date-prefix {
  position: absolute;
  left: 14px;
  z-index: 5;
  pointer-events: none;
  font-family: "Aileron", sans-serif;
  font-size: 10.5px;
  font-weight: 700;
  color: #00d9ff;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.filter-date-input-refined {
  height: 38px;
  padding: 0 14px 0 52px;
  border-radius: 9999px !important;
  background: rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(0, 217, 255, 0.35);
  color: #ffffff;
  font-size: 11.5px;
  outline: none;
  transition: border-color 160ms ease, box-shadow 160ms ease;
  color-scheme: dark;
}

.filter-date-input-refined:focus {
  border-color: #00d9ff;
  box-shadow: 0 0 12px rgba(0, 217, 255, 0.3);
}

.filter-date-input-refined::-webkit-calendar-picker-indicator {
  cursor: pointer;
  filter: drop-shadow(0 0 4px #00d9ff) invert(0.8) sepia(100%) saturate(500%) hue-rotate(150deg);
  opacity: 0.9;
  padding-left: 4px;
}

.clear-date-btn {
  height: 38px;
  padding: 0 16px;
  border-radius: 9999px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.04);
  color: #cbd5e1;
  font-family: "Aileron", sans-serif;
  font-size: 11px;
  font-weight: 600;
  transition: all 160ms ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.clear-date-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.35);
}

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