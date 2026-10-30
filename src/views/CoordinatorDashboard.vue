<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import ProfileSettingsModal from '@/components/ProfileSettingsModal.vue';
import ReportPreviewModal from '@/components/ReportPreviewModal.vue';
import TraiNextSpinner from '@/components/TraiNextSpinner.vue';
import { useToast } from '@/composables/useToast';
import { 
  exportToCsv, 
  generateMasterReportHtml, 
  generateIndividualDtrHtml,
  type IndividualLogRecord 
} from '@/lib/exportUtils';

const toast = useToast();
let coordinatorRealtimeChannel: any = null;
const router = useRouter();
const authStore = useAuthStore();

// Active Bottom Tab ('overview' | 'directory' | 'performance')
const activeMainTab = ref<'overview' | 'directory' | 'performance'>('overview');

// UI State
const isProfileSettingsOpen = ref(false);
const showSignOutConfirm = ref(false);
const isSigningOut = ref(false);
const isInitialLoading = ref(true);

// Search & Filter State para sa Directory
const directorySearch = ref('');
const directoryStatusFilter = ref<'all' | 'on_duty' | 'in_transit' | 'safe_at_base' | 'idle' | 'completed_ojt'>('all');

// Search & Filter State para sa Performance Tab
const performanceSearch = ref('');

// Document Preview State (DTR Audit)
const isReportPreviewOpen = ref(false);
const previewHtml = ref('');
const previewDocTitle = ref('');
const isExportingIndividual = ref<string | null>(null);

// Trainee Specific Approved Reports Modal State
const isTraineeReportsModalOpen = ref(false);
const selectedTraineeForReview = ref<InternRecord | null>(null);

// Master Intern Record Interface
interface InternRecord {
  id: string;
  full_name: string;
  email: string;
  contact_number?: string;
  supervisor_name?: string;
  company_name?: string;
  today_status: 'on_duty' | 'in_transit' | 'safe_at_base' | 'idle';
  total_hours: number;
  time_in?: string;
  time_out?: string;
  safe_at_base_time?: string;
  transit_notes?: string;
  is_ojt_completed: boolean;
  approved_reports_count: number;
}

interface ApprovedReportItem {
  id: string;
  intern_id: string;
  title: string;
  description: string;
  report_date: string;
  feedback?: string;
  status: string;
}

const internsList = ref<InternRecord[]>([]);
const allApprovedReports = ref<ApprovedReportItem[]>([]);

// Metrics Calculation
const totalInterns = computed(() => internsList.value.length);
const onDutyCount = computed(() => internsList.value.filter((i) => i.today_status === 'on_duty').length);
const inTransitCount = computed(() => internsList.value.filter((i) => i.today_status === 'in_transit').length);
const safeCount = computed(() => internsList.value.filter((i) => i.today_status === 'safe_at_base').length);
const completedOjtCount = computed(() => internsList.value.filter((i) => i.is_ojt_completed).length);

// Safety Lists para sa Home / Overview Tab
const inTransitInterns = computed(() => internsList.value.filter((i) => i.today_status === 'in_transit'));
const safeAtBaseInterns = computed(() => internsList.value.filter((i) => i.today_status === 'safe_at_base'));

// Cohort Cumulative Target Calculation
const cohortTargetHours = computed(() => totalInterns.value * 486);
const cohortRenderedHours = computed(() => {
  return internsList.value.reduce((acc, curr) => acc + (curr.total_hours || 0), 0);
});
const cohortProgressPercentage = computed(() => {
  if (cohortTargetHours.value <= 0) return 0;
  const pct = (cohortRenderedHours.value / cohortTargetHours.value) * 100;
  return Math.min(Math.round(pct), 100);
});

// Filtered Interns (Directory Tab)
const filteredDirectoryInterns = computed(() => {
  return internsList.value.filter((intern) => {
    const query = directorySearch.value.toLowerCase().trim();
    const matchesSearch =
      !query ||
      intern.full_name.toLowerCase().includes(query) ||
      intern.email.toLowerCase().includes(query) ||
      (intern.company_name || '').toLowerCase().includes(query) ||
      (intern.supervisor_name || '').toLowerCase().includes(query);

    let matchesStatus = true;
    if (directoryStatusFilter.value === 'completed_ojt') {
      matchesStatus = intern.is_ojt_completed;
    } else if (directoryStatusFilter.value !== 'all') {
      matchesStatus = intern.today_status === directoryStatusFilter.value;
    }

    return matchesSearch && matchesStatus;
  });
});

