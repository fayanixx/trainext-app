<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import * as csvLib from '@/lib/csv';
import * as exportLib from '@/lib/exportUtils';
import ProofViewerModal from '@/components/ProofViewerModal.vue';
import ProfileSettingsModal from '@/components/ProfileSettingsModal.vue';

let coordinatorRealtimeChannel: any = null;
const router = useRouter();
const authStore = useAuthStore();

// UI State
const isProfileSettingsOpen = ref(false);
const showSignOutConfirm = ref(false);
const isSigningOut = ref(false);
const loading = ref(true);
const searchQuery = ref('');
const statusFilter = ref<'all' | 'on_duty' | 'in_transit' | 'safe_at_base' | 'idle'>('all');

// Modals
const isProofViewerOpen = ref(false);
const activeProofUrl = ref<string | null>(null);
const activeProofType = ref<'image' | 'document' | 'video' | null>(null);
const activeProofTitle = ref('');

// Master Intern Data
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
}

const internsList = ref<InternRecord[]>([]);

// Metrics Calculation
const totalInterns = computed(() => internsList.value.length);
const onDutyCount = computed(() => internsList.value.filter((i) => i.today_status === 'on_duty').length);
const inTransitCount = computed(() => internsList.value.filter((i) => i.today_status === 'in_transit').length);
const safeCount = computed(() => internsList.value.filter((i) => i.today_status === 'safe_at_base').length);

// Filtered Interns
const filteredInterns = computed(() => {
  return internsList.value.filter((intern) => {
    const query = searchQuery.value.toLowerCase().trim();
    const matchesSearch =
      !query ||
      intern.full_name.toLowerCase().includes(query) ||
      intern.email.toLowerCase().includes(query) ||
      (intern.company_name || '').toLowerCase().includes(query) ||
      (intern.supervisor_name || '').toLowerCase().includes(query);

    const matchesStatus =
      statusFilter.value === 'all' || intern.today_status === statusFilter.value;

    return matchesSearch && matchesStatus;
  });
});

// Fetch All Interns, Links, and Shift Information
const fetchMasterData = async () => {
  loading.value = true;
  try {
    const today = new Date().toISOString().split('T')[0];

    // 1. Kunin ang lahat ng interns
    const { data: interns, error: internErr } = await supabase
      .from('profiles')
      .select('id, full_name, email, contact_number')
      .eq('role', 'intern');

    if (internErr) throw internErr;

    if (!interns || interns.length === 0) {
      internsList.value = [];
      return;
    }

    const internIds = interns.map((i: any) => i.id);

    // 2. Kunin ang supervisor links nang hiwalay para maiwasan ang join drop
    const { data: links } = await supabase
      .from('intern_supervisor_links')
      .select(`
        intern_id,
        status,
        supervisor:profiles!supervisor_id (
          full_name,
          company_sites (
            company_name
          )
        )
      `)
      .in('intern_id', internIds);

    // 3. Kunin ang attendance logs para sa total rendered hours at shift ngayong araw
    const { data: attendance } = await supabase
      .from('attendance_logs')
      .select('id, intern_id, date, status, time_in, time_out, hours_rendered')
      .in('intern_id', internIds);

    // 4. Pagsamahin ang records
    internsList.value = interns.map((intern: any) => {
      const userLinks = (links || []).filter((l: any) => l.intern_id === intern.id);
      const approvedLink = userLinks.find((l: any) => l.status === 'approved');
      const pendingLink = userLinks.find((l: any) => l.status === 'pending');
      const activeLink = approvedLink || pendingLink;

      const supervisor = (activeLink as any)?.supervisor;
      const company = supervisor?.company_sites?.[0]?.company_name || (supervisor?.company_sites as any)?.company_name;

      const logs = (attendance || []).filter((a: any) => a.intern_id === intern.id);
      const todayLog = logs.find((l: any) => l.date === today);

      const totalHours = logs.reduce(
        (sum: number, l: any) => sum + (Number(l.hours_rendered) || 0),
        0
      );

      let affiliationLabel = 'Unassigned';
      if (approvedLink) {
        affiliationLabel = supervisor?.full_name || 'Assigned Supervisor';
      } else if (pendingLink) {
        affiliationLabel = `${supervisor?.full_name || 'Supervisor'} (Pending Approval)`;
      }

      return {
        id: intern.id,
        full_name: intern.full_name || 'Unnamed Intern',
        email: intern.email || 'No email provided',
        contact_number: intern.contact_number || 'N/A',
        supervisor_name: affiliationLabel,
        company_name: company || (approvedLink ? 'Partner Site' : 'Pending Assignment'),
        today_status: todayLog ? todayLog.status : 'idle',
        total_hours: totalHours,
        time_in: todayLog?.time_in,
        time_out: todayLog?.time_out,
      };
    });
  } catch (err: any) {
    console.error('Failed to load coordinator master data:', err.message);
  } finally {
    loading.value = false;
  }
};

