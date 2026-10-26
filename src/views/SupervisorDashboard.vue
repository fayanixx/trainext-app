<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import { useAccomplishmentsStore } from '@/stores/accomplishments';
import type { CompanySite } from '@/types';
import OfficeGeofenceModal from '@/components/OfficeGeofenceModal.vue';
import ProofViewerModal from '@/components/ProofViewerModal.vue';

const router = useRouter();
const authStore = useAuthStore();
const accomplishmentsStore = useAccomplishmentsStore();

// Dashboard State
const loading = ref(true);
const companySite = ref<CompanySite | null>(null);
const pendingRequests = ref<any[]>([]);
const approvedInterns = ref<any[]>([]);

// Modals & Action States
const isGeofenceModalOpen = ref(false);
const isDeclineInternModalOpen = ref(false);
const selectedRequestId = ref<string | null>(null);
const internDeclineReason = ref('');
const actionLoading = ref(false);
const statusBanner = ref<{ type: 'success' | 'error'; message: string } | null>(null);

// Accomplishments Review & Batch States
const selectedAccomplishmentIds = ref<string[]>([]);
const isReviewModalOpen = ref(false);
const reviewTargetLog = ref<any | null>(null);
const reviewDecision = ref<'approved' | 'rejected'>('approved');
const reviewFeedback = ref('');

// Media Inspector Lightbox States
const isProofViewerOpen = ref(false);
const activeProofUrl = ref<string | null>(null);
const activeProofType = ref<'image' | 'document' | 'video' | null>(null);
const activeProofTitle = ref('');

// Filter pending accomplishment logs
const pendingAccomplishments = computed(() => {
  return accomplishmentsStore.supervisorPendingLogs.filter((log) => log.status === 'pending');
});

const isAllSelected = computed(() => {
  return (
    pendingAccomplishments.value.length > 0 &&
    selectedAccomplishmentIds.value.length === pendingAccomplishments.value.length
  );
});

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedAccomplishmentIds.value = [];
  } else {
    selectedAccomplishmentIds.value = pendingAccomplishments.value.map((log) => log.id);
  }
};

// Fetch Supervisor's Company Office Geofence
const fetchCompanySite = async () => {
  if (!authStore.user?.id) return;
  try {
    const { data, error } = await supabase
      .from('company_sites')
      .select('*')
      .eq('supervisor_id', authStore.user.id)
      .maybeSingle();

    if (error) throw error;
    companySite.value = (data as CompanySite) || null;
  } catch (err: any) {
    console.error('Failed to fetch company site:', err.message);
  }
};

