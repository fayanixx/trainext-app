<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import { useAttendanceStore } from '@/stores/attendance';
import { useAccomplishmentsStore } from '@/stores/accomplishments';
import { useGeolocation } from '@/composables/useGeolocation';
import { validateGeofence, type GeofenceValidationResult } from '@/lib/geofence';
import type { CompanySite, InternSupervisorLink, AccomplishmentLog } from '@/types';
import GeofenceErrorModal from '@/components/GeofenceErrorModal.vue';
import SafeAtBaseModal from '@/components/SafeAtBaseModal.vue';
import AccomplishmentModal from '@/components/AccomplishmentModal.vue';
import ProofViewerModal from '@/components/ProofViewerModal.vue';

const router = useRouter();
const authStore = useAuthStore();
const attendanceStore = useAttendanceStore();
const accomplishmentsStore = useAccomplishmentsStore();
const { coordinates, loading: geoLoading, error: geoError, refreshLocation } = useGeolocation();

// Dashboard & Affiliation States
const loading = ref(true);
const linkRecord = ref<InternSupervisorLink | null>(null);
const assignedCompany = ref<CompanySite | null>(null);
const availableCompanies = ref<CompanySite[]>([]);
const selectedCompanyId = ref<string>('');
const isSubmittingRequest = ref(false);
const alertMessage = ref('');
const errorMessage = ref('');

// DTR, Geofence, & Safe at Base States
const geofenceResult = ref<GeofenceValidationResult | null>(null);
const isGeofenceErrorOpen = ref(false);
const isSafeAtBaseModalOpen = ref(false);
const actionLoading = ref(false);

// Accomplishment Modals & Viewer States
const isAccomplishmentModalOpen = ref(false);
const editingAccomplishment = ref<AccomplishmentLog | null>(null);
const isProofViewerOpen = ref(false);
const activeProofUrl = ref<string | null>(null);
const activeProofType = ref<'image' | 'document' | 'video' | null>(null);
const activeProofTitle = ref('');

// Affiliation Status Flags
const isApproved = computed(() => linkRecord.value?.status === 'approved');
const isPending = computed(() => linkRecord.value?.status === 'pending');
const isRejected = computed(() => linkRecord.value?.status === 'rejected');

// Evaluate Geofence status
const evaluateGeofence = () => {
  if (!coordinates.value || !assignedCompany.value) {
    geofenceResult.value = null;
    return;
  }

  const officeCoords = {
    latitude: assignedCompany.value.latitude,
    longitude: assignedCompany.value.longitude,
  };

  geofenceResult.value = validateGeofence(
    coordinates.value,
    officeCoords,
    assignedCompany.value.radius_meters || 150
  );
};

watch([coordinates, assignedCompany], () => {
  evaluateGeofence();
});

// Fetch Available Supervisors with Active Company Sites
const fetchAvailableCompanies = async () => {
  try {
    const { data, error } = await supabase
      .from('company_sites')
      .select('*');

    if (error) throw error;
    availableCompanies.value = (data as CompanySite[]) || [];
  } catch (err: any) {
    console.error('Failed to load companies:', err.message);
  }
};

// Fetch Current Intern Link & Company Details
const fetchInternLinkStatus = async () => {
  if (!authStore.user?.id) return;

  try {
    const { data, error } = await supabase
      .from('intern_supervisor_links')
      .select(`
        id,
        intern_id,
        supervisor_id,
        status,
        rejection_reason,
        linked_at,
        created_at
      `)
      .eq('intern_id', authStore.user.id)
      .maybeSingle();

    if (error) throw error;
    linkRecord.value = (data as InternSupervisorLink) || null;

    if (linkRecord.value?.status === 'approved') {
      const { data: siteData, error: siteError } = await supabase
        .from('company_sites')
        .select('*')
        .eq('supervisor_id', linkRecord.value.supervisor_id)
        .maybeSingle();

      if (!siteError && siteData) {
        assignedCompany.value = siteData as CompanySite;
      }
    }
  } catch (err: any) {
    console.error('Failed to fetch link status:', err.message);
  } finally {
    loading.value = false;
  }
};