const handleSignOut = async () => {
  isSigningOut.value = true;
  try {
    showSignOutConfirm.value = false;
    await authStore.signOut();
    router.replace('/auth');
  } catch (err: any) {
    console.error('Sign out error:', err.message);
  } finally {
    isSigningOut.value = false;
  }
};

// Export Reports
const handleCSVExport = () => {
  const exportFn = (csvLib as any).exportAttendanceToCSV || (csvLib as any).exportToCSV || (csvLib as any).generateCSV;
  if (typeof exportFn === 'function') {
    exportFn(internsList.value);
  } else {
    const headers = 'Name,Email,Company,Supervisor,Status,Total Hours\n';
    const rows = internsList.value
      .map(i => `"${i.full_name}","${i.email}","${i.company_name}","${i.supervisor_name}","${i.today_status}",${i.total_hours}`)
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trainext_interns_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
};

const handlePDFExport = () => {
  const exportFn = (exportLib as any).exportInternsToPDF || (exportLib as any).exportToPDF;
  if (typeof exportFn === 'function') {
    exportFn(internsList.value);
  } else {
    window.print();
  }
};

onMounted(async () => {
  await authStore.fetchProfile();
  if (!authStore.isAuthenticated || !authStore.isCoordinator || !authStore.user) {
    router.replace('/auth');
    return;
  }
  await fetchMasterData();

  // Makinig sa Realtime events para sa bagong profiles at attendance
  coordinatorRealtimeChannel = supabase
    .channel('coordinator-global-sync')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'profiles',
      },
      () => {
        fetchMasterData();
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'attendance_logs',
      },
      () => {
        fetchMasterData();
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'intern_supervisor_links',
      },
      () => {
        fetchMasterData();
      }
    )
    .subscribe();
});