// Fetch Trainee Affiliation Link Requests (Pending & Approved)
const fetchInternLinks = async () => {
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
        created_at,
        intern:profiles!intern_supervisor_links_intern_id_fkey (
          id,
          full_name,
          contact_number,
          home_address,
          emergency_contact_name,
          emergency_contact_number
        )
      `)
      .eq('supervisor_id', authStore.user.id);

    if (error) throw error;

    const list = data || [];
    pendingRequests.value = list.filter((item: any) => item.status === 'pending');
    approvedInterns.value = list.filter((item: any) => item.status === 'approved');
  } catch (err: any) {
    console.error('Failed to load intern links:', err.message);
  } finally {
    loading.value = false;
  }
};

// Accept Intern and Grant Office Geofence Access
const handleAcceptIntern = async (linkId: string, internName: string) => {
  if (!companySite.value) {
    statusBanner.value = {
      type: 'error',
      message: 'Please setup your company office geofence first before accepting trainees.',
    };
    return;
  }

  actionLoading.value = true;
  statusBanner.value = null;

  try {
    const { error } = await supabase
      .from('intern_supervisor_links')
      .update({
        status: 'approved',
        linked_at: new Date().toISOString(),
      })
      .eq('id', linkId);

    if (error) throw error;

    statusBanner.value = {
      type: 'success',
      message: `Trainee ${internName} accepted successfully! Geofence access has been granted.`,
    };
    await fetchInternLinks();
  } catch (err: any) {
    statusBanner.value = {
      type: 'error',
      message: err.message || 'Failed to accept intern affiliation.',
    };
  } finally {
    actionLoading.value = false;
  }
};

// Prompt Decline Intern
const promptDeclineIntern = (linkId: string) => {
  selectedRequestId.value = linkId;
  internDeclineReason.value = '';
  isDeclineInternModalOpen.value = true;
};

const confirmDeclineIntern = async () => {
  if (!selectedRequestId.value) return;

  actionLoading.value = true;
  try {
    const { error } = await supabase
      .from('intern_supervisor_links')
      .update({
        status: 'rejected',
        rejection_reason: internDeclineReason.value.trim() || 'Declined by supervisor.',
      })
      .eq('id', selectedRequestId.value);

    if (error) throw error;

    isDeclineInternModalOpen.value = false;
    statusBanner.value = {
      type: 'success',
      message: 'Trainee affiliation request was declined.',
    };
    await fetchInternLinks();
  } catch (err: any) {
    statusBanner.value = {
      type: 'error',
      message: err.message || 'Failed to decline intern affiliation.',
    };
  } finally {
    actionLoading.value = false;
  }
};

// Open Review Modal for an Accomplishment
const openAccomplishmentReview = (log: any, decision: 'approved' | 'rejected') => {
  reviewTargetLog.value = log;
  reviewDecision.value = decision;
  reviewFeedback.value = '';
  isReviewModalOpen.value = true;
};

// Submit Single Review
const submitAccomplishmentReview = async () => {
  if (!reviewTargetLog.value) return;

  actionLoading.value = true;
  try {
    await accomplishmentsStore.reviewLog({
      logId: reviewTargetLog.value.id,
      status: reviewDecision.value,
      feedback: reviewFeedback.value,
    });

    isReviewModalOpen.value = false;
    statusBanner.value = {
      type: 'success',
      message: `Accomplishment record marked as ${reviewDecision.value}.`,
    };
  } catch (err: any) {
    statusBanner.value = {
      type: 'error',
      message: err.message || 'Failed to process accomplishment review.',
    };
  } finally {
    actionLoading.value = false;
  }
};

// Execute Batch Approval
const handleBatchApprove = async () => {
  if (!selectedAccomplishmentIds.value.length) return;

  actionLoading.value = true;
  try {
    await accomplishmentsStore.batchApproveLogs(selectedAccomplishmentIds.value);
    const count = selectedAccomplishmentIds.value.length;
    selectedAccomplishmentIds.value = [];
    statusBanner.value = {
      type: 'success',
      message: `Successfully batch-approved ${count} accomplishment report(s)!`,
    };
  } catch (err: any) {
    statusBanner.value = {
      type: 'error',
      message: err.message || 'Failed to execute batch approval.',
    };
  } finally {
    actionLoading.value = false;
  }
};

// Open Media Preview
const inspectProof = (url: string, type: 'image' | 'document' | 'video', title: string) => {
  activeProofUrl.value = url;
  activeProofType.value = type;
  activeProofTitle.value = title;
  isProofViewerOpen.value = true;
};

const getScreenshotTitle = (title: string, index: number) => {
  return `${title} - Screenshot ${index + 1}`;
};

onMounted(async () => {
  await authStore.fetchProfile();
  if (!authStore.isAuthenticated || !authStore.isSupervisor || !authStore.user) {
    router.push('/auth');
    return;
  }
  await Promise.all([
    fetchCompanySite(),
    fetchInternLinks(),
    accomplishmentsStore.fetchSupervisorLogs(authStore.user.id),
  ]);
});
</script>

<template>
  <div class="min-h-screen bg-[#0a0f1d] text-slate-100 p-4 sm:p-8 relative overflow-hidden select-none">
    <!-- Ambient Neon Cyberpunk Glow Backdrops -->
    <div class="absolute -top-40 -left-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none"></div>
    <div class="absolute top-1/2 -right-40 w-96 h-96 bg-fuchsia-500/10 rounded-full blur-[140px] pointer-events-none"></div>

    <div class="max-w-6xl mx-auto space-y-6 relative z-10">
      
      <!-- Top Dynamic Header Bar -->
      <header class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-[#0d1527]/80 border border-cyan-500/25 backdrop-blur-2xl shadow-[0_0_35px_rgba(6,182,212,0.12)]">
        <div>
          <div class="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/40 text-[10px] font-bold text-cyan-300 uppercase tracking-widest mb-1">
            <span class="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
            Supervisor Portal
          </div>
          <h1 class="text-xl sm:text-2xl font-black text-white tracking-wide">
            {{ companySite?.company_name || 'Company Management' }}
          </h1>
          <p class="text-xs text-slate-400">
            Supervisor: {{ authStore.user?.full_name }}
          </p>
        </div>

        <div class="flex items-center gap-3">
          <button 
            @click="isGeofenceModalOpen = true"
            class="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 text-white text-xs font-bold uppercase tracking-wider shadow-[0_0_20px_rgba(6,182,212,0.3)] transition"
          >
            {{ companySite ? 'Edit Geofence' : 'Setup Office Geofence' }}
          </button>
          <button 
            @click="authStore.signOut(); router.push('/auth');"
            class="px-4 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white transition"
          >
            Sign Out
          </button>
        </div>
      </header>

      <!-- Status Feedback Banner -->
      <div 
        v-if="statusBanner" 
        :class="statusBanner.type === 'success' ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300' : 'bg-red-950/60 border-red-500/40 text-red-300'"
        class="p-4 rounded-2xl border text-xs font-medium flex items-center justify-between"
      >
        <span>{{ statusBanner.message }}</span>
        <button @click="statusBanner = null" class="text-xs text-slate-400 hover:text-white font-bold ml-4">✕</button>
      </div>

      <!-- SECTION 1: COMPANY GEOFENCE STATUS SUMMARY -->
      <section class="p-6 rounded-3xl bg-[#0d1527]/85 border border-cyan-500/25 backdrop-blur-2xl shadow-[0_0_35px_rgba(6,182,212,0.12)]">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="space-y-1">
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Designated Office Perimeter
            </span>
            <h2 class="text-lg font-bold text-white">
              {{ companySite?.company_name || 'No Company Geofence Configured Yet' }}
            </h2>
            <p class="text-xs text-slate-300">
              {{ companySite?.office_address || 'Configure office location so trainees can request affiliation and log attendance.' }}
            </p>
          </div>

          <div v-if="companySite" class="flex items-center gap-4 text-xs font-mono">
            <div class="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
              <span class="text-[10px] text-slate-400 uppercase block font-sans">Radius</span>
              <span class="text-cyan-400 font-bold">{{ companySite.radius_meters }}m</span>
            </div>
            <div class="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
              <span class="text-[10px] text-slate-400 uppercase block font-sans">Coordinates</span>
              <span class="text-cyan-400 font-bold">{{ companySite.latitude.toFixed(4) }}, {{ companySite.longitude.toFixed(4) }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- SECTION 2: ACCOMPLISHMENT VERIFICATION & BATCH APPROVAL QUEUE -->
      <section class="space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-bold text-white tracking-wide flex items-center gap-2">
              <span>Accomplishment Verification Queue</span>
              <span class="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-mono font-bold">
                {{ pendingAccomplishments.length }} Pending
              </span>
            </h2>
            <p class="text-xs text-slate-400">
              Inspect submitted proofs and approve or request revision for intern task accomplishment logs
            </p>
          </div>

          <!-- Batch Action Controls -->
          <div v-if="pendingAccomplishments.length > 0" class="flex items-center gap-2 self-start sm:self-auto">
            <button 
              @click="toggleSelectAll"
              class="px-3.5 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white transition"
            >
              {{ isAllSelected ? 'Deselect All' : 'Select All' }}
            </button>
            <button 
              @click="handleBatchApprove"
              :disabled="selectedAccomplishmentIds.length === 0 || actionLoading"
              class="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-40 transition flex items-center gap-1.5"
            >
              <span>✓</span>
              <span>Batch Approve ({{ selectedAccomplishmentIds.length }})</span>
            </button>
          </div>
        </div>

        <!-- Empty State -->
        <div v-if="pendingAccomplishments.length === 0" class="p-8 rounded-3xl bg-[#0d1527]/50 border border-slate-800/80 text-center text-xs text-slate-400">
          No pending accomplishment logs requiring review at this time.
        </div>

        <!-- Accomplishment Cards List -->
        <div v-else class="space-y-3">
          <div 
            v-for="log in pendingAccomplishments" 
            :key="log.id"
            class="p-5 rounded-2xl bg-[#0d1527]/90 border border-cyan-500/25 backdrop-blur-xl shadow-lg space-y-3"
          >
            <!-- Card Header -->
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-start gap-3">
                <input 
                  type="checkbox" 
                  :value="log.id" 
                  v-model="selectedAccomplishmentIds"
                  class="w-4 h-4 mt-1 rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-cyan-400"
                />
                <div>
                  <h3 class="text-base font-bold text-white">{{ log.title }}</h3>
                  <div class="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                    <span class="text-cyan-300 font-semibold">{{ log.intern?.full_name || 'Trainee' }}</span>
                    <span>•</span>
                    <span>Date: <strong class="text-slate-300 font-mono">{{ log.report_date }}</strong></span>
                    <span>•</span>
                    <span>Rendered: <strong class="text-emerald-400 font-mono">{{ log.rendered_hours }} hrs</strong></span>
                  </div>
                </div>
              </div>

              <!-- Quick Action Buttons -->
              <div class="flex items-center gap-2">
                <button 
                  @click="openAccomplishmentReview(log, 'rejected')"
                  class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-rose-400 hover:text-rose-300 border border-slate-700 transition"
                >
                  Request Revision
                </button>
                <button 
                  @click="openAccomplishmentReview(log, 'approved')"
                  class="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 text-slate-950 font-bold text-xs uppercase shadow transition"
                >
                  Approve
                </button>
              </div>
            </div>

            <!-- Task Description -->
            <p class="text-xs text-slate-300 leading-relaxed pl-7">
              {{ log.description }}
            </p>

            <!-- Multi-Proof Attachments Row -->
            <div class="pl-7 pt-2 border-t border-slate-800/60 flex flex-wrap items-center gap-3">
              <!-- Images Preview Thumbnails -->
              <div v-if="log.proof_images && log.proof_images.length > 0" class="flex items-center gap-1.5">
                <span class="text-[10px] font-bold uppercase text-slate-500 mr-1">Images:</span>
                <button 
                  v-for="img in log.proof_images" 
                  :key="img"
                  @click="inspectProof(img, 'image', log.title)"
                  class="w-8 h-8 rounded-lg overflow-hidden border border-cyan-500/30 hover:border-cyan-400 transition transform hover:scale-105 bg-slate-900"
                >
                  <img :src="img" alt="Proof" class="w-full h-full object-cover" />
                </button>
              </div>

              <!-- Documents Chips -->
              <div v-if="log.proof_documents && log.proof_documents.length > 0" class="flex items-center gap-1.5">
                <span class="text-[10px] font-bold uppercase text-slate-500 mr-1">Docs:</span>
                <button 
                  v-for="(doc, idx) in log.proof_documents" 
                  :key="idx"
                  @click="inspectProof(doc, 'document', `${log.title} - Document`)"
                  class="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] text-cyan-300 flex items-center gap-1"
                >
                  <span>📄</span>
                  <span class="truncate max-w-[100px]">{{ doc.split('/').pop() }}</span>
                </button>
              </div>

              <!-- Video Link -->
              <div v-if="log.video_url" class="flex items-center gap-1.5">
                <span class="text-[10px] font-bold uppercase text-slate-500 mr-1">Video:</span>
                <button 
                  @click="inspectProof(log.video_url, 'video', `${log.title} - Video Walkthrough`)"
                  class="px-2.5 py-0.5 rounded-md bg-fuchsia-950/40 hover:bg-fuchsia-900/60 border border-fuchsia-500/40 text-[11px] font-semibold text-fuchsia-300 flex items-center gap-1"
                >
                  <span>▶</span>
                  <span>Play Walkthrough</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- SECTION 3: PENDING INTERN LINK REQUESTS -->
      <section class="space-y-4 pt-2">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-bold text-white tracking-wide">
              Pending Trainee Affiliation Requests
            </h2>
            <p class="text-xs text-slate-400">
              Review and authorize newly registered interns requesting access to your company
            </p>
          </div>
          <span class="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-bold font-mono">
            {{ pendingRequests.length }} Pending
          </span>
        </div>

        <!-- Empty State -->
        <div v-if="pendingRequests.length === 0" class="p-8 rounded-3xl bg-[#0d1527]/50 border border-slate-800/80 text-center text-xs text-slate-400">
          No pending trainee requests at this time.
        </div>

        <!-- Requests Grid -->
        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div 
            v-for="req in pendingRequests" 
            :key="req.id"
            class="p-5 rounded-2xl bg-[#0d1527]/90 border border-cyan-500/30 backdrop-blur-xl shadow-lg space-y-4"
          >
            <div class="flex items-start justify-between">
              <div>
                <h3 class="text-base font-bold text-white">{{ req.intern?.full_name || 'Trainee' }}</h3>
                <p class="text-xs text-slate-400">Contact: {{ req.intern?.contact_number || 'N/A' }}</p>
                <p class="text-[10px] text-slate-500 mt-0.5">Requested on: {{ new Date(req.created_at).toLocaleDateString() }}</p>
              </div>
              <span class="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase tracking-wider border border-amber-500/30">
                Pending
              </span>
            </div>

            <div class="flex items-center gap-2 pt-2 border-t border-slate-800/80">
              <button 
                @click="promptDeclineIntern(req.id)"
                :disabled="actionLoading"
                class="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-rose-400 hover:text-rose-300 border border-slate-700 transition"
              >
                Decline
              </button>
              <button 
                @click="handleAcceptIntern(req.id, req.intern?.full_name)"
                :disabled="actionLoading"
                class="flex-1 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 text-white text-xs font-bold uppercase tracking-wider shadow-md transition"
              >
                Accept Intern
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- SECTION 4: ACTIVE ASSIGNED INTERNS -->
      <section class="space-y-4 pt-2">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-bold text-white tracking-wide">
              Active Authorized Trainees
            </h2>
            <p class="text-xs text-slate-400">
              Trainees currently equipped with active office geofence access
            </p>
          </div>
          <span class="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold font-mono">
            {{ approvedInterns.length }} Active
          </span>
        </div>

        <div v-if="approvedInterns.length === 0" class="p-8 rounded-3xl bg-[#0d1527]/50 border border-slate-800/80 text-center text-xs text-slate-400">
          No authorized trainees attached to this company site yet.
        </div>

        <div v-else class="overflow-x-auto rounded-3xl border border-slate-800/80 bg-[#0d1527]/80 backdrop-blur-2xl">
          <table class="w-full text-left text-sm text-slate-300">
            <thead class="bg-slate-900/80 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800 tracking-wider">
              <tr>
                <th class="p-4">Trainee Name</th>
                <th class="p-4">Contact</th>
                <th class="p-4">Emergency Contact</th>
                <th class="p-4">Affiliated Since</th>
                <th class="p-4 text-right">Geofence Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/50">
              <tr v-for="item in approvedInterns" :key="item.id" class="hover:bg-slate-800/30 transition">
                <td class="p-4 font-semibold text-white">{{ item.intern?.full_name }}</td>
                <td class="p-4 text-xs font-mono text-cyan-300">{{ item.intern?.contact_number || 'N/A' }}</td>
                <td class="p-4 text-xs">
                  <div>{{ item.intern?.emergency_contact_name || 'N/A' }}</div>
                  <div class="text-[10px] text-slate-500 font-mono">{{ item.intern?.emergency_contact_number || '' }}</div>
                </td>
                <td class="p-4 text-xs text-slate-400">
                  {{ item.linked_at ? new Date(item.linked_at).toLocaleDateString() : 'N/A' }}
                </td>
                <td class="p-4 text-right">
                  <span class="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-bold uppercase tracking-wider border border-emerald-500/30">
                    Active
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

    </div>

    <!-- OFFICE GEOFENCE MODAL -->
    <OfficeGeofenceModal 
      :is-open="isGeofenceModalOpen"
      :supervisor-id="authStore.user?.id || ''"
      :initial-data="companySite"
      @close="isGeofenceModalOpen = false"
      @saved="(site) => { companySite = site; isGeofenceModalOpen = false; }"
    />

    <!-- PROOF VIEWER / LIGHTBOX MODAL -->
    <ProofViewerModal 
      :is-open="isProofViewerOpen"
      :media-url="activeProofUrl"
      :media-type="activeProofType"
      :title="activeProofTitle"
      @close="isProofViewerOpen = false"
    />

    <!-- ACCOMPLISHMENT REVIEW & FEEDBACK DIALOG -->
    <Transition name="fade">
      <div v-if="isReviewModalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md">
        <div class="relative w-full max-w-md p-6 bg-[#0d1527]/95 border border-cyan-500/40 rounded-3xl shadow-[0_0_40px_rgba(6,182,212,0.25)] text-slate-100 backdrop-blur-2xl space-y-4">
          <div class="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 class="text-base font-bold text-white tracking-wide">
              {{ reviewDecision === 'approved' ? 'Approve Accomplishment' : 'Request Task Revision' }}
            </h3>
            <button @click="isReviewModalOpen = false" class="text-slate-400 hover:text-white text-sm">✕</button>
          </div>

          <div class="text-xs text-slate-300 space-y-1">
            <p>Task: <strong class="text-white">{{ reviewTargetLog?.title }}</strong></p>
            <p>Trainee: <strong class="text-cyan-300">{{ reviewTargetLog?.intern?.full_name }}</strong></p>
          </div>

          <div class="space-y-1.5">
            <label class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {{ reviewDecision === 'approved' ? 'Commendation or Note (Optional)' : 'Correction / Revision Notes (Required)' }}
            </label>
            <textarea 
              v-model="reviewFeedback" 
              rows="3"
              :placeholder="reviewDecision === 'approved' ? 'Great execution on the assigned task.' : 'Specify what needs revision or which files are missing...'"
              class="w-full px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-100 text-xs focus:border-cyan-400 outline-none"
            ></textarea>
          </div>

          <div class="pt-2 flex justify-end gap-2">
            <button 
              @click="isReviewModalOpen = false"
              class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button 
              @click="submitAccomplishmentReview"
              :disabled="actionLoading || (reviewDecision === 'rejected' && !reviewFeedback.trim())"
              :class="reviewDecision === 'approved' ? 'bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold' : 'bg-rose-600 hover:bg-rose-500 text-white font-bold'"
              class="px-5 py-2 rounded-xl text-xs uppercase tracking-wider shadow-md disabled:opacity-40 transition"
            >
              {{ actionLoading ? 'Submitting...' : (reviewDecision === 'approved' ? 'Confirm Approval' : 'Send Revision Request') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- DECLINE INTERN LINK GLASS DIALOG -->
    <Transition name="fade">
      <div v-if="isDeclineInternModalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md">
        <div class="relative w-full max-w-md p-6 bg-[#0d1527]/95 border border-red-500/40 rounded-3xl shadow-[0_0_40px_rgba(239,68,68,0.25)] text-slate-100 backdrop-blur-2xl space-y-4">
          <div class="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 class="text-base font-bold text-red-400 tracking-wide">Decline Affiliation Request</h3>
            <button @click="isDeclineInternModalOpen = false" class="text-slate-400 hover:text-white text-sm">✕</button>
          </div>

          <p class="text-xs text-slate-300 leading-relaxed">
            Are you sure you want to decline this trainee? Provide a reason for the trainee's reference:
          </p>

          <textarea 
            v-model="internDeclineReason" 
            rows="3"
            placeholder="e.g., Slots full or wrong company chosen"
            class="w-full px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-100 text-xs focus:border-red-400 outline-none"
          ></textarea>

          <div class="pt-2 flex justify-end gap-2">
            <button 
              @click="isDeclineInternModalOpen = false"
              class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button 
              @click="confirmDeclineIntern"
              :disabled="actionLoading"
              class="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase shadow-md disabled:opacity-50 transition"
            >
              {{ actionLoading ? 'Declining...' : 'Confirm Decline' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>