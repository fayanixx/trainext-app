<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useAccomplishmentsStore } from '@/stores/accomplishments';
import { useToast } from '@/composables/useToast';
import { sendStatusEmail } from '@/lib/email';
import type { CompanySite } from '@/types';
import OfficeGeofenceModal from '@/components/OfficeGeofenceModal.vue';
import ProofViewerModal from '@/components/ProofViewerModal.vue';
import ProfileSettingsModal from '@/components/ProfileSettingsModal.vue';
import TraiNextSpinner from '@/components/TraiNextSpinner.vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

let supervisorRealtimeChannel: any = null;
let supervisorMap: L.Map | null = null;
let supervisorSiteCircle: L.Circle | null = null;
let supervisorSiteMarker: L.Marker | null = null;

const router = useRouter();
const authStore = useAuthStore();
const accomplishmentsStore = useAccomplishmentsStore();
const toast = useToast();

// Active Bottom Navigation Tab ('overview' | 'reports' | 'trainees')
const activeMainTab = ref<'overview' | 'reports' | 'trainees'>('overview');

// Modals State
const isProfileSettingsOpen = ref(false);
const isGeofenceModalOpen = ref(false);
const isProofViewerOpen = ref(false);
const showSignOutConfirm = ref(false);
const isSigningOut = ref(false);
const isInitialLoading = ref(true);

// Focused Detail Modal para sa Report Review
const selectedReportForReview = ref<any | null>(null);
const isReportReviewModalOpen = ref(false);

// Focused Modal para sa Mga Reports ng Isang Partikular na Trainee
const selectedTraineeForReports = ref<any | null>(null);
const isTraineeReportsModalOpen = ref(false);

const activeProofUrl = ref<string | null>(null);
const activeProofType = ref<'image' | 'document' | 'video' | null>(null);
const activeProofTitle = ref('');

// Data State
const site = ref<CompanySite | null>(null);
const loadingSite = ref(true);
const pendingInterns = ref<any[]>([]);
const approvedInterns = ref<any[]>([]);
const modalFeedbackText = ref('');
const selectedBatchIds = ref<string[]>([]);
const isBatchProcessing = ref(false);
const isSubmittingReview = ref(false);

// Search & Filter State para sa Reports Tab
const searchQuery = ref('');
const activeFilter = ref<'all' | 'pending' | 'approved' | 'rejected'>('all');

// Computed Logs & Counts
const allLogs = computed(() => accomplishmentsStore.logs || []);

const pendingReviewLogs = computed(() => {
  return allLogs.value.filter((l: any) => l.status === 'pending');
});

const pendingCount = computed(() => pendingReviewLogs.value.length);

// Filtered Reports (Search + Filter Tab)
const filteredLogs = computed(() => {
  let list = allLogs.value;
  if (activeFilter.value !== 'all') {
    list = list.filter((l: any) => l.status === activeFilter.value);
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase();
    list = list.filter((l: any) => 
      (l.title && l.title.toLowerCase().includes(q)) ||
      (l.intern?.full_name && l.intern.full_name.toLowerCase().includes(q)) ||
      (l.report_date && l.report_date.includes(q))
    );
  }
  return list;
});

// Reports ng kasalukuyang piniling Trainee
const traineeSpecificLogs = computed(() => {
  if (!selectedTraineeForReports.value) return [];
  const targetId = selectedTraineeForReports.value.intern?.id || selectedTraineeForReports.value.id;
  return allLogs.value.filter((l: any) => (l.intern_id === targetId || l.intern?.id === targetId));
});