onUnmounted(() => {
  if (coordinatorRealtimeChannel) {
    supabase.removeChannel(coordinatorRealtimeChannel);
    coordinatorRealtimeChannel = null;
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
            <span class="trainext-badge-role">OJT Program Coordinator</span>
            <h1 class="trainext-heading-name">{{ authStore.user?.full_name || 'Academic Coordinator' }}</h1>
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

      <!-- METRICS SNAPSHOT -->
      <section class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="trainext-glass-card p-4 flex flex-col gap-1">
          <span class="trainext-label">ENROLLED INTERNS</span>
          <span class="text-2xl font-bold text-white">{{ totalInterns }}</span>
        </div>

        <div class="trainext-glass-card p-4 flex flex-col gap-1">
          <span class="trainext-label">ON DUTY NOW</span>
          <span class="text-2xl font-bold text-[#00d9ff]">{{ onDutyCount }}</span>
        </div>

        <div class="trainext-glass-card p-4 flex flex-col gap-1">
          <span class="trainext-label">IN TRANSIT</span>
          <span class="text-2xl font-bold text-amber-400">{{ inTransitCount }}</span>
        </div>

        <div class="trainext-glass-card p-4 flex flex-col gap-1">
          <span class="trainext-label">SAFE AT BASE</span>
          <span class="text-2xl font-bold text-emerald-400">{{ safeCount }}</span>
        </div>
      </section>

      <!-- MASTER LIST & FILTER TOOLBAR -->
      <section class="trainext-glass-card flex flex-col gap-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 class="trainext-title">Live Intern Verification Directory</h2>
            <p class="trainext-subtitle text-[11px]">Real-time audit across all partner training agencies and designated worksites.</p>
          </div>

          <!-- Export Actions -->
          <div class="flex items-center gap-2 w-full sm:w-auto">
            <button 
              type="button" 
              @click="handleCSVExport"
              class="flex-1 sm:flex-none justify-center px-3.5 py-1.5 rounded-full border border-white/20 text-xs text-slate-300 hover:text-white transition flex items-center gap-1.5 cursor-pointer"
            >
              <svg class="w-3.5 h-3.5 text-[#00d9ff]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Export CSV</span>
            </button>

            <button 
              type="button" 
              @click="handlePDFExport"
              class="flex-1 sm:flex-none justify-center trainext-btn-pill-primary h-[34px] px-3.5 text-[10.5px] flex items-center gap-1.5"
            >
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span>Generate PDF</span>
            </button>
          </div>
        </div>

        <!-- Search and Filter Bar -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          <div class="sm:col-span-2 relative">
            <input 
              v-model="searchQuery"
              type="text" 
              placeholder="Search by intern name, email, or company site..."
              class="w-full h-10 px-4 pl-9 rounded-full bg-black/40 border border-white/15 text-xs text-white placeholder:text-[#858994] outline-none focus:border-[#00d9ff]"
            />
            <svg class="w-3.5 h-3.5 text-[#858994] absolute left-3.5 top-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <select v-model="statusFilter" class="trainext-select-glass text-xs">
            <option value="all">Filter: All Statuses</option>
            <option value="on_duty">On Duty</option>
            <option value="in_transit">In Transit</option>
            <option value="safe_at_base">Safe at Base</option>
            <option value="idle">Idle / Not Checked In</option>
          </select>
        </div>

        <!-- Interns Master Feed -->
        <div v-if="loading" class="p-8 text-center text-xs text-[#858994]">
          Loading directory records...
        </div>

        <div v-else-if="filteredInterns.length === 0" class="p-8 text-center text-xs text-[#858994]">
          No intern records match the selected criteria.
        </div>

        <div v-else class="flex flex-col gap-2.5">
          <div 
            v-for="intern in filteredInterns" 
            :key="intern.id"
            class="p-4 rounded-2xl bg-white/[0.02] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="text-sm font-bold text-white truncate">{{ intern.full_name }}</h3>
                <span 
                  class="trainext-chip shrink-0"
                  :class="{
                    'chip-cyan': intern.today_status === 'on_duty',
                    'chip-amber': intern.today_status === 'in_transit',
                    'chip-emerald': intern.today_status === 'safe_at_base',
                    'border border-white/15 text-[#858994]': intern.today_status === 'idle'
                  }"
                >
                  {{ intern.today_status.replace(/_/g, ' ') }}
                </span>
              </div>

              <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#858994] mt-1.5">
                <span class="text-slate-300 font-medium">{{ intern.company_name }}</span>
                <span>•</span>
                <span>Sup: {{ intern.supervisor_name }}</span>
                <span>•</span>
                <span>Contact: {{ intern.contact_number }}</span>
              </div>
            </div>

            <div class="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10 shrink-0">
              <div class="text-left sm:text-right">
                <span class="text-[8px] font-bold uppercase tracking-wider text-[#858994] block">RENDERED</span>
                <span class="text-xs font-bold text-[#00d9ff] font-mono">{{ intern.total_hours.toFixed(1) }} hrs</span>
              </div>

              <div v-if="intern.time_in" class="p-2 rounded-xl bg-white/[0.03] border border-white/10 text-right">
                <span class="text-[7px] font-bold text-[#858994] tracking-wider uppercase block">TODAY IN</span>
                <span class="text-[11px] font-mono text-white">{{ new Date(intern.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- FOOTER -->
      <footer class="trainext-footer-tagline">
        <span>Smart Tracking.</span>
        <span>Real-Time Safety.</span>
      </footer>
    </div>

      <!-- SIGN OUT CONFIRMATION MODAL -->
      <div 
        v-if="showSignOutConfirm" 
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      >
        <div class="trainext-glass-card max-w-sm w-full p-6 flex flex-col gap-4 border border-white/20 animate-in fade-in zoom-in-95 duration-150">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-bold text-white">Confirm Sign Out</h3>
              <p class="text-xs text-[#858994]">Are you sure you want to end your current session?</p>
            </div>
          </div>

          <div class="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
            <button 
              type="button"
              @click="showSignOutConfirm = false"
              :disabled="isSigningOut"
              class="px-4 py-2 rounded-full border border-white/20 text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="button"
              @click="handleSignOut"
              :disabled="isSigningOut"
              class="px-4 py-2 rounded-full bg-rose-500/20 border border-rose-500/50 text-rose-300 text-xs font-bold hover:bg-rose-500/30 transition cursor-pointer"
            >
              {{ isSigningOut ? 'Signing out...' : 'Yes, Sign Out' }}
            </button>
          </div>
        </div>
      </div>

    <!-- MODALS -->
    <ProfileSettingsModal 
      :is-open="isProfileSettingsOpen"
      @close="isProfileSettingsOpen = false"
      @saved="fetchMasterData(); authStore.fetchProfile();"
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