// Filtered Trainees sa Performance / Approved Reports Tab
const filteredPerformanceInterns = computed(() => {
  const query = performanceSearch.value.toLowerCase().trim();
  if (!query) return internsList.value;
  return internsList.value.filter((intern) => 
    intern.full_name.toLowerCase().includes(query) ||
    intern.email.toLowerCase().includes(query) ||
    (intern.company_name || '').toLowerCase().includes(query)
  );
});

// Mga Aprubadong Reports ng Kasalukuyang Piniling Trainee
const currentTraineeApprovedReports = computed(() => {
  if (!selectedTraineeForReview.value) return [];
  return allApprovedReports.value.filter((r) => r.intern_id === selectedTraineeForReview.value!.id);
});

// Fetch Master Coordinator Data
const fetchMasterData = async () => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // 1. Kunin ang lahat ng interns
    const { data: interns, error: internErr } = await supabase
      .from('profiles')
      .select('id, full_name, email, contact_number, supervisor_id, company_name')
      .eq('role', 'intern');

    if (internErr) throw internErr;

    if (!interns || interns.length === 0) {
      internsList.value = [];
      allApprovedReports.value = [];
      return;
    }

    const internIds = interns.map((i: any) => i.id);

    // 2. Lookup Tables at Approved Accomplishments
    const [linksRes, sitesRes, supervisorsRes, attendanceRes, reportsRes] = await Promise.all([
      supabase
        .from('intern_supervisor_links')
        .select('intern_id, supervisor_id, status')
        .in('intern_id', internIds),
      supabase
        .from('company_sites')
        .select('id, supervisor_id, company_name, office_address'),
      supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('role', 'supervisor'),
      supabase
        .from('attendance_logs')
        .select('id, intern_id, date, status, time_in, time_out, safe_at_base_time, transit_notes, hours_rendered')
        .in('intern_id', internIds),
      supabase
        .from('accomplishment_reports')
        .select('id, intern_id, title, description, report_date, feedback, status')
        .in('intern_id', internIds)
        .eq('status', 'approved')
        .order('report_date', { ascending: false }),
    ]);

    const links = linksRes.data || [];
    const sites = sitesRes.data || [];
    const supervisors = supervisorsRes.data || [];
    const attendance = attendanceRes.data || [];
    allApprovedReports.value = (reportsRes.data as ApprovedReportItem[]) || [];

    const supervisorMap = new Map(supervisors.map((s: any) => [s.id, s.full_name]));
    const siteMap = new Map(sites.map((s: any) => [s.supervisor_id, s.company_name]));

    // 3. Pagsamahin ang records
    internsList.value = interns.map((intern: any) => {
      const userLinks = links.filter((l: any) => l.intern_id === intern.id);
      const approvedLink = userLinks.find((l: any) => l.status === 'approved');
      const pendingLink = userLinks.find((l: any) => l.status === 'pending');
      const activeLink = approvedLink || pendingLink;

      const targetSupervisorId = activeLink?.supervisor_id || intern.supervisor_id;
      const supervisorNameFromMap = targetSupervisorId ? supervisorMap.get(targetSupervisorId) : null;
      const companyNameFromSite = targetSupervisorId ? siteMap.get(targetSupervisorId) : null;
      const finalCompany = companyNameFromSite || intern.company_name || (approvedLink ? 'Designated Workplace' : 'Partner Agency');

      let affiliationLabel = 'Unassigned';
      if (supervisorNameFromMap) {
        affiliationLabel = approvedLink 
          ? supervisorNameFromMap 
          : `${supervisorNameFromMap} (Pending Approval)`;
      } else if (intern.company_name) {
        affiliationLabel = 'Assigned to Company';
      }

      const logs = attendance.filter((a: any) => a.intern_id === intern.id);
      const todayLog = logs.find((l: any) => l.date === today);

      const totalHours = logs.reduce(
        (sum: number, l: any) => sum + (Number(l.hours_rendered) || 0),
        0
      );

      const isCompleted = totalHours >= 486;
      const approvedCount = allApprovedReports.value.filter((r) => r.intern_id === intern.id).length;

      return {
        id: intern.id,
        full_name: intern.full_name || 'Unnamed Intern',
        email: intern.email || 'No email provided',
        contact_number: intern.contact_number || 'N/A',
        supervisor_name: affiliationLabel,
        company_name: finalCompany,
        today_status: todayLog ? todayLog.status : 'idle',
        total_hours: totalHours,
        time_in: todayLog?.time_in,
        time_out: todayLog?.time_out,
        safe_at_base_time: todayLog?.safe_at_base_time,
        transit_notes: todayLog?.transit_notes,
        is_ojt_completed: isCompleted,
        approved_reports_count: approvedCount,
      };
    });
  } catch (err: any) {
    console.error('Failed to load coordinator data:', err.message);
  } finally {
    isInitialLoading.value = false;
  }
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