// Render Leaflet Geofence Map sa Overview Tab
const renderSupervisorGeofenceMap = () => {
  if (activeMainTab.value !== 'overview' || !site.value?.latitude || !site.value?.longitude) return;

  nextTick(() => {
    const container = document.getElementById('supervisor-geofence-map');
    if (!container) return;

    const lat = Number(site.value!.latitude);
    const lng = Number(site.value!.longitude);
    const radius = Number(site.value!.radius_meters || 100);

    if (!supervisorMap) {
      supervisorMap = L.map('supervisor-geofence-map', {
        zoomControl: false,
        attributionControl: false,
      }).setView([lat, lng], 16);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(supervisorMap);

      supervisorSiteCircle = L.circle([lat, lng], {
        color: '#00d9ff',
        fillColor: '#00d9ff',
        fillOpacity: 0.18,
        weight: 1.5,
        radius: radius,
      }).addTo(supervisorMap);

      const siteIcon = L.divIcon({
        className: 'custom-leaflet-pin',
        html: `<div style="width: 14px; height: 14px; background: #00d9ff; border: 2.5px solid #ffffff; border-radius: 50%; box-shadow: 0 0 12px #00d9ff;"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      supervisorSiteMarker = L.marker([lat, lng], { icon: siteIcon }).addTo(supervisorMap);
    } else {
      supervisorMap.invalidateSize();
      if (supervisorSiteCircle) {
        supervisorSiteCircle.setLatLng([lat, lng]);
        supervisorSiteCircle.setRadius(radius);
      }
      if (supervisorSiteMarker) {
        supervisorSiteMarker.setLatLng([lat, lng]);
      }
      supervisorMap.setView([lat, lng], 16);
    }
  });
};

watch(
  () => [site.value, activeMainTab.value],
  () => {
    if (activeMainTab.value === 'overview') {
      setTimeout(renderSupervisorGeofenceMap, 200);
    }
  },
  { deep: true }
);

// Fetch Supervisor's Geofence Site
const fetchSite = async () => {
  if (!authStore.user?.id) return;
  loadingSite.value = true;
  try {
    const { data, error } = await supabase
      .from('company_sites')
      .select('*')
      .eq('supervisor_id', authStore.user.id)
      .maybeSingle();

    if (error) throw error;
    site.value = (data as CompanySite) || null;
    if (site.value) {
      setTimeout(renderSupervisorGeofenceMap, 150);
    }
  } catch (err: any) {
    console.error('Error fetching site:', err.message);
  } finally {
    loadingSite.value = false;
  }
};

// Fetch Pending and Approved Interns
const fetchInterns = async () => {
  if (!authStore.user?.id) return;
  try {
    const { data, error } = await supabase
      .from('intern_supervisor_links')
      .select(`
        id,
        status,
        created_at,
        intern:profiles!intern_id (
          id,
          full_name,
          email,
          contact_number
        )
      `)
      .eq('supervisor_id', authStore.user.id);

    if (error) throw error;

    pendingInterns.value = (data || []).filter((link: any) => link.status === 'pending');
    approvedInterns.value = (data || []).filter((link: any) => link.status === 'approved');
  } catch (err: any) {
    console.error('Error fetching interns:', err.message);
  }
};

// Handle Intern Link Approval/Rejection
const respondToIntern = async (linkId: string, status: 'approved' | 'rejected') => {
  try {
    const { error } = await supabase
      .from('intern_supervisor_links')
      .update({ status })
      .eq('id', linkId);

    if (error) throw error;
    await fetchInterns();

    if (status === 'approved') {
      toast.success('Intern accepted and linked to company perimeter.', 'AFFILIATION ACCEPTED');
    } else {
      toast.info('Intern affiliation request declined.', 'REQUEST DECLINED');
    }
  } catch (err: any) {
    toast.error(err.message || 'Failed to update intern status.', 'ACTION FAILED');
  }
};

// Open Single Report Review Modal
const openReportReview = (log: any) => {
  selectedReportForReview.value = log;
  modalFeedbackText.value = log.feedback || '';
  isReportReviewModalOpen.value = true;
};

// Open Trainee Reports Modal
const openTraineeReports = (trainee: any) => {
  selectedTraineeForReports.value = trainee;
  isTraineeReportsModalOpen.value = true;
};

// Submit Review (Approve / Reject) sa Modal
const handleReview = async (status: 'approved' | 'rejected') => {
  if (!selectedReportForReview.value) return;
  const logId = selectedReportForReview.value.id;
  const targetLog = selectedReportForReview.value;
  isSubmittingReview.value = true;

  try {
    if (typeof (accomplishmentsStore as any).reviewLog === 'function') {
      try {
        await (accomplishmentsStore as any).reviewLog({ logId, status, feedback: modalFeedbackText.value });
      } catch {
        await (accomplishmentsStore as any).reviewLog(logId, status, modalFeedbackText.value);
      }
    }

    const internEmail = targetLog?.intern?.email || targetLog?.intern_email;
    if (internEmail) {
      await sendStatusEmail({
        toEmail: internEmail,
        toName: targetLog?.intern?.full_name || 'Trainee',
        status: status,
        feedback: modalFeedbackText.value,
        reportTitle: targetLog?.title || 'Daily Accomplishment Report',
      });
    }

    if (authStore.user?.id) {
      await accomplishmentsStore.fetchSupervisorLogs(authStore.user.id);
    }

    if (status === 'approved') {
      toast.success('Report approved and notification dispatched to trainee.', 'REPORT APPROVED');
    } else {
      toast.warning('Report marked as rejected with supervisor remarks.', 'REPORT REJECTED');
    }

    isReportReviewModalOpen.value = false;
  } catch (err: any) {
    toast.error(err.message || 'Review action failed.', 'REVIEW ERROR');
  } finally {
    isSubmittingReview.value = false;
  }
};

// Batch Approve
const toggleSelectAll = () => {
  const pendingIds = pendingReviewLogs.value.map((l: any) => l.id);
  if (selectedBatchIds.value.length === pendingIds.length) {
    selectedBatchIds.value = [];
  } else {
    selectedBatchIds.value = [...pendingIds];
  }
};

const handleBatchApprove = async () => {
  if (selectedBatchIds.value.length === 0) return;
  isBatchProcessing.value = true;
  const count = selectedBatchIds.value.length;
  try {
    const logsToApprove: any[] = allLogs.value.filter((l: any) => selectedBatchIds.value.includes(l.id));

    if (typeof (accomplishmentsStore as any).batchApproveLogs === 'function') {
      await (accomplishmentsStore as any).batchApproveLogs(selectedBatchIds.value);
    } else if (typeof (accomplishmentsStore as any).batchApprove === 'function') {
      await (accomplishmentsStore as any).batchApprove(selectedBatchIds.value);
    }

    await Promise.allSettled(
      logsToApprove.map((log: any) => {
        const internEmail = log?.intern?.email || log?.intern_email;
        if (!internEmail) return Promise.resolve();
        return sendStatusEmail({
          toEmail: internEmail,
          toName: log?.intern?.full_name || 'Trainee',
          status: 'approved',
          feedback: 'Batch approved by supervisor.',
          reportTitle: log?.title || 'Daily Accomplishment Report',
        });
      })
    );

    selectedBatchIds.value = [];
    if (authStore.user?.id) {
      await accomplishmentsStore.fetchSupervisorLogs(authStore.user.id);
    }

    toast.success(`Successfully batch approved ${count} accomplishment reports.`, 'BATCH COMPLETE');
  } catch (err: any) {
    toast.error(err.message || 'Batch approval encountered an issue.', 'BATCH ERROR');
  } finally {
    isBatchProcessing.value = false;
  }
};

// Clean Sign Out Handler
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

// Inspect Media
const inspectMedia = (url: string, type: 'image' | 'document' | 'video', title: string) => {
  activeProofUrl.value = url;
  activeProofType.value = type;
  activeProofTitle.value = title;
  isProofViewerOpen.value = true;
};

const loadAllData = async () => {
  if (!authStore.user?.id) return;
  await Promise.allSettled([
    fetchSite(),
    fetchInterns(),
    accomplishmentsStore.fetchSupervisorLogs(authStore.user.id),
  ]);
};

onMounted(async () => {
  isInitialLoading.value = true;
  try {
    await authStore.fetchProfile();
    if (!authStore.isAuthenticated || !authStore.isSupervisor || !authStore.user) {
      router.replace('/auth');
      return;
    }
    await loadAllData();

    if (authStore.user?.id) {
      supervisorRealtimeChannel = supabase
        .channel(`supervisor-live-${authStore.user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'accomplishment_reports' },
          async () => {
            if (authStore.user?.id) {
              await accomplishmentsStore.fetchSupervisorLogs(authStore.user.id);
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'intern_supervisor_links', filter: `supervisor_id=eq.${authStore.user.id}` },
          async () => {
            await fetchInterns();
          }
        )
        .subscribe();
    }
  } finally {
    isInitialLoading.value = false;
  }
});

onUnmounted(() => {
  if (supervisorRealtimeChannel) {
    supabase.removeChannel(supervisorRealtimeChannel);
    supervisorRealtimeChannel = null;
  }
  if (supervisorMap) {
    supervisorMap.remove();
    supervisorMap = null;
  }
});
</script>

<template>
  <main class="trainext-page-shell pb-24">
    <div class="trainext-bg-railway" aria-hidden="true"></div>
    <div class="trainext-bg-overlay" aria-hidden="true"></div>

    <!-- FULLSCREEN BRANDED SPINNERS -->
    <TraiNextSpinner v-if="isInitialLoading" label="Signing In..." />
    <TraiNextSpinner v-if="isSigningOut" label="Signing Out..." />

    <!-- STICKY HEADER (ORIHINAL NA PAIKOT AT ALIGNMENT SA LOOB, WALANG CORNER ROUNDING PARA FLAT SA SCROLL) -->
    <header class="trainext-glass-card sticky-supervisor-header flex items-center justify-between gap-2 px-3.5 sm:px-5 py-3">
      <div class="trainext-brand-group flex items-center gap-2.5 min-w-0">
        <img src="/assets/trainext-logo.png" alt="TraiNext" class="w-8 h-8 sm:w-9 sm:h-9 object-contain shrink-0" />
        <div class="min-w-0">
          <span class="trainext-badge-role text-[9px] sm:text-[10px] tracking-wider block">Supervisor Control</span>
          <h1 class="trainext-heading-name text-xs sm:text-sm font-bold text-white truncate max-w-[150px] sm:max-w-none">
            {{ authStore.user?.full_name || 'Supervisor' }}
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

    <div v-show="!isInitialLoading && !isSigningOut" class="trainext-container-layout pt-4">
      <!-- ================= TAB 1: OVERVIEW ================= -->
      <div v-show="activeMainTab === 'overview'" class="tab-pane-container">
        <!-- METRICS ROW -->
        <section class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="trainext-glass-card flex flex-col justify-between gap-2 p-4 sm:p-5">
            <span class="text-xs sm:text-[12px] font-bold uppercase tracking-wider text-slate-200 font-['Aileron',sans-serif]">
              APPROVED TRAINEES
            </span>
            <div class="flex items-baseline gap-2 mt-1">
              <span class="text-2xl sm:text-3xl font-extrabold text-white">{{ approvedInterns.length }}</span>
              <span class="text-xs text-[#858994] font-medium">interns active under supervision</span>
            </div>
          </div>

          <div class="trainext-glass-card flex flex-col justify-between gap-2 p-4 sm:p-5">
            <span class="text-xs sm:text-[12px] font-bold uppercase tracking-wider text-slate-200 font-['Aileron',sans-serif]">
              PENDING REVIEWS
            </span>
            <div class="flex items-baseline gap-2 mt-1">
              <span class="text-2xl sm:text-3xl font-extrabold text-[#00d9ff] font-mono">{{ pendingCount }}</span>
              <span class="text-xs text-[#858994] font-medium">reports awaiting supervisor action</span>
            </div>
          </div>
        </section>

        <!-- GEOFENCE OFFICE SITE CARD WITH LEAFLET MINI-MAP -->
        <section class="trainext-glass-card flex flex-col gap-3.5 p-4 sm:p-5">
          <!-- CARD HEADER (MALINIS ANG TITLE AT SUBTITLE) -->
          <div>
            <p class="text-xs sm:text-[13px] font-bold uppercase tracking-wider text-slate-200 font-['Aileron',sans-serif]">
              Office Site Geofence Perimeter
            </p>
            <p class="trainext-subtitle text-[11px] mt-0.5">Authorized coordinates and allowed radius boundary for trainee check-ins.</p>
          </div>

          <div v-if="loadingSite" class="p-6 text-center text-xs text-[#858994] font-mono">
            Loading company site configuration...
          </div>

          <div v-else-if="site" class="flex flex-col gap-3">
            <!-- SITE DETAILS ROW: HINDI BABABA ANG EDIT BUTTON KAHIT SA MOBILE, NAKA-LOCK SA RIGHT SIDE -->
            <div class="p-3.5 rounded-2xl bg-white/[0.02] border border-white/10 flex flex-row items-center justify-between gap-3">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="text-xs sm:text-sm font-bold text-white tracking-wide truncate">{{ site.company_name }}</span>
                  <span class="trainext-chip chip-cyan shrink-0 text-[9.5px] font-mono whitespace-nowrap">{{ site.radius_meters }}m Radius</span>
                </div>
                <p class="text-xs text-slate-300 truncate mt-0.5 font-mono">{{ site.office_address }}</p>
              </div>

              <!-- EDIT PERIMETER ACTION BUTTON: WHITESPACE-NOWRAP AT SHRINK-0 PARA HINDI BUMABA -->
              <button 
                type="button" 
                @click="isGeofenceModalOpen = true"
                class="pill-cyan-btn shrink-0 cursor-pointer whitespace-nowrap"
              >
                <svg class="w-3.5 h-3.5 text-[#00d9ff] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Edit Perimeter</span>
              </button>
            </div>

            <!-- LEAFLET GEOFENCE MINI MAP -->
            <div class="w-full h-52 sm:h-60 rounded-2xl overflow-hidden border border-white/20 relative shadow-inner">
              <div id="supervisor-geofence-map" class="w-full h-full z-10"></div>
              <div class="absolute bottom-2.5 left-2.5 z-[400] bg-black/85 backdrop-blur-md px-3 py-1.5 rounded-lg text-[10px] text-slate-200 border border-white/15 flex items-center gap-2 shadow-lg">
                <span class="w-2 h-2 rounded-full bg-[#00d9ff] shadow-[0_0_8px_#00d9ff]"></span>
                <span class="font-mono">Office Radius: {{ site.radius_meters }}m</span>
              </div>
            </div>
          </div>

          <!-- UNCONFIGURED STATE -->
          <div v-else class="p-6 rounded-2xl border border-dashed border-white/20 text-center flex flex-col items-center gap-3">
            <p class="text-xs text-[#858994]">No office geofence configured yet. Trainees will not be able to clock in until perimeter is set.</p>
            <button 
              type="button" 
              @click="isGeofenceModalOpen = true"
              class="pill-cyan-btn cursor-pointer whitespace-nowrap"
            >
              <svg class="w-3.5 h-3.5 text-[#00d9ff] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              <span>Configure Site Geofence</span>
            </button>
          </div>
        </section>
      </div>

      <!-- ================= TAB 2: REPORTS ================= -->
      <div v-show="activeMainTab === 'reports'" class="tab-pane-container">
        <section class="trainext-glass-card flex flex-col gap-4 p-4 sm:p-5">
          <!-- TOP BAR -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 class="trainext-title text-sm sm:text-base">Trainee Accomplishment Reports</h2>
              <p class="trainext-subtitle text-[11px]">Audit daily submissions and supervisor verification.</p>
            </div>

            <!-- BATCH ACTION BUTTON -->
            <div v-if="pendingReviewLogs.length > 0" class="flex items-center gap-2">
              <button 
                type="button" 
                @click="toggleSelectAll"
                class="pill-neutral-btn cursor-pointer whitespace-nowrap"
              >
                {{ selectedBatchIds.length === pendingReviewLogs.length ? 'Deselect All' : 'Select All Pending' }}
              </button>
              <button 
                type="button" 
                @click="handleBatchApprove"
                :disabled="selectedBatchIds.length === 0 || isBatchProcessing"
                class="pill-cyan-btn cursor-pointer whitespace-nowrap"
              >
                <div v-if="isBatchProcessing" class="spinner-ring border-[#00d9ff]"></div>
                <span>{{ isBatchProcessing ? 'APPROVING...' : `APPROVE (${selectedBatchIds.length})` }}</span>
              </button>
            </div>
          </div>

          <!-- SEARCH INPUT BAR (MAS PALIIT NA PLACEHOLDER FONT SIZE) -->
          <div class="relative flex items-center w-full">
            <svg class="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input 
              v-model="searchQuery" 
              type="text" 
              placeholder="Search reports by title, trainee name, or date..."
              class="search-reports-input pl-10 pr-4"
            />
            <button 
              v-if="searchQuery" 
              @click="searchQuery = ''" 
              class="absolute right-3.5 text-slate-400 hover:text-white text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>

          <!-- AUTHVIEW-STYLE TABS -->
          <nav class="report-tabs-nav" aria-label="Accomplishment Filter Tabs">
            <template v-for="(tab, index) in (['all', 'pending', 'approved', 'rejected'] as const)" :key="tab">
              <button 
                type="button"
                @click="activeFilter = tab"
                class="report-tab-btn"
                :class="{ active: activeFilter === tab }"
              >
                <span>{{ tab.toUpperCase() }}</span>
                <span v-if="activeFilter === tab" class="tab-indicator"></span>
              </button>

              <span v-if="index < 3" class="tab-divider" aria-hidden="true"></span>
            </template>
          </nav>

          <div v-if="filteredLogs.length === 0" class="p-8 text-center text-xs text-[#858994] font-mono">
            No reports found for '{{ searchQuery || activeFilter }}'.
          </div>

          <!-- COMPACT REPORT CARDS (WALANG HRS RENDERED, P TAG LANG) -->
          <div v-else class="flex flex-col gap-2">
            <div 
              v-for="log in filteredLogs" 
              :key="log.id"
              @click="openReportReview(log)"
              class="report-item-card group cursor-pointer"
            >
              <div class="flex items-center gap-3 min-w-0 flex-1">
                <input 
                  v-if="log.status === 'pending'"
                  type="checkbox" 
                  :value="log.id"
                  v-model="selectedBatchIds"
                  @click.stop
                  class="accent-[#00d9ff] cursor-pointer shrink-0"
                />

                <div class="min-w-0 flex-1">
                  <p class="text-xs sm:text-sm font-semibold text-white group-hover:text-[#00d9ff] transition-colors truncate">
                    {{ log.title }}
                  </p>
                  
                  <div class="flex items-center gap-2 text-[10.5px] text-[#858994] mt-0.5 font-mono">
                    <span class="text-white font-medium truncate">{{ log.intern?.full_name || 'Trainee' }}</span>
                    <span>•</span>
                    <span class="shrink-0">{{ log.report_date }}</span>
                  </div>
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

      <!-- ================= TAB 3: TRAINEES ================= -->
      <div v-show="activeMainTab === 'trainees'" class="tab-pane-container">
        <!-- PENDING AFFILIATION REQUESTS (HINDI NAPUPUTOL KAHIT SAAN DEVICES) -->
        <section class="trainext-glass-card flex flex-col gap-3.5 p-4 sm:p-5">
          <div class="flex items-center justify-between gap-2">
            <div>
              <p class="text-xs sm:text-[13px] font-bold uppercase tracking-wider text-slate-200 font-['Aileron',sans-serif]">
                Pending Affiliation Requests
              </p>
              <p class="trainext-subtitle text-[11px]">Trainees seeking supervision and geofence clearance.</p>
            </div>
            <span class="trainext-chip chip-amber shrink-0 whitespace-nowrap">{{ pendingInterns.length }} Pending</span>
          </div>

          <div v-if="pendingInterns.length === 0" class="p-4 text-center text-xs text-[#858994] font-mono">
            No pending trainee affiliation requests.
          </div>

          <div v-else class="flex flex-col gap-2 pt-1">
            <div 
              v-for="link in pendingInterns" 
              :key="link.id"
              class="p-3.5 rounded-2xl bg-white/[0.02] border border-white/10 flex flex-row items-center justify-between gap-3"
            >
              <div class="min-w-0 flex-1">
                <p class="text-xs sm:text-sm font-bold text-white truncate">{{ link.intern?.full_name || 'Trainee' }}</p>
                <p class="text-[11px] text-[#858994] font-mono mt-0.5 truncate">{{ link.intern?.email }}</p>
              </div>

              <!-- ACTIONS: WHITESPACE-NOWRAP AT SHRINK-0 PARA HINDI MAPUTOL -->
              <div class="flex items-center gap-2 shrink-0">
                <button 
                  type="button" 
                  @click="respondToIntern(link.id, 'approved')"
                  class="pill-emerald-btn cursor-pointer whitespace-nowrap"
                >
                  Accept
                </button>
                <button 
                  type="button" 
                  @click="respondToIntern(link.id, 'rejected')"
                  class="pill-rose-btn cursor-pointer whitespace-nowrap"
                >
                  Decline
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- APPROVED TRAINEES ROSTER (PINIPINDOT PARA MAKITA ANG MGA REPORTS NILA) -->
        <section class="trainext-glass-card flex flex-col gap-3.5 p-4 sm:p-5">
          <div>
            <p class="text-xs sm:text-[13px] font-bold uppercase tracking-wider text-slate-200 font-['Aileron',sans-serif]">
              Active Supervised Trainees
            </p>
            <p class="trainext-subtitle text-[11px]">Click any trainee to view their individual submission logs and history.</p>
          </div>

          <div v-if="approvedInterns.length === 0" class="p-6 text-center text-xs text-[#858994] font-mono">
            No approved trainees linked yet.
          </div>

          <div v-else class="flex flex-col gap-2 pt-1">
            <div 
              v-for="link in approvedInterns" 
              :key="link.id"
              @click="openTraineeReports(link)"
              class="report-item-card group cursor-pointer"
            >
              <div class="flex items-center gap-3 min-w-0 flex-1">
                <div class="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-[#00d9ff] font-bold shrink-0">
                  {{ (link.intern?.full_name || 'T')[0] }}
                </div>
                <div class="min-w-0">
                  <p class="text-xs sm:text-sm font-semibold text-white group-hover:text-[#00d9ff] transition-colors truncate">
                    {{ link.intern?.full_name || 'Trainee' }}
                  </p>
                  <p class="text-[11px] text-[#858994] font-mono truncate mt-0.5">
                    {{ link.intern?.email }}
                  </p>
                </div>
              </div>

              <div class="flex items-center gap-2 shrink-0">
                <span class="text-[10px] text-[#00d9ff] font-bold font-mono whitespace-nowrap">View Reports</span>
                <svg class="w-4 h-4 text-slate-500 group-hover:text-white group-hover:translate-x-0.5 transition-all" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
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

    <!-- ================= FIXED BOTTOM NAV (ICON-ONLY + BLUE NOTIF DOT SA TOP RIGHT) ================= -->
    <nav class="fixed-bottom-bar" aria-label="Supervisor Bottom Navigation">
      <div class="bottom-bar-inner">
        <!-- TAB 1: OVERVIEW -->
        <button 
          type="button" 
          @click="activeMainTab = 'overview'"
          class="bottom-nav-item"
          :class="{ active: activeMainTab === 'overview' }"
          aria-label="Overview Station"
        >
          <div class="relative flex items-center justify-center">
            <svg class="w-5 h-5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <span v-if="activeMainTab === 'overview'" class="active-dot"></span>
        </button>

        <!-- TAB 2: REPORTS (MAY BLUE NOTIF DOT KAPAG MAY PENDING REPORTS) -->
        <button 
          type="button" 
          @click="activeMainTab = 'reports'"
          class="bottom-nav-item"
          :class="{ active: activeMainTab === 'reports' }"
          aria-label="Reports Review"
        >
          <div class="relative flex items-center justify-center">
            <svg class="w-5 h-5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <!-- BLUE NOTIF BADGE (TOP RIGHT) -->
            <span v-if="pendingCount > 0" class="nav-notif-dot animate-pulse"></span>
          </div>
          <span v-if="activeMainTab === 'reports'" class="active-dot"></span>
        </button>

        <!-- TAB 3: TRAINEES (MAY BLUE NOTIF DOT KAPAG MAY PENDING AFFILIATIONS) -->
        <button 
          type="button" 
          @click="activeMainTab = 'trainees'"
          class="bottom-nav-item"
          :class="{ active: activeMainTab === 'trainees' }"
          aria-label="Trainees Management"
        >
          <div class="relative flex items-center justify-center">
            <svg class="w-5 h-5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <!-- BLUE NOTIF BADGE (TOP RIGHT) -->
            <span v-if="pendingInterns.length > 0" class="nav-notif-dot animate-pulse"></span>
          </div>
          <span v-if="activeMainTab === 'trainees'" class="active-dot"></span>
        </button>
      </div>
    </nav>

    <!-- ================= SINGLE REPORT REVIEW MODAL ================= -->
    <div 
      v-if="isReportReviewModalOpen && selectedReportForReview" 
      class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md select-none overflow-y-auto"
    >
      <div class="w-full max-w-[560px] my-auto rounded-[24px] bg-[#050811]/95 border border-white/15 shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <!-- HEADER -->
        <header class="px-5 sm:px-6 py-4 border-b border-white/10 flex items-center justify-between gap-3 bg-white/[0.015]">
          <div class="min-w-0">
            <p class="text-base sm:text-lg font-bold text-white truncate font-['Aileron',sans-serif]">
              Report Verification &amp; Review
            </p>
            <p class="text-[10px] text-[#00d9ff] font-mono tracking-wider truncate">
              TRAINEE SUBMISSION AUDIT
            </p>
          </div>
          <button 
            type="button" 
            @click="isReportReviewModalOpen = false"
            class="w-8 h-8 rounded-full border border-white/15 bg-white/[0.03] text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            ✕
          </button>
        </header>

        <!-- BODY -->
        <div class="p-5 sm:p-6 flex flex-col gap-4 overflow-y-auto max-h-[calc(85vh-75px)]">
          <div class="flex items-center justify-between gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/10">
            <div>
              <span class="text-[9.5px] font-bold text-slate-400 uppercase font-['Aileron',sans-serif]">TRAINEE</span>
              <p class="text-xs font-bold text-white">{{ selectedReportForReview.intern?.full_name || 'Trainee' }}</p>
            </div>
            <div class="text-right">
              <span class="text-[9.5px] font-bold text-slate-400 uppercase font-['Aileron',sans-serif]">SUBMISSION DATE</span>
              <p class="text-xs font-mono text-white font-bold">{{ selectedReportForReview.report_date }}</p>
            </div>
          </div>

          <div>
            <span class="text-[9.5px] font-bold text-slate-400 uppercase font-['Aileron',sans-serif]">TASK / ACTIVITY</span>
            <p class="text-sm font-bold text-white mt-0.5">{{ selectedReportForReview.title }}</p>
          </div>

          <div>
            <span class="text-[9.5px] font-bold text-slate-400 uppercase font-['Aileron',sans-serif]">ACCOMPLISHMENT DETAILS</span>
            <div class="p-3.5 rounded-xl bg-black/40 border border-white/10 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap mt-1">
              {{ selectedReportForReview.description }}
            </div>
          </div>

          <!-- PROOF ATTACHMENTS STRIP -->
          <div v-if="selectedReportForReview.proof_images?.length || selectedReportForReview.proof_documents?.length || selectedReportForReview.video_url" class="flex flex-col gap-2 pt-1">
            <span class="text-[9.5px] font-bold text-slate-400 uppercase font-['Aileron',sans-serif]">ATTACHMENTS &amp; EVIDENCE</span>
            
            <div class="flex flex-wrap gap-2">
              <button 
                v-for="img in selectedReportForReview.proof_images" 
                :key="img"
                type="button"
                @click="inspectMedia(img, 'image', selectedReportForReview.title)"
                class="w-12 h-12 rounded-xl overflow-hidden border border-[#00d9ff]/30 bg-black cursor-pointer hover:scale-105 transition"
              >
                <img :src="img" alt="Proof" class="w-full h-full object-cover" />
              </button>

              <button 
                v-for="doc in selectedReportForReview.proof_documents" 
                :key="doc"
                type="button"
                @click="inspectMedia(doc, 'document', selectedReportForReview.title)"
                class="h-12 px-3 rounded-xl bg-white/5 border border-white/20 text-[10px] text-[#00d9ff] hover:bg-white/10 flex items-center gap-1.5 cursor-pointer transition"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span class="truncate max-w-[120px] font-mono">{{ doc.split('/').pop() }}</span>
              </button>

              <button 
                v-if="selectedReportForReview.video_url"
                type="button"
                @click="inspectMedia(selectedReportForReview.video_url, 'video', selectedReportForReview.title)"
                class="h-12 px-3 rounded-xl bg-[#00d9ff]/10 border border-[#00d9ff]/30 text-[10px] text-[#00d9ff] hover:bg-[#00d9ff]/20 flex items-center gap-1.5 cursor-pointer transition font-mono"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
                <span>Demo Video</span>
              </button>
            </div>
          </div>

          <!-- SUPERVISOR REMARKS INPUT (FOR PENDING) -->
          <div v-if="selectedReportForReview.status === 'pending'" class="flex flex-col gap-1.5 pt-2 border-t border-white/10">
            <span class="text-[9.5px] font-bold text-slate-400 uppercase font-['Aileron',sans-serif]">SUPERVISOR FEEDBACK REMARKS</span>
            <textarea 
              v-model="modalFeedbackText" 
              rows="3" 
              placeholder="Provide constructive feedback or state reason if rejecting..."
              class="w-full p-3 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder:text-[#858994] outline-none focus:border-[#00d9ff] resize-none"
            ></textarea>

            <div class="flex items-center justify-end gap-2.5 pt-3">
              <button 
                type="button"
                @click="handleReview('rejected')"
                :disabled="isSubmittingReview"
                class="pill-rose-btn cursor-pointer whitespace-nowrap"
              >
                Reject Report
              </button>
              <button 
                type="button"
                @click="handleReview('approved')"
                :disabled="isSubmittingReview"
                class="pill-cyan-btn cursor-pointer whitespace-nowrap"
              >
                <div v-if="isSubmittingReview" class="spinner-ring border-[#00d9ff]"></div>
                <span>Approve Report</span>
              </button>
            </div>
          </div>

          <!-- ALREADY REVIEWED FEEDBACK -->
          <div 
            v-else-if="selectedReportForReview.feedback" 
            class="p-3 rounded-xl border flex flex-col gap-1"
            :class="selectedReportForReview.status === 'approved' 
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200' 
              : 'bg-rose-950/40 border-rose-500/40 text-rose-200'"
          >
            <span class="text-[9px] font-bold uppercase tracking-wider font-mono"
              :class="selectedReportForReview.status === 'approved' ? 'text-emerald-400' : 'text-rose-400'"
            >
              PREVIOUS SUPERVISOR REMARKS:
            </span>
            <p class="text-xs leading-relaxed">{{ selectedReportForReview.feedback }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- ================= TRAINEE SPECIFIC REPORTS MODAL ================= -->
    <div 
      v-if="isTraineeReportsModalOpen && selectedTraineeForReports" 
      class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md select-none overflow-y-auto"
    >
      <div class="w-full max-w-[600px] my-auto rounded-[24px] bg-[#050811]/95 border border-white/15 shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <!-- HEADER -->
        <header class="px-5 sm:px-6 py-4 border-b border-white/10 flex items-center justify-between gap-3 bg-white/[0.015]">
          <div>
            <p class="text-sm sm:text-base font-bold text-white truncate font-['Aileron',sans-serif]">
              {{ selectedTraineeForReports.intern?.full_name || 'Trainee' }}'s Submissions
            </p>
            <p class="text-[10px] text-[#00d9ff] font-mono tracking-wider truncate">
              TOTAL RECORDED REPORTS: {{ traineeSpecificLogs.length }}
            </p>
          </div>
          <button 
            type="button" 
            @click="isTraineeReportsModalOpen = false"
            class="w-8 h-8 rounded-full border border-white/15 bg-white/[0.03] text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            ✕
          </button>
        </header>

        <!-- BODY LIST -->
        <div class="p-5 sm:p-6 flex flex-col gap-2.5 overflow-y-auto max-h-[calc(80vh-75px)]">
          <div v-if="traineeSpecificLogs.length === 0" class="p-8 text-center text-xs text-[#858994] font-mono">
            No accomplishments recorded yet by this trainee.
          </div>

          <div 
            v-for="log in traineeSpecificLogs" 
            :key="log.id"
            @click="isTraineeReportsModalOpen = false; openReportReview(log);"
            class="report-item-card group cursor-pointer"
          >
            <div class="min-w-0 flex-1">
              <p class="text-xs sm:text-sm font-semibold text-white group-hover:text-[#00d9ff] transition-colors truncate">
                {{ log.title }}
              </p>
              <div class="flex items-center gap-2 text-[10.5px] text-[#858994] mt-0.5 font-mono">
                <span>{{ log.report_date }}</span>
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
              <svg class="w-4 h-4 text-slate-500 group-hover:text-white transition-all" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>

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
            <p class="text-xs text-[#858994]">Are you sure you want to end your supervisor session?</p>
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

    <!-- PROFILE, GEOFENCE & PROOF MODALS -->
    <ProfileSettingsModal 
      :is-open="isProfileSettingsOpen"
      @close="isProfileSettingsOpen = false"
      @saved="loadAllData(); authStore.fetchProfile();"
    />

    <OfficeGeofenceModal 
      :is-open="isGeofenceModalOpen"
      :supervisor-id="authStore.user?.id || ''"
      :initial-data="site"
      @close="isGeofenceModalOpen = false"
      @saved="fetchSite"
    />

    <ProofViewerModal 
      :is-open="isProofViewerOpen"
      :media-url="activeProofUrl"
      :media-type="activeProofType"
      :title="activeProofTitle"
      @close="isProofViewerOpen = false"
    />
  </main>
</template>

<style scoped>
/* STICKY HEADER (FLAT EDGE-TO-EDGE, WALANG CORNER ROUNDING PARA NATURAL PAG NAG-SCROLL) */
.sticky-supervisor-header {
  position: sticky !important;
  top: 0 !important;
  z-index: 40 !important;
  border-radius: 0 !important; /* Inalis ang corner rounding */
  border-left: 0 !important;
  border-right: 0 !important;
  border-top: 0 !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12) !important;
  background: rgba(7, 11, 18, 0.88) !important;
  backdrop-filter: blur(20px) !important;
  -webkit-backdrop-filter: blur(20px) !important;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5) !important;
  margin-bottom: 16px !important;
}

/* HEADER ACTION BUTTON */
.header-action-btn {
  height: 34px;
  min-width: 34px;
  border-radius: 9999px !important;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.15);
  transition: all 180ms ease;
  user-select: none;
  font-family: "Aileron", -apple-system, sans-serif !important;
}

