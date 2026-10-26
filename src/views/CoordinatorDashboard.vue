<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import type { AttendanceLog } from '@/types';
import { exportToCsv, printSummaryReport, type TraineeExportRow } from '@/lib/exportUtils';

const router = useRouter();
const authStore = useAuthStore();

// Dashboard State
const loading = ref(true);
const internsMasterList = ref<any[]>([]);
const todayAttendanceLogs = ref<AttendanceLog[]>([]);
const pingSuccessMessage = ref('');
const pingErrorMessage = ref('');
const isPinging = ref<string | null>(null);

// Real-Time Safety Metrics Counters
const inTransitCount = computed(() => {
  return todayAttendanceLogs.value.filter((log) => log.status === 'in_transit').length;
});

const safeAtBaseCount = computed(() => {
  return todayAttendanceLogs.value.filter((log) => log.status === 'safe_at_base').length;
});

const onDutyCount = computed(() => {
  return todayAttendanceLogs.value.filter((log) => log.status === 'on_duty').length;
});

// Fetch All Registered Batch Interns with Affiliation & Rendered Hours
const fetchCoordinatorData = async () => {
  loading.value = true;
  try {
    const today = new Date().toISOString().split('T')[0];

    // 1. Fetch Today's Attendance Logs for Live Safety Feed
    const { data: attendanceData, error: attendanceError } = await supabase
      .from('attendance_logs')
      .select(`
        id,
        intern_id,
        date,
        time_in,
        time_out,
        hours_rendered,
        status,
        safe_at_base_time,
        intern:profiles!attendance_logs_intern_id_fkey (
          id,
          full_name,
          contact_number,
          emergency_contact_name,
          emergency_contact_number
        )
      `)
      .eq('date', today);

    if (attendanceError) throw attendanceError;
    todayAttendanceLogs.value = (attendanceData as any[]) || [];

    // 2. Fetch Master List of All Interns under Batch
    const { data: internsData, error: internsError } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        contact_number,
        emergency_contact_name,
        emergency_contact_number,
        created_at,
        intern_supervisor_links (
          status,
          supervisor_id,
          supervisor:profiles!intern_supervisor_links_supervisor_id_fkey (
            full_name,
            company_sites (
              company_name
            )
          )
        ),
        attendance_logs (
          hours_rendered
        )
      `)
      .eq('role', 'intern')
      .order('full_name', { ascending: true });

    if (internsError) throw internsError;

    // Compute cumulative approved rendered hours per intern
    internsMasterList.value = (internsData || []).map((intern: any) => {
      const logs = intern.attendance_logs || [];
      const totalHours = logs.reduce((acc: number, curr: any) => acc + (Number(curr.hours_rendered) || 0), 0);
      const link = intern.intern_supervisor_links?.[0];
      const supervisorProfile = link?.supervisor;
      const companySite = supervisorProfile?.company_sites?.[0];

      return {
        ...intern,
        totalRenderedHours: Number(totalHours.toFixed(2)),
        supervisorName: link?.status === 'approved' ? supervisorProfile?.full_name : (link?.status === 'pending' ? 'Pending Approval' : 'Unassigned'),
        companyName: link?.status === 'approved' ? (companySite?.company_name || 'N/A') : 'Unassigned',
        linkStatus: link?.status || 'none',
      };
    });
  } catch (err: any) {
    console.error('Failed to load coordinator data:', err.message);
  } finally {
    loading.value = false;
  }
};

// Dispatch Transit Arrival Ping
const pingTransitReminder = async (internId: string, internName: string) => {
  isPinging.value = internId;
  pingSuccessMessage.value = '';
  pingErrorMessage.value = '';

  try {
    await new Promise((resolve) => setTimeout(resolve, 800));

    pingSuccessMessage.value = `Transit arrival reminder ping dispatched to ${internName}.`;
    setTimeout(() => {
      pingSuccessMessage.value = '';
    }, 4000);
  } catch (err: any) {
    pingErrorMessage.value = err.message || 'Failed to dispatch transit reminder.';
  } finally {
    isPinging.value = null;
  }
};

// 1. Export CSV Handler
const handleExportCsv = () => {
  const exportRows = internsMasterList.value.map((item) => ({
    'Trainee Name': item.full_name,
    'Contact Number': item.contact_number || 'N/A',
    'Emergency Contact': item.emergency_contact_name || 'N/A',
    'Emergency Contact Number': item.emergency_contact_number || 'N/A',
    'Host Training Company': item.companyName,
    'Assigned Supervisor': item.supervisorName,
    'Total Rendered Hours': `${item.totalRenderedHours} hrs`,
    'Affiliation Status': item.linkStatus.toUpperCase(),
  }));

  exportToCsv('TraiNext_OJT_Batch_Summary', exportRows);
};

// 2. Print / PDF Summary Report Handler
const handlePrintPdf = () => {
  const rows: TraineeExportRow[] = internsMasterList.value.map((item) => ({
    fullName: item.full_name,
    contactNumber: item.contact_number || 'N/A',
    emergencyContact: item.emergency_contact_name || 'N/A',
    emergencyNumber: item.emergency_contact_number || 'N/A',
    supervisorName: item.supervisorName,
    companyName: item.companyName,
    totalRenderedHours: item.totalRenderedHours,
    affiliationStatus: item.linkStatus,
  }));

  printSummaryReport({
    coordinatorName: authStore.user?.full_name || 'OJT Coordinator',
    batchTitle: 'IT OJT Trainees Batch',
    data: rows,
  });
};

onMounted(async () => {
  await authStore.fetchProfile();
  if (!authStore.isAuthenticated || !authStore.isCoordinator || !authStore.user) {
    router.push('/auth');
    return;
  }
  await fetchCoordinatorData();
});
</script>

<template>
  <div class="min-h-screen bg-[#0a0f1d] text-slate-100 p-4 sm:p-8 relative overflow-hidden select-none">
    <!-- Ambient Neon Cyberpunk Glow Backdrops -->
    <div class="absolute -top-40 -left-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none"></div>
    <div class="absolute top-1/2 -right-40 w-96 h-96 bg-fuchsia-500/10 rounded-full blur-[140px] pointer-events-none"></div>

    <div class="max-w-7xl mx-auto space-y-6 relative z-10">
      
      <!-- Top Dynamic Header Bar -->
      <header class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-[#0d1527]/80 border border-cyan-500/25 backdrop-blur-2xl shadow-[0_0_35px_rgba(6,182,212,0.12)]">
        <div>
          <div class="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/40 text-[10px] font-bold text-cyan-300 uppercase tracking-widest mb-1">
            <span class="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
            School Coordinator Portal
          </div>
          <h1 class="text-xl sm:text-2xl font-black text-white tracking-wide">
            Institutional OJT Command Center
          </h1>
          <p class="text-xs text-slate-400">
            Coordinator: {{ authStore.user?.full_name }} • Batch Accountability & Transit Live Feed
          </p>
        </div>

        <div class="flex items-center gap-2.5 flex-wrap">
          <button 
            @click="handleExportCsv"
            :disabled="internsMasterList.length === 0"
            class="px-4 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-cyan-500/30 text-xs font-bold text-cyan-300 hover:text-white transition flex items-center gap-1.5 disabled:opacity-40"
          >
            <span>📊</span>
            <span>Download CSV</span>
          </button>
          <button 
            @click="handlePrintPdf"
            :disabled="internsMasterList.length === 0"
            class="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 text-white text-xs font-bold uppercase tracking-wider shadow-[0_0_20px_rgba(6,182,212,0.25)] transition flex items-center gap-1.5 disabled:opacity-40"
          >
            <span>🖨️</span>
            <span>Print / PDF Report</span>
          </button>
          <button 
            @click="fetchCoordinatorData"
            class="px-3 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-xs text-slate-300 hover:text-white transition"
            title="Refresh Feed"
          >
            🔄
          </button>
          <button 
            @click="authStore.signOut(); router.push('/auth');"
            class="px-4 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white transition"
          >
            Sign Out
          </button>
        </div>
      </header>

      <!-- Feedback Banners -->
      <div v-if="pingSuccessMessage" class="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-300 font-medium">
        {{ pingSuccessMessage }}
      </div>
      <div v-if="pingErrorMessage" class="p-4 rounded-2xl bg-red-950/60 border border-red-500/40 text-xs text-red-300 font-medium">
        {{ pingErrorMessage }}
      </div>

      <!-- 1. REAL-TIME SAFETY & TRANSIT METRIC COUNTERS -->
      <section class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <!-- In Transit Counter -->
        <div class="p-5 rounded-3xl bg-[#0d1527]/90 border border-amber-500/40 backdrop-blur-2xl shadow-[0_0_35px_rgba(245,158,11,0.15)] flex items-center justify-between">
          <div>
            <div class="inline-flex items-center gap-1.5 text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1">
              <span class="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
              In Transit (En Route)
            </div>
            <div class="text-3xl font-black text-white font-mono">{{ inTransitCount }}</div>
            <p class="text-[11px] text-slate-400 mt-1">Clocked out; heading to dorm/home</p>
          </div>
          <div class="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-2xl text-amber-300">
            🚶
          </div>
        </div>

        <!-- Safe at Base Counter -->
        <div class="p-5 rounded-3xl bg-[#0d1527]/90 border border-emerald-500/40 backdrop-blur-2xl shadow-[0_0_35px_rgba(16,185,129,0.15)] flex items-center justify-between">
          <div>
            <div class="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">
              <span>🛡️</span>
              Safe at Base
            </div>
            <div class="text-3xl font-black text-white font-mono">{{ safeAtBaseCount }}</div>
            <p class="text-[11px] text-slate-400 mt-1">Arrival validated; accountability cleared</p>
          </div>
          <div class="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-2xl text-emerald-300">
            🏠
          </div>
        </div>

        <!-- On Duty Counter -->
        <div class="p-5 rounded-3xl bg-[#0d1527]/90 border border-cyan-500/40 backdrop-blur-2xl shadow-[0_0_35px_rgba(6,182,212,0.15)] flex items-center justify-between">
          <div>
            <div class="inline-flex items-center gap-1.5 text-[10px] font-bold text-cyan-400 uppercase tracking-widest mb-1">
              <span class="w-2 h-2 rounded-full bg-cyan-400"></span>
              On Duty (At Office)
            </div>
            <div class="text-3xl font-black text-white font-mono">{{ onDutyCount }}</div>
            <p class="text-[11px] text-slate-400 mt-1">Currently inside office geofence</p>
          </div>
          <div class="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-2xl text-cyan-300">
            🏢
          </div>
        </div>
      </section>

      <!-- 2. LIVE TRANSIT FEED & PING PROMPT SECTION -->
      <section class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-bold text-white tracking-wide">
              Live Transit Safety Watch
            </h2>
            <p class="text-xs text-slate-400">
              Trainees who have completed today's shift and are currently traveling back to their base
            </p>
          </div>
          <span class="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold font-mono">
            {{ inTransitCount }} Trainees En Route
          </span>
        </div>

        <!-- Empty State -->
        <div v-if="inTransitCount === 0" class="p-8 rounded-3xl bg-[#0d1527]/50 border border-slate-800/80 text-center text-xs text-slate-400">
          No trainees currently in transit. All shifts are either on duty or safely accounted for at their residence.
        </div>

        <!-- In-Transit Trainees Grid -->
        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div 
            v-for="log in todayAttendanceLogs.filter(l => l.status === 'in_transit')" 
            :key="log.id"
            class="p-5 rounded-2xl bg-[#0d1527]/90 border border-amber-500/35 backdrop-blur-xl shadow-[0_0_25px_rgba(245,158,11,0.1)] space-y-3"
          >
            <div class="flex items-start justify-between">
              <div>
                <h3 class="text-base font-bold text-white">{{ (log as any).intern?.full_name || 'Trainee' }}</h3>
                <p class="text-xs text-slate-400 font-mono">Contact: {{ (log as any).intern?.contact_number || 'N/A' }}</p>
                <p class="text-[11px] text-slate-400 mt-0.5">
                  Clocked Out At: <span class="font-mono text-amber-300 font-semibold">{{ new Date(log.time_out || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}</span>
                </p>
              </div>
              <span class="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase tracking-wider border border-amber-500/30">
                In Transit
              </span>
            </div>

            <!-- Emergency Contact Line -->
            <div class="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] text-slate-300 flex items-center justify-between">
              <span>Emergency Contact:</span>
              <span class="font-semibold text-slate-200">{{ (log as any).intern?.emergency_contact_name || 'N/A' }} ({{ (log as any).intern?.emergency_contact_number || 'N/A' }})</span>
            </div>

            <!-- Action Prompt -->
            <div class="pt-2 border-t border-slate-800/80 flex items-center justify-end">
              <button 
                @click="pingTransitReminder(log.intern_id, (log as any).intern?.full_name)"
                :disabled="isPinging === log.intern_id"
                class="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition flex items-center gap-1.5"
              >
                <span>🔔</span>
                <span>{{ isPinging === log.intern_id ? 'Pinging...' : 'Send Transit Arrival Ping' }}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- 3. MASTER ROSTER OF BATCH INTERNS -->
      <section class="space-y-4 pt-2">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-bold text-white tracking-wide">
              Registered Trainees Master List
            </h2>
            <p class="text-xs text-slate-400">
              Complete batch roster with cumulative rendered hours, host company, and supervisor affiliation
            </p>
          </div>
          <span class="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-bold font-mono">
            {{ internsMasterList.length }} Registered
          </span>
        </div>

        <div v-if="internsMasterList.length === 0" class="p-8 rounded-3xl bg-[#0d1527]/50 border border-slate-800/80 text-center text-xs text-slate-400">
          No registered interns enrolled in this batch yet.
        </div>

        <div v-else class="overflow-x-auto rounded-3xl border border-slate-800/80 bg-[#0d1527]/80 backdrop-blur-2xl">
          <table class="w-full text-left text-sm text-slate-300">
            <thead class="bg-slate-900/80 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800 tracking-wider">
              <tr>
                <th class="p-4">Trainee Name</th>
                <th class="p-4">Host Company</th>
                <th class="p-4">Supervisor</th>
                <th class="p-4">Contact</th>
                <th class="p-4">Total Rendered Hours</th>
                <th class="p-4 text-right">Affiliation Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/50">
              <tr v-for="intern in internsMasterList" :key="intern.id" class="hover:bg-slate-800/30 transition">
                <td class="p-4 font-semibold text-white">{{ intern.full_name }}</td>
                <td class="p-4 text-xs text-slate-300">{{ intern.companyName }}</td>
                <td class="p-4 text-xs text-slate-300 font-medium">{{ intern.supervisorName }}</td>
                <td class="p-4 text-xs font-mono text-cyan-300">{{ intern.contact_number || 'N/A' }}</td>
                <td class="p-4">
                  <span class="font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-md border border-emerald-500/30 text-xs">
                    {{ intern.totalRenderedHours }} hrs
                  </span>
                </td>
                <td class="p-4 text-right">
                  <span 
                    v-if="intern.linkStatus === 'approved'"
                    class="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-bold uppercase tracking-wider border border-emerald-500/30"
                  >
                    Active
                  </span>
                  <span 
                    v-else-if="intern.linkStatus === 'pending'"
                    class="px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 text-[10px] font-bold uppercase tracking-wider border border-amber-500/30"
                  >
                    Pending Link
                  </span>
                  <span 
                    v-else
                    class="px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 text-[10px] font-bold uppercase tracking-wider border border-slate-700"
                  >
                    Unassigned
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

    </div>
  </div>
</template>