// Send Smart Link Request
const submitLinkRequest = async () => {
  if (!selectedCompanyId.value) {
    errorMessage.value = 'Please select a company and supervisor from the list.';
    return;
  }

  const selectedSite = availableCompanies.value.find((c) => c.id === selectedCompanyId.value);
  if (!selectedSite) return;

  isSubmittingRequest.value = true;
  errorMessage.value = '';
  alertMessage.value = '';

  try {
    const payload = {
      intern_id: authStore.user!.id,
      supervisor_id: selectedSite.supervisor_id,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('intern_supervisor_links')
      .upsert(payload, { onConflict: 'intern_id' })
      .select()
      .single();

    if (error) throw error;

    linkRecord.value = data as InternSupervisorLink;
    alertMessage.value = 'Affiliation request dispatched! Waiting for supervisor approval.';
  } catch (err: any) {
    errorMessage.value = err.message || 'Failed to dispatch supervisor affiliation request.';
  } finally {
    isSubmittingRequest.value = false;
  }
};

// Execute Geofenced Time-In
const handleTimeIn = async () => {
  errorMessage.value = '';

  if (!coordinates.value || !assignedCompany.value) {
    errorMessage.value = 'Waiting for valid device GPS coordinates...';
    return;
  }

  evaluateGeofence();
  if (!geofenceResult.value?.isInside) {
    isGeofenceErrorOpen.value = true;
    return;
  }

  actionLoading.value = true;
  try {
    await attendanceStore.logTimeIn({
      internId: authStore.user!.id,
      supervisorId: assignedCompany.value.supervisor_id,
      latitude: coordinates.value.latitude,
      longitude: coordinates.value.longitude,
    });
    alertMessage.value = 'Successfully clocked in! You are currently on duty.';
  } catch (err: any) {
    errorMessage.value = err.message || 'Failed to record Time-In.';
  } finally {
    actionLoading.value = false;
  }
};

// Execute Time-Out
const handleTimeOut = async () => {
  actionLoading.value = true;
  errorMessage.value = '';
  alertMessage.value = '';

  try {
    await attendanceStore.logTimeOut();
    alertMessage.value = 'Successfully clocked out! Your status is now "In Transit" until you reach your home base.';
  } catch (err: any) {
    errorMessage.value = err.message || 'Failed to record Time-Out.';
  } finally {
    actionLoading.value = false;
  }
};

// Execute Safe at Base Check-in
const handleConfirmSafeAtBase = async () => {
  actionLoading.value = true;
  errorMessage.value = '';
  alertMessage.value = '';

  try {
    await attendanceStore.confirmSafeAtBase();
    isSafeAtBaseModalOpen.value = false;
    alertMessage.value = 'Safe arrival recorded! Transit monitoring for this shift has concluded.';
  } catch (err: any) {
    errorMessage.value = err.message || 'Failed to record Safe at Base status.';
  } finally {
    actionLoading.value = false;
  }
};

// Accomplishment Actions
const openCreateAccomplishment = () => {
  editingAccomplishment.value = null;
  isAccomplishmentModalOpen.value = true;
};

const openEditAccomplishment = (log: AccomplishmentLog) => {
  editingAccomplishment.value = log;
  isAccomplishmentModalOpen.value = true;
};

const handleDeleteAccomplishment = async (id: string) => {
  if (!confirm('Are you sure you want to delete this pending accomplishment record?')) return;
  try {
    await accomplishmentsStore.deleteLog(id);
    alertMessage.value = 'Accomplishment record removed successfully.';
  } catch (err: any) {
    errorMessage.value = err.message || 'Failed to remove accomplishment.';
  }
};

const inspectMedia = (url: string, type: 'image' | 'document' | 'video', title: string) => {
  activeProofUrl.value = url;
  activeProofType.value = type;
  activeProofTitle.value = title;
  isProofViewerOpen.value = true;
};

onMounted(async () => {
  await authStore.fetchProfile();
  if (!authStore.isAuthenticated || !authStore.isIntern || !authStore.user) {
    router.push('/auth');
    return;
  }

  await Promise.all([
    fetchInternLinkStatus(),
    fetchAvailableCompanies(),
    attendanceStore.fetchTodayShift(authStore.user.id),
    accomplishmentsStore.fetchInternLogs(authStore.user.id),
  ]);
});
</script>

<template>
  <div class="min-h-screen bg-[#0a0f1d] text-slate-100 p-4 sm:p-8 relative overflow-hidden select-none">
    <!-- Ambient Neon Cyberpunk Glow Backdrops -->
    <div class="absolute -top-40 -left-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none"></div>
    <div class="absolute top-1/2 -right-40 w-96 h-96 bg-fuchsia-500/10 rounded-full blur-[140px] pointer-events-none"></div>

    <div class="max-w-5xl mx-auto space-y-6 relative z-10">
      
      <!-- Top Dynamic Header Bar -->
      <header class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-[#0d1527]/80 border border-cyan-500/25 backdrop-blur-2xl shadow-[0_0_35px_rgba(6,182,212,0.12)]">
        <div>
          <div class="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/40 text-[10px] font-bold text-cyan-300 uppercase tracking-widest mb-1">
            <span class="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
            Intern Portal
          </div>
          <h1 class="text-xl sm:text-2xl font-black text-white tracking-wide">
            Welcome, {{ authStore.user?.full_name || 'Trainee' }}
          </h1>
          <p class="text-xs text-slate-400">
            {{ isApproved ? (assignedCompany?.company_name || 'Assigned Company') : 'Account Onboarding & Smart Linking' }}
          </p>
        </div>

        <div class="flex items-center gap-3">
          <button 
            @click="authStore.signOut(); router.push('/auth');"
            class="px-4 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white transition"
          >
            Sign Out
          </button>
        </div>
      </header>

      <!-- Loading State -->
      <div v-if="loading" class="p-12 text-center text-slate-400 text-sm animate-pulse">
        Synchronizing trainee records, geofence, and accomplishment logs...
      </div>

      <!-- STATE 1: ONBOARDING / PENDING SUPERVISOR LINK -->
      <section v-else-if="!isApproved" class="space-y-6">
        <div v-if="isPending" class="p-6 rounded-3xl bg-amber-950/40 border border-amber-500/40 backdrop-blur-xl space-y-2">
          <div class="flex items-center gap-2 text-amber-300 font-bold text-sm">
            <span>⏳</span>
            <span>Supervisor Approval Pending</span>
          </div>
          <p class="text-xs text-slate-300 leading-relaxed">
            Your request has been routed to your supervisor. Once accepted, your office geofence perimeter coordinates will unlock automatically to permit Time In, Time Out, and Accomplishment submissions.
          </p>
        </div>

        <div v-if="isRejected" class="p-6 rounded-3xl bg-red-950/40 border border-red-500/40 backdrop-blur-xl space-y-2">
          <div class="flex items-center gap-2 text-red-300 font-bold text-sm">
            <span>✕</span>
            <span>Affiliation Request Declined</span>
          </div>
          <p class="text-xs text-slate-300 leading-relaxed">
            Your request was declined. <span v-if="linkRecord?.rejection_reason" class="text-red-300">Reason: "{{ linkRecord.rejection_reason }}"</span>. Please select and re-apply below.
          </p>
        </div>

        <!-- Smart Link Request Card -->
        <div class="p-6 sm:p-8 rounded-3xl bg-[#0d1527]/90 border border-cyan-500/30 backdrop-blur-2xl shadow-[0_0_40px_rgba(6,182,212,0.15)] space-y-5">
          <div>
            <h2 class="text-lg font-bold text-white tracking-wide">
              Connect to Company & Supervisor
            </h2>
            <p class="text-xs text-slate-400 mt-1 leading-relaxed">
              Select your assigned host training company below. Your supervisor will approve your account to unlock geofenced attendance logging.
            </p>
          </div>

          <div v-if="alertMessage" class="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-300 font-medium">
            {{ alertMessage }}
          </div>
          <div v-if="errorMessage" class="p-3.5 rounded-xl bg-red-950/60 border border-red-500/40 text-xs text-red-300 font-medium">
            {{ errorMessage }}
          </div>

          <div class="space-y-1.5">
            <label class="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
              Available Training Companies
            </label>
            <div v-if="availableCompanies.length === 0" class="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400">
              No registered company sites available yet.
            </div>
            <select 
              v-else 
              v-model="selectedCompanyId"
              class="w-full px-4 py-3 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-100 text-sm focus:border-cyan-400 outline-none transition"
            >
              <option disabled value="">-- Select Company & Office Location --</option>
              <option v-for="site in availableCompanies" :key="site.id" :value="site.id">
                {{ site.company_name }} ({{ site.office_address }})
              </option>
            </select>
          </div>

          <button 
            @click="submitLinkRequest"
            :disabled="isSubmittingRequest || !selectedCompanyId"
            class="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-fuchsia-600 hover:from-cyan-400 text-white font-bold text-xs uppercase tracking-wider shadow-lg disabled:opacity-40 transition"
          >
            {{ isSubmittingRequest ? 'Submitting Affiliation Request...' : (isPending ? 'Re-Submit Request' : 'Send Request to Supervisor') }}
          </button>
        </div>
      </section>

      <!-- STATE 2: AUTHORIZED INTERN (DTR & ACCOMPLISHMENTS UNLOCKED) -->
      <section v-else class="space-y-6">
        
        <!-- Alerts & Feedbacks -->
        <div v-if="alertMessage" class="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-300 font-medium flex items-center justify-between">
          <span>{{ alertMessage }}</span>
          <button @click="alertMessage = ''" class="text-slate-400 hover:text-white font-bold ml-4">✕</button>
        </div>
        <div v-if="errorMessage" class="p-4 rounded-2xl bg-red-950/60 border border-red-500/40 text-xs text-red-300 font-medium flex items-center justify-between">
          <span>{{ errorMessage }}</span>
          <button @click="errorMessage = ''" class="text-slate-400 hover:text-white font-bold ml-4">✕</button>
        </div>
        <div v-if="geoError" class="p-4 rounded-2xl bg-amber-950/60 border border-amber-500/40 text-xs text-amber-300 font-medium">
          {{ geoError }}
        </div>

        <!-- 1. LIVE IN TRANSIT CALLOUT BANNER -->
        <div 
          v-if="attendanceStore.isInTransit" 
          class="p-6 rounded-3xl bg-[#0d1527]/90 border border-amber-500/40 backdrop-blur-2xl shadow-[0_0_40px_rgba(245,158,11,0.2)] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div class="space-y-1">
            <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase tracking-wider border border-amber-500/40">
              <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
              In Transit Monitoring Active
            </div>
            <h3 class="text-lg font-bold text-white">Heading Home or to Dorm?</h3>
            <p class="text-xs text-slate-300 leading-relaxed max-w-xl">
              Your shift has ended and transit safety tracking is currently active. Confirm your arrival once at your residence to conclude daily accountability.
            </p>
          </div>

          <button 
            @click="isSafeAtBaseModalOpen = true"
            :disabled="actionLoading"
            class="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-600 hover:from-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-[0_0_30px_rgba(16,185,129,0.35)] shrink-0 transition"
          >
            I Am Safe at Base 🛡️
          </button>
        </div>

        <!-- 2. SAFE AT BASE RECEIPT BANNER -->
        <div 
          v-else-if="attendanceStore.isSafeAtBase"
          class="p-5 rounded-3xl bg-emerald-950/40 border border-emerald-500/40 backdrop-blur-2xl flex items-center justify-between gap-4"
        >
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-300 text-lg">
              ✓
            </div>
            <div>
              <h4 class="text-sm font-bold text-white">Safe at Base Validated</h4>
              <p class="text-[11px] text-slate-300">
                Digital arrival receipt logged at {{ new Date(attendanceStore.activeShift?.safe_at_base_time || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}. Transit accountability concluded.
              </p>
            </div>
          </div>
          <span class="text-[10px] font-mono text-emerald-300 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800">
            Receipt #{{ attendanceStore.activeShift?.id.slice(0, 8) }}
          </span>
        </div>

        <!-- 3. LIVE SHIFT STATUS RIBBON -->
        <div class="p-6 rounded-3xl bg-[#0d1527]/85 border border-cyan-500/30 backdrop-blur-2xl shadow-[0_0_35px_rgba(6,182,212,0.12)] space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                Daily Shift Controller
              </span>
              <h2 class="text-xl font-black text-white mt-0.5">
                <span v-if="attendanceStore.isOnDuty" class="text-cyan-400">On Duty (Rendering Hours)</span>
                <span v-else-if="attendanceStore.isInTransit" class="text-amber-400">In Transit (Heading Home)</span>
                <span v-else-if="attendanceStore.isSafeAtBase" class="text-emerald-400">Safe at Base (Shift Completed)</span>
                <span v-else class="text-slate-300">Ready to Clock In</span>
              </h2>
              <p class="text-xs text-slate-400 mt-1">
                Assigned Site: {{ assignedCompany?.company_name }} ({{ assignedCompany?.office_address }})
              </p>
            </div>

            <!-- Geofence Proximity Badge -->
            <div class="flex items-center gap-2 p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs">
              <span 
                class="w-2.5 h-2.5 rounded-full"
                :class="geofenceResult?.isInside ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]' : 'bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.8)]'"
              ></span>
              <div class="text-left font-mono">
                <div class="text-[10px] text-slate-400 font-sans">Office Distance</div>
                <div :class="geofenceResult?.isInside ? 'text-emerald-300' : 'text-red-300'" class="font-bold">
                  {{ geofenceResult?.formattedDistance || 'Calculating...' }}
                </div>
              </div>
            </div>
          </div>

          <!-- Time-In & Time-Out Action Controls -->
          <div class="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center gap-3">
            <button 
              v-if="!attendanceStore.isOnDuty && !attendanceStore.isInTransit && !attendanceStore.isSafeAtBase"
              @click="handleTimeIn"
              :disabled="actionLoading || geoLoading"
              class="w-full sm:flex-1 py-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-cyan-600 hover:from-cyan-400 text-white font-extrabold text-sm uppercase tracking-wider shadow-[0_0_30px_rgba(6,182,212,0.35)] disabled:opacity-40 transition"
            >
              {{ actionLoading ? 'Verifying Coordinates...' : 'Clock In (Geofenced)' }}
            </button>

            <button 
              v-if="attendanceStore.isOnDuty"
              @click="handleTimeOut"
              :disabled="actionLoading"
              class="w-full sm:flex-1 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 text-white font-extrabold text-sm uppercase tracking-wider shadow-[0_0_30px_rgba(245,158,11,0.35)] disabled:opacity-40 transition"
            >
              {{ actionLoading ? 'Clocking Out...' : 'Clock Out (Start Transit)' }}
            </button>

            <button 
              @click="refreshLocation"
              class="w-full sm:w-auto px-4 py-4 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-slate-300 hover:text-white transition flex items-center justify-center gap-1.5"
            >
              <span>🔄</span>
              <span>Refresh Location</span>
            </button>
          </div>
        </div>

        <!-- 4. SHIFT SUMMARY METRICS -->
        <div v-if="attendanceStore.activeShift" class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div class="p-4 rounded-2xl bg-[#0d1527]/80 border border-slate-800/80 backdrop-blur-xl">
            <span class="text-[10px] font-bold text-slate-400 uppercase">Shift Date</span>
            <div class="text-sm font-semibold text-white mt-1">{{ attendanceStore.activeShift.date }}</div>
          </div>
          <div class="p-4 rounded-2xl bg-[#0d1527]/80 border border-slate-800/80 backdrop-blur-xl">
            <span class="text-[10px] font-bold text-slate-400 uppercase">Clock In</span>
            <div class="text-sm font-semibold text-cyan-300 font-mono mt-1">
              {{ new Date(attendanceStore.activeShift.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}
            </div>
          </div>
          <div class="p-4 rounded-2xl bg-[#0d1527]/80 border border-slate-800/80 backdrop-blur-xl">
            <span class="text-[10px] font-bold text-slate-400 uppercase">Clock Out</span>
            <div class="text-sm font-semibold text-amber-300 font-mono mt-1">
              {{ attendanceStore.activeShift.time_out ? new Date(attendanceStore.activeShift.time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending' }}
            </div>
          </div>
          <div class="p-4 rounded-2xl bg-[#0d1527]/80 border border-slate-800/80 backdrop-blur-xl">
            <span class="text-[10px] font-bold text-slate-400 uppercase">Rendered</span>
            <div class="text-sm font-bold text-emerald-400 font-mono mt-1">
              {{ attendanceStore.activeShift.hours_rendered }} hrs
            </div>
          </div>
        </div>

        <!-- 5. ACCOMPLISHMENTS SECTION WITH MULTI-PROOF SUPPORT -->
        <section class="space-y-4 pt-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 class="text-lg font-bold text-white tracking-wide flex items-center gap-2">
                <span>Accomplishment Logs</span>
                <span class="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-mono">
                  {{ accomplishmentsStore.logs.length }}
                </span>
              </h2>
              <p class="text-xs text-slate-400">
                Submit and manage task achievements with attached screenshots, documents, and videos
              </p>
            </div>

            <button 
              @click="openCreateAccomplishment"
              class="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 text-white font-bold text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(6,182,212,0.3)] transition flex items-center justify-center gap-2 self-start sm:self-auto"
            >
              <span>+</span>
              <span>New Accomplishment</span>
            </button>
          </div>

          <!-- Empty State -->
          <div 
            v-if="accomplishmentsStore.logs.length === 0" 
            class="p-10 rounded-3xl bg-[#0d1527]/60 border border-slate-800/80 text-center space-y-2"
          >
            <div class="text-3xl">📋</div>
            <p class="text-sm font-semibold text-slate-300">No accomplishment reports logged yet.</p>
            <p class="text-xs text-slate-500 max-w-sm mx-auto">
              Start documenting your daily deliverables, development progress, and tasks for supervisor verification.
            </p>
          </div>

          <!-- Accomplishments List Grid -->
          <div v-else class="space-y-4">
            <div 
              v-for="log in accomplishmentsStore.logs" 
              :key="log.id"
              class="p-6 rounded-3xl bg-[#0d1527]/90 border border-slate-800/80 hover:border-cyan-500/30 backdrop-blur-2xl shadow-lg transition space-y-4"
            >
              <!-- Card Header -->
              <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div>
                  <div class="flex items-center gap-2 flex-wrap">
                    <h3 class="text-base font-bold text-white">{{ log.title }}</h3>
                    <span 
                      v-if="log.status === 'approved'"
                      class="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold uppercase tracking-wider"
                    >
                      Approved
                    </span>
                    <span 
                      v-else-if="log.status === 'rejected'"
                      class="px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 text-[10px] font-bold uppercase tracking-wider"
                    >
                      Needs Revision
                    </span>
                    <span 
                      v-else
                      class="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold uppercase tracking-wider"
                    >
                      Pending Review
                    </span>
                  </div>
                  <div class="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                    <span>Date: <strong class="text-slate-300 font-mono">{{ log.report_date }}</strong></span>
                    <span>•</span>
                    <span>Rendered: <strong class="text-cyan-400 font-mono">{{ log.rendered_hours }} hrs</strong></span>
                  </div>
                </div>

                <!-- Action Controls (Only available if still pending) -->
                <div v-if="log.status === 'pending'" class="flex items-center gap-2">
                  <button 
                    @click="openEditAccomplishment(log)"
                    class="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-xs font-semibold text-slate-300 hover:text-white transition"
                  >
                    Edit
                  </button>
                  <button 
                    @click="handleDeleteAccomplishment(log.id)"
                    class="px-3 py-1.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-xs font-semibold text-red-400 hover:text-red-300 transition"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <!-- Card Description -->
              <p class="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                {{ log.description }}
              </p>

              <!-- Supervisor Feedback Callout (if present) -->
              <div 
                v-if="log.feedback" 
                class="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 space-y-1"
              >
                <span class="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">Supervisor Feedback</span>
                <p class="italic text-slate-200">"{{ log.feedback }}"</p>
              </div>

              <!-- Multi-Proof Attachments Row -->
              <div class="pt-3 border-t border-slate-800/60 flex flex-wrap items-center gap-3">
                <!-- Screenshots / Photos -->
                <div v-if="log.proof_images && log.proof_images.length > 0" class="flex items-center gap-2">
                  <span class="text-[10px] font-bold uppercase text-slate-500">Images:</span>
                  <div class="flex items-center gap-1.5">
                    <button 
                      v-for="(img, idx) in log.proof_images" 
                      :key="idx"
                      @click="inspectMedia(img, 'image', `${log.title} - Screenshot ${idx + 1}`)"
                      class="w-9 h-9 rounded-xl overflow-hidden border border-cyan-500/30 hover:border-cyan-400 transition transform hover:scale-105 bg-slate-900"
                    >
                      <img :src="img" alt="Proof" class="w-full h-full object-cover" />
                    </button>
                  </div>
                </div>

                <!-- Documents -->
                <div v-if="log.proof_documents && log.proof_documents.length > 0" class="flex items-center gap-2">
                  <span class="text-[10px] font-bold uppercase text-slate-500">Docs:</span>
                  <div class="flex items-center gap-1.5">
                    <button 
                      v-for="(doc, idx) in log.proof_documents" 
                      :key="idx"
                      @click="inspectMedia(doc, 'document', `${log.title} - Document`)"
                      class="px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-[11px] text-cyan-300 flex items-center gap-1 transition"
                    >
                      <span>📄</span>
                      <span class="truncate max-w-[120px]">{{ doc.split('/').pop() }}</span>
                    </button>
                  </div>
                </div>

                <!-- Video Walkthrough -->
                <div v-if="log.video_url" class="flex items-center gap-2">
                  <span class="text-[10px] font-bold uppercase text-slate-500">Video:</span>
                  <button 
                    @click="inspectMedia(log.video_url, 'video', `${log.title} - Video Walkthrough`)"
                    class="px-3 py-1 rounded-lg bg-fuchsia-950/40 hover:bg-fuchsia-900/60 border border-fuchsia-500/40 text-[11px] font-semibold text-fuchsia-300 flex items-center gap-1.5 transition"
                  >
                    <span>▶</span>
                    <span>Watch Walkthrough</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

      </section>

    </div>

    <!-- GEOFENCE ERROR MODAL -->
    <GeofenceErrorModal 
      :is-open="isGeofenceErrorOpen"
      :company-name="assignedCompany?.company_name || 'Designated Office'"
      :formatted-distance="geofenceResult?.formattedDistance || 'calculating...'"
      :allowed-radius="assignedCompany?.radius_meters || 150"
      @close="isGeofenceErrorOpen = false"
      @retry="refreshLocation(); isGeofenceErrorOpen = false;"
    />

    <!-- SAFE AT BASE CONFIRMATION MODAL -->
    <SafeAtBaseModal 
      :is-open="isSafeAtBaseModalOpen"
      :loading="actionLoading"
      @close="isSafeAtBaseModalOpen = false"
      @confirm="handleConfirmSafeAtBase"
    />

    <!-- ACCOMPLISHMENT ENTRY MODAL -->
    <AccomplishmentModal 
      :is-open="isAccomplishmentModalOpen"
      :intern-id="authStore.user?.id || ''"
      :supervisor-id="assignedCompany?.supervisor_id"
      :initial-data="editingAccomplishment"
      @close="isAccomplishmentModalOpen = false"
      @saved="() => { isAccomplishmentModalOpen = false; if (authStore.user?.id) accomplishmentsStore.fetchInternLogs(authStore.user.id); }"
    />

    <!-- PROOF VIEWER / LIGHTBOX MODAL -->
    <ProofViewerModal 
      :is-open="isProofViewerOpen"
      :media-url="activeProofUrl"
      :media-type="activeProofType"
      :title="activeProofTitle"
      @close="isProofViewerOpen = false"
    />
  </div>
</template>