.header-action-btn:hover {
  background: rgba(0, 217, 255, 0.08);
  border-color: rgba(0, 217, 255, 0.4);
}

.header-action-btn:active {
  transform: scale(0.96);
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

/* COMPACT REPORT ITEM CARDS */
.report-item-card {
  padding: 12px 16px;
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

/* SEARCH INPUT WITH SMALLER PLACEHOLDER FONT */
.search-reports-input {
  width: 100%;
  height: 40px;
  border-radius: 9999px;
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: #ffffff;
  font-family: "Aileron", -apple-system, sans-serif;
  font-size: 11.5px;
  outline: none;
  transition: border-color 160ms ease, box-shadow 160ms ease;
}

.search-reports-input::placeholder {
  font-size: 10.5px;
  letter-spacing: 0.3px;
  color: #717684;
}

.search-reports-input:focus {
  border-color: #00d9ff;
  box-shadow: 0 0 10px rgba(0, 217, 255, 0.25);
}

/* ================= ERGONOMIC PILL BUTTON STANDARDS ================= */

/* CYAN PILL (EDIT PERIMETER, APPROVE) */
.pill-cyan-btn {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 6px !important;
  height: 34px !important;
  padding: 0 16px !important;
  border-radius: 9999px !important;
  border: 1px solid rgba(0, 217, 255, 0.5) !important;
  background: rgba(0, 217, 255, 0.12) !important;
  color: #00d9ff !important;
  font-family: "Aileron", -apple-system, sans-serif !important;
  font-size: 11px !important;
  font-weight: 700 !important;
  letter-spacing: 0.3px !important;
  box-shadow: 0 0 12px rgba(0, 217, 255, 0.15) !important;
  transition: all 160ms cubic-bezier(0.16, 1, 0.3, 1) !important;
  touch-action: manipulation;
  user-select: none !important;
}

.pill-cyan-btn:hover:not(:disabled) {
  background: rgba(0, 217, 255, 0.25) !important;
  border-color: rgba(0, 217, 255, 0.85) !important;
  color: #ffffff !important;
  box-shadow: 0 0 18px rgba(0, 217, 255, 0.4) !important;
  transform: translateY(-1px) !important;
}

.pill-cyan-btn:active:not(:disabled) {
  transform: scale(0.96) !important;
}

/* ROSE / RED PILL (REJECT, DECLINE) */
.pill-rose-btn {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 6px !important;
  height: 34px !important;
  padding: 0 16px !important;
  border-radius: 9999px !important;
  border: 1px solid rgba(244, 63, 94, 0.55) !important;
  background: rgba(244, 63, 94, 0.14) !important;
  color: #fca5a5 !important;
  font-family: "Aileron", -apple-system, sans-serif !important;
  font-size: 11px !important;
  font-weight: 700 !important;
  letter-spacing: 0.3px !important;
  box-shadow: 0 0 12px rgba(244, 63, 94, 0.15) !important;
  transition: all 160ms cubic-bezier(0.16, 1, 0.3, 1) !important;
  touch-action: manipulation;
  user-select: none !important;
}

.pill-rose-btn:hover:not(:disabled) {
  background: rgba(244, 63, 94, 0.28) !important;
  border-color: rgba(244, 63, 94, 0.9) !important;
  color: #ffffff !important;
  box-shadow: 0 0 18px rgba(244, 63, 94, 0.4) !important;
  transform: translateY(-1px) !important;
}

.pill-rose-btn:active:not(:disabled) {
  transform: scale(0.96) !important;
}

/* EMERALD GREEN PILL (ACCEPT INTERN) */
.pill-emerald-btn {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 6px !important;
  height: 34px !important;
  padding: 0 16px !important;
  border-radius: 9999px !important;
  border: 1px solid rgba(52, 211, 153, 0.55) !important;
  background: rgba(5, 46, 30, 0.7) !important;
  color: #6ee7b7 !important;
  font-family: "Aileron", -apple-system, sans-serif !important;
  font-size: 11px !important;
  font-weight: 700 !important;
  letter-spacing: 0.3px !important;
  box-shadow: 0 0 12px rgba(52, 211, 153, 0.18) !important;
  transition: all 160ms cubic-bezier(0.16, 1, 0.3, 1) !important;
  touch-action: manipulation;
  user-select: none !important;
}

.pill-emerald-btn:hover:not(:disabled) {
  background: rgba(6, 78, 59, 0.85) !important;
  border-color: rgba(52, 211, 153, 0.9) !important;
  color: #ffffff !important;
  box-shadow: 0 0 18px rgba(52, 211, 153, 0.4) !important;
  transform: translateY(-1px) !important;
}

.pill-emerald-btn:active:not(:disabled) {
  transform: scale(0.96) !important;
}

/* NEUTRAL PILL (DESELECT / CANCEL) */
.pill-neutral-btn {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  height: 34px !important;
  padding: 0 16px !important;
  border-radius: 9999px !important;
  border: 1px solid rgba(255, 255, 255, 0.18) !important;
  background: rgba(255, 255, 255, 0.04) !important;
  color: #cbd5e1 !important;
  font-family: "Aileron", -apple-system, sans-serif !important;
  font-size: 11px !important;
  font-weight: 600 !important;
  transition: all 160ms ease !important;
  user-select: none !important;
}

.pill-neutral-btn:hover {
  background: rgba(255, 255, 255, 0.1) !important;
  color: #ffffff !important;
  border-color: rgba(255, 255, 255, 0.35) !important;
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

/* SPINNER RING */
.spinner-ring {
  width: 14px;
  height: 14px;
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

/* AUTHVIEW-INSPIRED FILTER TABS */
.report-tabs-nav {
  position: relative;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  align-items: center;
  height: 40px;
  margin-top: 4px;
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

/* BLUE / CYAN NOTIFICATION BADGE SA TOP-RIGHT NG ICON */
.nav-notif-dot {
  position: absolute;
  top: -3px;
  right: -5px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #00d9ff;
  box-shadow: 0 0 8px #00d9ff;
  border: 1.5px solid #070b12;
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