// Open Trainee Approved Reports Drawer
const openTraineeReports = (intern: InternRecord) => {
  selectedTraineeForReview.value = intern;
  isTraineeReportsModalOpen.value = true;
};

// Master CSV Export
const handleMasterCSVExport = () => {
  if (!internsList.value || internsList.value.length === 0) {
    toast.warning('No trainee records available to export.', 'EXPORT EMPTY');
    return;
  }

  const exportData = internsList.value.map((i, index) => ({
    '#': index + 1,
    'Trainee Name': i.full_name,
    'Email Address': i.email,
    'Host Company': i.company_name,
    'Supervisor': i.supervisor_name,
    'Rendered Hours': Number(i.total_hours || 0).toFixed(1),
    'Target Hours': '486.0',
    'OJT Status': i.is_ojt_completed ? 'COMPLETED (486h)' : 'IN PROGRESS',
    'Today Shift Status': i.today_status.replace(/_/g, ' ').toUpperCase(),
    'Approved Reports': i.approved_reports_count,
  }));

  exportToCsv('trainext_cohort_master_summary', exportData);
  toast.success('Master cohort summary exported to CSV.', 'EXPORT COMPLETE');
};

// Master PDF Export
const handleMasterPDFExport = () => {
  if (!internsList.value || internsList.value.length === 0) {
    toast.warning('No trainee records available to preview.', 'EXPORT EMPTY');
    return;
  }

  const exportData = internsList.value.map((i) => ({
    fullName: i.full_name,
    companyName: i.company_name || 'Designated Workplace',
    supervisorName: i.supervisor_name || 'Assigned Supervisor',
    totalRenderedHours: Number(i.total_hours || 0),
    affiliationStatus: i.is_ojt_completed ? 'COMPLETED' : 'IN PROGRESS',
  }));

  previewDocTitle.value = 'Cohort Master Summary Audit';
  previewHtml.value = generateMasterReportHtml({
    coordinatorName: authStore.user?.full_name || 'OJT Coordinator',
    batchTitle: 'BS Information Technology — Practicum Cohort (486 Hours Target)',
    data: exportData,
  });

  isReportPreviewOpen.value = true;
};

// Individual DTR Audit Export
const handleIndividualExport = async (intern: InternRecord) => {
  isExportingIndividual.value = intern.id;
  try {
    const { data: logs, error } = await supabase
      .from('attendance_logs')
      .select('date, time_in, time_out, hours_rendered, status, safe_at_base_time, transit_notes')
      .eq('intern_id', intern.id)
      .order('date', { ascending: false });

    if (error) throw error;

    previewDocTitle.value = `DTR & Safety Audit — ${intern.full_name}`;
    previewHtml.value = generateIndividualDtrHtml({
      internName: intern.full_name,
      companyName: intern.company_name || 'Designated Training Agency',
      supervisorName: intern.supervisor_name || 'Assigned Supervisor',
      contactNumber: intern.contact_number,
      coordinatorName: authStore.user?.full_name || 'OJT Coordinator',
      totalRendered: intern.total_hours,
      logs: (logs || []) as IndividualLogRecord[],
    });

    isReportPreviewOpen.value = true;
  } catch (err: any) {
    toast.error(err.message || 'Failed to generate individual audit.', 'AUDIT ERROR');
  } finally {
    isExportingIndividual.value = null;
  }
};

