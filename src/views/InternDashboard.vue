  <script setup lang="ts">
  import { ref, onMounted, computed } from 'vue';
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

  const router = useRouter();
  const authStore = useAuthStore();
  const attendanceStore = useAttendanceStore();
  const accomplishmentsStore = useAccomplishmentsStore();

  // UI Modals
  const isProfileSettingsOpen = ref(false);
  const isAccomplishmentModalOpen = ref(false);
  const isSafeAtBaseModalOpen = ref(false);
  const isProofViewerOpen = ref(false);
  const activeProofUrl = ref<string | null>(null);
  const activeProofType = ref<'image' | 'document' | 'video' | null>(null);
  const activeProofTitle = ref('');

  // State
  const supervisorSite = ref<CompanySite | null>(null);
  const internLinkStatus = ref<'none' | 'pending' | 'approved' | 'rejected'>('none');
  const selectedSupervisorId = ref<string | null>(null);
  const availableSupervisors = ref<any[]>([]);
  const linkingLoading = ref(false);
  const linkFeedback = ref<{ type: 'success' | 'error'; message: string } | null>(null);

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
  const requiredHours = 486;
  const renderedHours = computed(() => {
    return (attendanceStore.attendanceHistory || []).reduce(
      (acc, log) => acc + (Number(log.hours_rendered) || 0),
      0
    );
  });

  const progressPercentage = computed(() => {
    const pct = (renderedHours.value / requiredHours) * 100;
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

  // Load Intern's Supervisor Affiliation Status
  const fetchAffiliation = async () => {
    if (!authStore.user?.id) return;

    try {
      const { data: linkData, error: linkErr } = await supabase
        .from('intern_supervisor_links')
        .select('status, supervisor_id')
        .eq('intern_id', authStore.user.id)
        .maybeSingle();

      if (linkErr) throw linkErr;

      if (linkData) {
        internLinkStatus.value = linkData.status;
        if (linkData.status === 'approved' && linkData.supervisor_id) {
          const { data: siteData } = await supabase
            .from('company_sites')
            .select('*')
            .eq('supervisor_id', linkData.supervisor_id)
            .maybeSingle();

          supervisorSite.value = (siteData as CompanySite) || null;
        }
      } else {
        internLinkStatus.value = 'none';
        const { data: sups } = await supabase
          .from('profiles')
          .select(`
            id,
            full_name,
            company_sites (
              id,
              company_name,
              office_address
            )
          `)
          .eq('role', 'supervisor');

        availableSupervisors.value = sups || [];
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

  // Clock In / Clock Out Geofenced Action
  const handleAttendanceAction = async () => {
    if (!authStore.user?.id || !supervisorSite.value) return;

    try {
      if (currentStatus.value === 'on_duty') {
        if (typeof (attendanceStore as any).timeOut === 'function') {
          await (attendanceStore as any).timeOut();
        } else if (typeof (attendanceStore as any).clockOut === 'function') {
          await (attendanceStore as any).clockOut();
        }
      } else {
        const payload = {
          internId: authStore.user.id,
          supervisorId: supervisorSite.value.supervisor_id,
          officeLat: supervisorSite.value.latitude,
          officeLng: supervisorSite.value.longitude,
          allowedRadiusMeters: supervisorSite.value.radius_meters,
        };

        if (typeof (attendanceStore as any).timeIn === 'function') {
          await (attendanceStore as any).timeIn(payload);
        } else if (typeof (attendanceStore as any).clockIn === 'function') {
          await (attendanceStore as any).clockIn(payload);
        }
      }
    } catch (err: any) {
      if (err.name === 'GeofenceError' || err.details) {
        geofenceError.value = {
          isOpen: true,
          companyName: supervisorSite.value?.company_name || 'Designated Office',
          formattedDistance: `${Math.round(err.details?.distance || 0)}m`,
          allowedRadius: supervisorSite.value?.radius_meters || 100,
        };
      }
    }
  };

  // Inspect Attached Proof
  const inspectMedia = (url: string, type: 'image' | 'document' | 'video', title: string) => {
    activeProofUrl.value = url;
    activeProofType.value = type;
    activeProofTitle.value = title;
    isProofViewerOpen.value = true;
  };

  const refreshData = async () => {
    if (!authStore.user?.id) return;

    const loadHistory =
      (attendanceStore as any).fetchAttendanceHistory ||
      (attendanceStore as any).fetchInternLogs ||
      (attendanceStore as any).fetchHistory;

    await Promise.all([
      fetchAffiliation(),
      attendanceStore.fetchTodayShift(authStore.user.id),
      typeof loadHistory === 'function' ? loadHistory(authStore.user.id) : Promise.resolve(),
      accomplishmentsStore.fetchInternLogs(authStore.user.id),
    ]);
  };

  onMounted(async () => {
    await authStore.fetchProfile();
    if (!authStore.isAuthenticated || !authStore.isIntern || !authStore.user) {
      router.push('/auth');
      return;
    }
    await refreshData();
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

            <button 
              type="button" 
              @click="authStore.signOut(); router.push('/auth');"
              class="trainext-btn-signout"
            >
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Sign Out</span>
            </button>
          </div>
        </header>

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

          <div v-if="internLinkStatus === 'pending'" class="flex items-center gap-2.5 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
            <span class="w-2 h-2 rounded-full bg-[#00d9ff] animate-ping"></span>
            <p class="text-xs text-slate-200">Your request is currently awaiting supervisor verification and geofence activation.</p>
          </div>

          <div v-else-if="internLinkStatus === 'none'" class="flex flex-col gap-1.5 pt-1">
            <label class="trainext-label">SELECT SUPERVISOR</label>
            <div class="flex gap-2">
              <select v-model="selectedSupervisorId" class="trainext-select-glass flex-1">
                <option :value="null" disabled>Choose assigned company supervisor...</option>
                <option 
                  v-for="sup in availableSupervisors" 
                  :key="sup.id" 
                  :value="sup.id"
                >
                  {{ sup.full_name }} — {{ sup.company_sites?.[0]?.company_name || 'Direct Supervisor' }}
                </option>
              </select>
              <button 
                type="button" 
                @click="requestAffiliation"
                :disabled="!selectedSupervisorId || linkingLoading"
                class="trainext-btn-pill-primary px-5 text-xs"
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

          <div class="trainext-glass-card flex flex-col justify-between gap-2">
            <span class="trainext-label">OFFICE PERIMETER</span>
            <div>
              <h3 class="text-base font-bold text-white">{{ supervisorSite?.company_name || 'No Site Linked' }}</h3>
              <p class="text-xs text-[#858994] mt-1">{{ supervisorSite?.office_address || 'Geofence access pending supervisor approval' }}</p>
            </div>
            <div v-if="supervisorSite" class="flex items-center gap-1.5 text-[10px] font-semibold text-[#00d9ff] pt-1">
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="3" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 2v3m0 14v3m10-10h-3M5 12H2" />
              </svg>
              <span>Authorized Radius: {{ supervisorSite.radius_meters }}m</span>
            </div>
          </div>
        </section>

        <!-- MAIN ATTENDANCE & SAFETY ACTION PANEL -->
        <section class="trainext-glass-card flex flex-col gap-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span class="trainext-label">CURRENT SHIFT STATUS</span>
              <div class="mt-1.5">
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

            <button 
              type="button"
              v-if="currentStatus === 'in_transit'"
              @click="isSafeAtBaseModalOpen = true"
              class="h-[48px] px-6 rounded-full border border-[#00d9ff]/60 bg-[#00d9ff]/15 shadow-[0_0_15px_rgba(0,217,255,0.25)] text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer transition hover:bg-[#00d9ff]/25"
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

          <div v-if="accomplishmentsStore.logs.length === 0" class="p-8 text-center text-xs text-[#858994]">
            No task accomplishments recorded yet. Click '+ NEW REPORT' to submit your first daily log.
          </div>

          <div v-else class="flex flex-col gap-3">
            <div 
              v-for="log in accomplishmentsStore.logs" 
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

        <!-- FOOTER -->
        <footer class="trainext-footer-tagline">
          <span>Smart Tracking.</span>
          <span>Real-Time Safety.</span>
        </footer>
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