onMounted(async () => {
  isInitialLoading.value = true;
  try {
    await authStore.fetchProfile();
    if (!authStore.isAuthenticated || !authStore.isCoordinator || !authStore.user) {
      router.replace('/auth');
      return;
    }
    await fetchMasterData();

    coordinatorRealtimeChannel = supabase
      .channel('coordinator-global-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchMasterData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs' }, () => fetchMasterData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'accomplishment_reports' }, () => fetchMasterData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'intern_supervisor_links' }, () => fetchMasterData())
      .subscribe();
  } finally {
    isInitialLoading.value = false;
  }
});

onUnmounted(() => {
  if (coordinatorRealtimeChannel) {
    supabase.removeChannel(coordinatorRealtimeChannel);
    coordinatorRealtimeChannel = null;
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

    <!-- STICKY HEADER (FLAT EDGE-TO-EDGE, WALANG CORNER ROUNDING PARA LALAPAT SA SCROLL) -->
    <header class="trainext-glass-card sticky-coordinator-header flex items-center justify-between gap-2 px-3.5 sm:px-5 py-3">
      <div class="trainext-brand-group flex items-center gap-2.5 min-w-0">
        <img src="/assets/trainext-logo.png" alt="TraiNext" class="w-8 h-8 sm:w-9 sm:h-9 object-contain shrink-0" />
        <div class="min-w-0">
          <span class="trainext-badge-role text-[9px] sm:text-[10px] tracking-wider block">OJT Coordinator</span>
          <h1 class="trainext-heading-name text-xs sm:text-sm font-bold text-white truncate max-w-[150px] sm:max-w-none">
            {{ authStore.user?.full_name || 'Academic Coordinator' }}
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
      
      <!-- ================= TAB 1: OVERVIEW (FOCUSED SA SAFETY AT BASE) ================= -->
      <div v-show="activeMainTab === 'overview'" class="tab-pane-container">
        <!-- COHORT PROGRESS PROGRESS BAR -->
        <section class="trainext-glass-card p-4 sm:p-5 flex flex-col gap-2.5">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span class="text-xs sm:text-[12px] font-bold uppercase tracking-wider text-slate-200 font-['Aileron',sans-serif]">
                COHORT PRACTICUM TARGET PROGRESS
              </span>
              <div class="flex items-baseline gap-2 mt-0.5">
                <span class="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">{{ cohortRenderedHours.toFixed(1) }}</span>
                <span class="text-xs font-semibold text-slate-400">/ {{ cohortTargetHours }} target hrs (Batch total)</span>
              </div>
            </div>
            <div class="text-right">
              <span class="text-xs font-bold text-[#00d9ff] font-mono">{{ cohortProgressPercentage }}%</span>
              <span class="block text-[9.5px] text-[#858994] font-medium">Batch Rendered</span>
            </div>
          </div>

          <div class="w-full h-2 rounded-full bg-white/10 overflow-hidden relative">
            <div 
              class="h-full rounded-full bg-gradient-to-r from-[#00d9ff] to-[#53d8f8] shadow-[0_0_10px_#00d9ff] transition-all duration-500 ease-out" 
              :style="{ width: `${cohortProgressPercentage}%` }"
            ></div>
          </div>
        </section>

        <!-- REAL-TIME SHIFT METRICS -->
        <section class="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div class="trainext-glass-card p-4 flex flex-col justify-between gap-1">
            <span class="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 font-['Aileron',sans-serif]">TOTAL ENROLLED</span>
            <span class="text-2xl font-extrabold text-white font-mono">{{ totalInterns }}</span>
          </div>

          <div class="trainext-glass-card p-4 flex flex-col justify-between gap-1">
            <span class="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 font-['Aileron',sans-serif]">ON DUTY</span>
            <span class="text-2xl font-extrabold text-[#00d9ff] font-mono">{{ onDutyCount }}</span>
          </div>

          <div class="trainext-glass-card p-4 flex flex-col justify-between gap-1">
            <span class="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 font-['Aileron',sans-serif]">IN TRANSIT</span>
            <span class="text-2xl font-extrabold text-amber-400 font-mono">{{ inTransitCount }}</span>
          </div>

          <div class="trainext-glass-card p-4 flex flex-col justify-between gap-1">
            <span class="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 font-['Aileron',sans-serif]">SAFE AT BASE</span>
            <span class="text-2xl font-extrabold text-emerald-400 font-mono">{{ safeCount }}</span>
          </div>

          <div class="trainext-glass-card p-4 flex flex-col justify-between gap-1 col-span-2 sm:col-span-1">
            <span class="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 font-['Aileron',sans-serif]">486H COMPLETED</span>
            <span class="text-2xl font-extrabold text-emerald-400 font-mono">{{ completedOjtCount }}</span>
          </div>
        </section>

        <!-- REAL-TIME SAFETY & TRANSIT VERIFICATION RADAR (WITH NOTES DIRECT DISPLAY) -->
        <section class="trainext-glass-card flex flex-col gap-3.5 p-4 sm:p-5">
          <div class="flex items-center justify-between gap-2">
            <div>
              <p class="text-xs sm:text-[13px] font-bold uppercase tracking-wider text-slate-200 font-['Aileron',sans-serif]">
                Transit Clearance &amp; Safety at Base Radar
              </p>
              <p class="trainext-subtitle text-[11px] mt-0.5">Live monitoring of trainees traveling between company worksites and home bases.</p>
            </div>
            <span 
              v-if="inTransitCount > 0"
              class="trainext-chip chip-amber animate-pulse shrink-0 font-mono text-[9.5px] flex items-center gap-1.5"
            >
              <svg class="w-3 h-3 text-amber-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{{ inTransitCount }} IN TRANSIT</span>
            </span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <!-- IN TRANSIT ALERT BOX -->
            <div class="p-3.5 rounded-2xl bg-amber-500/[0.04] border border-amber-500/25 flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-bold uppercase tracking-wider text-amber-300 font-mono flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                  Active Commutes (In Transit)
                </span>
                <span class="text-[10px] text-amber-400/80 font-mono">{{ inTransitInterns.length }} Trainees</span>
              </div>

              <div v-if="inTransitInterns.length === 0" class="py-5 text-center text-xs text-slate-400 font-mono">
                No active transit commutes currently ongoing.
              </div>

              <div v-else class="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
                <div 
                  v-for="intern in inTransitInterns" 
                  :key="intern.id"
                  class="p-2.5 rounded-xl bg-black/40 border border-amber-500/20 flex items-center justify-between gap-2"
                >
                  <div class="min-w-0">
                    <p class="text-xs font-bold text-white truncate">{{ intern.full_name }}</p>
                    <p class="text-[10px] text-slate-400 truncate font-mono mt-0.5">
                      Departed: {{ intern.time_out ? new Date(intern.time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending' }} • {{ intern.company_name }}
                    </p>
                  </div>
                  <span class="trainext-chip chip-amber shrink-0 text-[8.5px]">En Route</span>
                </div>
              </div>
            </div>

            <!-- SAFE AT BASE CONFIRMED TODAY (WITH COMMENTS DISPLAYED DIRECTLY BELOW) -->
            <div class="p-3.5 rounded-2xl bg-emerald-500/[0.04] border border-emerald-500/25 flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-300 font-mono flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
                  Confirmed Safe at Base Today
                </span>
                <span class="text-[10px] text-emerald-400/80 font-mono">{{ safeAtBaseInterns.length }} Cleared</span>
              </div>

              <div v-if="safeAtBaseInterns.length === 0" class="py-5 text-center text-xs text-slate-400 font-mono">
                No safe at base confirmations recorded yet for today's shifts.
              </div>

              <div v-else class="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                <div 
                  v-for="intern in safeAtBaseInterns" 
                  :key="intern.id"
                  class="p-2.5 rounded-xl bg-black/40 border border-emerald-500/20 flex flex-col gap-1.5"
                >
                  <div class="flex items-center justify-between gap-2">
                    <div class="min-w-0">
                      <p class="text-xs font-bold text-white truncate">{{ intern.full_name }}</p>
                      <p class="text-[10px] text-emerald-400/90 font-mono mt-0.5">
                        Safe at Base: {{ intern.safe_at_base_time ? new Date(intern.safe_at_base_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Verified' }}
                      </p>
                    </div>
                    <span class="trainext-chip chip-emerald shrink-0 text-[8.5px] flex items-center gap-1">
                      <svg class="w-2.5 h-2.5 text-emerald-300" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Safe</span>
                    </span>
                  </div>

                  <!-- DIRECT COMMENT / TRANSIT NOTE -->
                  <div 
                    v-if="intern.transit_notes" 
                    class="p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/20 text-emerald-200 text-[10.5px] leading-relaxed flex items-start gap-1.5"
                  >
                    <svg class="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <span class="italic">"{{ intern.transit_notes }}"</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- ================= TAB 2: DIRECTORY (ACADEMIC COHORT DOCU NASA PINAKATAAS) ================= -->
      <div v-show="activeMainTab === 'directory'" class="tab-pane-container">
        
        <!-- ACADEMIC COHORT DOCUMENTATION & AUDIT EXPORTS (PINAKATAAS NG DIRECTORY) -->
        <section class="trainext-glass-card flex flex-col gap-3.5 p-4 sm:p-5">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p class="text-xs sm:text-[13px] font-bold uppercase tracking-wider text-slate-200 font-['Aileron',sans-serif]">
                Academic Cohort Documentation &amp; Audit
              </p>
              <p class="trainext-subtitle text-[11px] mt-0.5">Export verified practicum compliance records and cohort-wide audit files.</p>
            </div>

            <!-- EXPORT ACTION BUTTONS -->
            <div class="flex items-center gap-2 self-start sm:self-auto">
              <button 
                type="button" 
                @click="handleMasterCSVExport" 
                class="pill-neutral-btn cursor-pointer whitespace-nowrap"
              >
                <svg class="w-3.5 h-3.5 shrink-0 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Export Master CSV</span>
              </button>

              <button 
                type="button" 
                @click="handleMasterPDFExport" 
                class="pill-cyan-btn cursor-pointer whitespace-nowrap"
              >
                <svg class="w-3.5 h-3.5 shrink-0 text-[#00d9ff]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                <span>Cohort Summary PDF</span>
              </button>
            </div>
          </div>
        </section>

        <!-- LIVE DIRECTORY FEED -->
        <section class="trainext-glass-card flex flex-col gap-4 p-4 sm:p-5">
          <div>
            <h2 class="trainext-title text-sm sm:text-base">Live Intern Shift Monitoring</h2>
            <p class="trainext-subtitle text-[11px]">Real-time shift auditing across all host company sites and workplaces.</p>
          </div>

          <!-- SEARCH AND STATUS FILTER BAR -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            <div class="sm:col-span-2 relative flex items-center">
              <svg class="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input 
                v-model="directorySearch"
                type="text" 
                placeholder="Search by intern name, email, or company site..."
                class="search-input-field pl-10 pr-4"
              />
              <button 
                v-if="directorySearch" 
                @click="directorySearch = ''" 
                class="absolute right-3.5 text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <select v-model="directoryStatusFilter" class="trainext-select-glass text-xs h-10">
              <option value="all">Filter: All Statuses</option>
              <option value="on_duty">On Duty</option>
              <option value="in_transit">In Transit</option>
              <option value="safe_at_base">Safe at Base</option>
              <option value="idle">Idle / Not Checked In</option>
              <option value="completed_ojt">486 Hours Completed</option>
            </select>
          </div>

          <!-- DIRECTORY LIST -->
          <div v-if="filteredDirectoryInterns.length === 0" class="p-8 text-center text-xs text-[#858994] font-mono">
            No trainees match the current search or status filter.
          </div>

          <div v-else class="flex flex-col gap-2">
            <div 
              v-for="intern in filteredDirectoryInterns" 
              :key="intern.id"
              class="report-item-card group"
            >
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <p class="text-xs sm:text-sm font-semibold text-white truncate">{{ intern.full_name }}</p>
                  
                  <span 
                    class="trainext-chip shrink-0 text-[9.5px]"
                    :class="{
                      'chip-cyan': intern.today_status === 'on_duty',
                      'chip-amber': intern.today_status === 'in_transit',
                      'chip-emerald': intern.today_status === 'safe_at_base',
                      'border border-white/15 text-[#858994]': intern.today_status === 'idle'
                    }"
                  >
                    {{ intern.today_status.replace(/_/g, ' ') }}
                  </span>

                  <span 
                    v-if="intern.is_ojt_completed"
                    class="trainext-chip chip-emerald shrink-0 text-[9px] font-mono flex items-center gap-1"
                  >
                    <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>486H DONE</span>
                  </span>
                </div>

                <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#858994] mt-1 font-mono">
                  <span class="text-slate-300 font-medium truncate max-w-[140px]">{{ intern.company_name }}</span>
                  <span></span>
                  <span class="truncate max-w-[140px]">Sup: {{ intern.supervisor_name }}</span>
                  <span></span>
                  <span>Hours: <strong class="text-[#00d9ff]">{{ intern.total_hours.toFixed(1) }}h</strong></span>
                </div>
              </div>

              <!-- DTR AUDIT BUTTON -->
              <div class="flex items-center gap-2 shrink-0">
                <button 
                  type="button"
                  @click="handleIndividualExport(intern)"
                  :disabled="isExportingIndividual === intern.id"
                  class="pill-cyan-btn cursor-pointer whitespace-nowrap"
                  title="View complete attendance logs and timestamps"
                >
                  <div v-if="isExportingIndividual === intern.id" class="spinner-ring border-[#00d9ff]"></div>
                  <svg v-else class="w-3.5 h-3.5 shrink-0 text-[#00d9ff]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>DTR Audit</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- ================= TAB 3: APPROVED REPORTS & PERFORMANCE (BY TRAINEE) ================= -->
      <div v-show="activeMainTab === 'performance'" class="tab-pane-container">
        <section class="trainext-glass-card flex flex-col gap-4 p-4 sm:p-5">
          <div>
            <h2 class="trainext-title text-sm sm:text-base">Trainee Accomplishment Records (Approved)</h2>
            <p class="trainext-subtitle text-[11px]">Audit approved work accomplishments, submissions, and supervisor feedback grouped by trainee.</p>
          </div>

          <!-- SEARCH BAR -->
          <div class="relative flex items-center w-full pt-1">
            <svg class="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input 
              v-model="performanceSearch"
              type="text" 
              placeholder="Search trainees by name or host company..."
              class="search-input-field pl-10 pr-4"
            />
            <button 
              v-if="performanceSearch" 
              @click="performanceSearch = ''" 
              class="absolute right-3.5 text-slate-400 hover:text-white text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>

          <!-- TRAINEE CARDS LIST (GROUPED BY TRAINEE) -->
          <div v-if="filteredPerformanceInterns.length === 0" class="p-8 text-center text-xs text-[#858994] font-mono">
            No trainees found matching '{{ performanceSearch }}'.
          </div>

          <div v-else class="flex flex-col gap-2">
            <div 
              v-for="intern in filteredPerformanceInterns" 
              :key="intern.id"
              @click="openTraineeReports(intern)"
              class="report-item-card group cursor-pointer"
            >
              <div class="flex items-center gap-3 min-w-0 flex-1">
                <!-- AVATAR LETTER -->
                <div class="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-[#00d9ff] font-bold shrink-0">
                  {{ (intern.full_name || 'T')[0] }}
                </div>

                <div class="min-w-0">
                  <p class="text-xs sm:text-sm font-semibold text-white group-hover:text-[#00d9ff] transition-colors truncate">
                    {{ intern.full_name }}
                  </p>
                  <div class="flex items-center gap-2 text-[10.5px] text-[#858994] font-mono mt-0.5">
                    <span class="truncate max-w-[150px] text-slate-300">{{ intern.company_name }}</span>
                    <span>•</span>
                    <span class="text-emerald-400 font-semibold">{{ intern.approved_reports_count }} Approved Reports</span>
                  </div>
                </div>
              </div>

              <!-- VIEW ACTION -->
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
    <nav class="fixed-bottom-bar" aria-label="Coordinator Bottom Navigation">
      <div class="bottom-bar-inner">
        <!-- TAB 1: OVERVIEW -->
        <button 
          type="button" 
          @click="activeMainTab = 'overview'"
          class="bottom-nav-item"
          :class="{ active: activeMainTab === 'overview' }"
          aria-label="Cohort Overview"
        >
          <div class="relative flex items-center justify-center">
            <svg class="w-5 h-5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <span v-if="activeMainTab === 'overview'" class="active-dot"></span>
        </button>

        <!-- TAB 2: DIRECTORY (MAY BLUE NOTIF DOT KAPAG MAY TRAINEES IN TRANSIT) -->
        <button 
          type="button" 
          @click="activeMainTab = 'directory'"
          class="bottom-nav-item"
          :class="{ active: activeMainTab === 'directory' }"
          aria-label="Live Directory"
        >
          <div class="relative flex items-center justify-center">
            <svg class="w-5 h-5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span v-if="inTransitCount > 0" class="nav-notif-dot animate-pulse"></span>
          </div>
          <span v-if="activeMainTab === 'directory'" class="active-dot"></span>
        </button>

        <!-- TAB 3: APPROVED REPORTS & PERFORMANCE -->
        <button 
          type="button" 
          @click="activeMainTab = 'performance'"
          class="bottom-nav-item"
          :class="{ active: activeMainTab === 'performance' }"
          aria-label="Trainee Accomplishments"
        >
          <div class="relative flex items-center justify-center">
            <svg class="w-5 h-5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span v-if="activeMainTab === 'performance'" class="active-dot"></span>
        </button>
      </div>
    </nav>

    <!-- ================= PASILIP MODAL: APPROVED REPORTS BY TRAINEE (DATE, TITLE, DESC, FEEDBACK LANG) ================= -->
    <div 
      v-if="isTraineeReportsModalOpen && selectedTraineeForReview" 
      class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md select-none overflow-y-auto"
    >
      <div class="w-full max-w-[620px] my-auto rounded-[24px] bg-[#050811]/95 border border-white/15 shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <!-- HEADER -->
        <header class="px-5 sm:px-6 py-4 border-b border-white/10 flex items-center justify-between gap-3 bg-white/[0.015]">
          <div class="min-w-0">
            <p class="text-sm sm:text-base font-bold text-white truncate font-['Aileron',sans-serif]">
              {{ selectedTraineeForReview.full_name }} — Approved Reports
            </p>
            <p class="text-[10px] text-[#00d9ff] font-mono tracking-wider truncate mt-0.5">
              {{ selectedTraineeForReview.company_name }} • {{ currentTraineeApprovedReports.length }} VERIFIED ENTRIES
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

        <!-- STREAMLINED FEED (DATE, TITLE, DESC, FEEDBACK LANG PARA MALINIS) -->
        <div class="p-5 sm:p-6 flex flex-col gap-3.5 overflow-y-auto max-h-[calc(80vh-75px)]">
          <div v-if="currentTraineeApprovedReports.length === 0" class="p-8 text-center text-xs text-[#858994] font-mono">
            No approved reports recorded yet for this trainee.
          </div>

          <div 
            v-for="rep in currentTraineeApprovedReports" 
            :key="rep.id"
            class="p-4 rounded-2xl bg-white/[0.02] border border-white/10 flex flex-col gap-2.5"
          >
            <!-- DATE & TITLE ROW -->
            <div class="flex items-start justify-between gap-2">
              <p class="text-xs sm:text-sm font-bold text-white tracking-wide">
                {{ rep.title }}
              </p>
              <span class="text-[10px] font-mono text-[#00d9ff] font-semibold shrink-0">
                {{ rep.report_date }}
              </span>
            </div>

            <!-- DESCRIPTION -->
            <p class="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
              {{ rep.description }}
            </p>

            <!-- SUPERVISOR FEEDBACK -->
            <div 
              v-if="rep.feedback" 
              class="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-200 text-xs flex flex-col gap-0.5 mt-1"
            >
              <span class="text-[8.5px] font-bold uppercase tracking-wider text-emerald-400 font-mono flex items-center gap-1">
                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                <span>SUPERVISOR REMARKS:</span>
              </span>
              <p class="leading-relaxed">{{ rep.feedback }}</p>
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
            <p class="text-xs text-[#858994]">Are you sure you want to end your coordinator session?</p>
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

    <!-- PROFILE SETTINGS & REPORT PREVIEW MODALS -->
    <ProfileSettingsModal 
      :is-open="isProfileSettingsOpen"
      @close="isProfileSettingsOpen = false"
      @saved="fetchMasterData(); authStore.fetchProfile();"
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
/* STICKY HEADER (FLAT EDGE-TO-EDGE, ZERO CORNER ROUNDING) */
.sticky-coordinator-header {
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

/* COMPACT ITEM CARDS */
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
.search-input-field {
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

.search-input-field::placeholder {
  font-size: 10.5px;
  letter-spacing: 0.3px;
  color: #717684;
}

.search-input-field:focus {
  border-color: #00d9ff;
  box-shadow: 0 0 10px rgba(0, 217, 255, 0.25);
}

/* ================= ERGONOMIC PILL BUTTON STANDARDS ================= */

/* CYAN PILL (DTR AUDIT, SUMMARY PDF) */
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

/* NEUTRAL PILL (EXPORT MASTER CSV) */
.pill-neutral-btn {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 6px !important;
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