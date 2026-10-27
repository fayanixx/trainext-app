<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useAccomplishmentsStore } from '@/stores/accomplishments';
import { sendStatusEmail } from '@/lib/email';
import type { CompanySite } from '@/types';
import OfficeGeofenceModal from '@/components/OfficeGeofenceModal.vue';
import ProofViewerModal from '@/components/ProofViewerModal.vue';
import ProfileSettingsModal from '@/components/ProfileSettingsModal.vue';

let supervisorRealtimeChannel: any = null;
const router = useRouter();
const authStore = useAuthStore();
const accomplishmentsStore = useAccomplishmentsStore();

// Modals State
const isProfileSettingsOpen = ref(false);
const isGeofenceModalOpen = ref(false);
const isProofViewerOpen = ref(false);
const showSignOutConfirm = ref(false);
const isSigningOut = ref(false);

const activeProofUrl = ref<string | null>(null);
const activeProofType = ref<'image' | 'document' | 'video' | null>(null);
const activeProofTitle = ref('');

// Data State
const site = ref<CompanySite | null>(null);
const loadingSite = ref(true);
const pendingInterns = ref<any[]>([]);
const approvedInterns = ref<any[]>([]);
const reviewFeedback = ref<Record<string, string>>({});
const selectedBatchIds = ref<string[]>([]);
const isBatchProcessing = ref(false);

// Active Tab Filter for Accomplishments
const activeFilter = ref<'all' | 'pending' | 'approved' | 'rejected'>('all');

// Computed Logs & Counts directly from store's logs
const allLogs = computed(() => accomplishmentsStore.logs || []);

const pendingReviewLogs = computed(() => {
  return allLogs.value.filter((l: any) => l.status === 'pending');
});

const pendingCount = computed(() => pendingReviewLogs.value.length);

const filteredLogs = computed(() => {
  if (activeFilter.value === 'all') return allLogs.value;
  return allLogs.value.filter((l: any) => l.status === activeFilter.value);
});

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
  } catch (err: any) {
    alert(`Failed to update intern status: ${err.message}`);
  }
};

// Accomplishment Review Actions na may Kasamang Email Alert
const handleReview = async (logId: string, status: 'approved' | 'rejected') => {
  const feedback = reviewFeedback.value[logId] || '';
  const targetLog: any = allLogs.value.find((l: any) => l.id === logId);

  try {
    if (typeof (accomplishmentsStore as any).reviewLog === 'function') {
      try {
        await (accomplishmentsStore as any).reviewLog({ logId, status, feedback });
      } catch {
        await (accomplishmentsStore as any).reviewLog(logId, status, feedback);
      }
    }

    // Dispatch EmailJS Notification sa Intern
    const internEmail = targetLog?.intern?.email || targetLog?.intern_email;
    if (internEmail) {
      await sendStatusEmail({
        toEmail: internEmail,
        toName: targetLog?.intern?.full_name || 'Trainee',
        status: status,
        feedback: feedback,
        reportTitle: targetLog?.title || 'Daily Accomplishment Report',
      });
    }

    reviewFeedback.value[logId] = '';
    if (authStore.user?.id) {
      await accomplishmentsStore.fetchSupervisorLogs(authStore.user.id);
    }
  } catch (err: any) {
    alert(`Review failed: ${err.message}`);
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
  try {
    const logsToApprove: any[] = allLogs.value.filter((l: any) => selectedBatchIds.value.includes(l.id));

    if (typeof (accomplishmentsStore as any).batchApproveLogs === 'function') {
      await (accomplishmentsStore as any).batchApproveLogs(selectedBatchIds.value);
    } else if (typeof (accomplishmentsStore as any).batchApprove === 'function') {
      await (accomplishmentsStore as any).batchApprove(selectedBatchIds.value);
    }

    // Magpadala ng notification sa bawat approved intern
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
  } catch (err: any) {
    alert(`Batch approval error: ${err.message}`);
  } finally {
    isBatchProcessing.value = false;
  }
};

// Sign Out Handler
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
  await authStore.fetchProfile();
  if (!authStore.isAuthenticated || !authStore.isSupervisor || !authStore.user) {
    router.push('/auth');
    return;
  }
  await loadAllData();

  if (authStore.user?.id) {
    supervisorRealtimeChannel = supabase
      .channel(`supervisor-live-${authStore.user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'accomplishment_reports',
        },
        async () => {
          if (authStore.user?.id) {
            await accomplishmentsStore.fetchSupervisorLogs(authStore.user.id);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'intern_supervisor_links',
          filter: `supervisor_id=eq.${authStore.user.id}`,
        },
        async () => {
          await fetchInterns();
        }
      )
      .subscribe();
  }
});

onUnmounted(() => {
  if (supervisorRealtimeChannel) {
    supabase.removeChannel(supervisorRealtimeChannel);
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
            <span class="trainext-badge-role">Supervisor Control</span>
            <h1 class="trainext-heading-name">{{ authStore.user?.full_name || 'Supervisor' }}</h1>
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

          <!-- SIGN OUT BUTTON WITH CONFIRMATION TRIGGER -->
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

      <!-- GEOFENCE OFFICE SITE MANAGEMENT CARD -->
      <section class="trainext-glass-card flex flex-col gap-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 class="trainext-title">Office Site Geofence Perimeter</h2>
            <p class="trainext-subtitle text-[11px]">Specify your company location and radius for automatic GPS intern check-ins.</p>
          </div>

          <button 
            type="button" 
            @click="isGeofenceModalOpen = true"
            class="trainext-btn-pill-primary h-[38px] px-4 text-[11px] self-start sm:self-auto"
          >
            {{ site ? 'EDIT PERIMETER' : '+ CONFIGURE SITE' }}
          </button>
        </div>

        <div v-if="loadingSite" class="p-6 text-center text-xs text-[#858994]">
          Loading company site configuration...
        </div>

        <div v-else-if="site" class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div class="p-3 rounded-2xl bg-white/[0.02] border border-white/10 flex flex-col gap-1">
            <span class="trainext-label">COMPANY NAME</span>
            <span class="text-xs font-bold text-white">{{ site.company_name }}</span>
          </div>
          <div class="p-3 rounded-2xl bg-white/[0.02] border border-white/10 flex flex-col gap-1 sm:col-span-2">
            <span class="trainext-label">ADDRESS & PERIMETER</span>
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs text-slate-300 truncate">{{ site.office_address }}</span>
              <span class="trainext-chip chip-cyan shrink-0">{{ site.radius_meters }}m Radius</span>
            </div>
          </div>
        </div>

        <div v-else class="p-6 rounded-2xl border border-dashed border-white/20 text-center flex flex-col items-center gap-2">
          <p class="text-xs text-[#858994]">No office geofence configured yet. Interns will not be able to clock in until configured.</p>
        </div>
      </section>

      <!-- PENDING INTERN LINK REQUESTS -->
      <section v-if="pendingInterns.length > 0" class="trainext-glass-card flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="trainext-title text-base">Pending Intern Requests</h2>
            <p class="trainext-subtitle text-[11px]">Trainees requesting affiliation with your company.</p>
          </div>
          <span class="trainext-chip chip-amber">{{ pendingInterns.length }} Pending</span>
        </div>

        <div class="flex flex-col gap-2 pt-1">
          <div 
            v-for="link in pendingInterns" 
            :key="link.id"
            class="p-3.5 rounded-2xl bg-white/[0.02] border border-white/10 flex flex-wrap items-center justify-between gap-3"
          >
            <div>
              <h3 class="text-xs font-bold text-white">{{ link.intern?.full_name || 'Trainee' }}</h3>
              <p class="text-[11px] text-[#858994]">{{ link.intern?.email }}</p>
            </div>

            <div class="flex items-center gap-2">
              <button 
                type="button" 
                @click="respondToIntern(link.id, 'approved')"
                class="px-3.5 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold hover:bg-emerald-500/30 transition cursor-pointer"
              >
                Accept
              </button>
              <button 
                type="button" 
                @click="respondToIntern(link.id, 'rejected')"
                class="px-3.5 py-1.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-bold hover:bg-red-500/30 transition cursor-pointer"
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- METRICS ROW -->
      <section class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="trainext-glass-card flex flex-col justify-between gap-2">
          <span class="trainext-label">APPROVED TRAINEES</span>
          <div class="flex items-baseline gap-2">
            <span class="text-3xl font-bold text-white">{{ approvedInterns.length }}</span>
            <span class="text-xs text-[#858994]">interns under supervision</span>
          </div>
        </div>

        <div class="trainext-glass-card flex flex-col justify-between gap-2">
          <span class="trainext-label">PENDING REVIEWS</span>
          <div class="flex items-baseline gap-2">
            <span class="text-3xl font-bold text-[#00d9ff]">{{ pendingCount }}</span>
            <span class="text-xs text-[#858994]">reports awaiting feedback</span>
          </div>
        </div>
      </section>

      <!-- ACCOMPLISHMENTS VERIFICATION & BATCH APPROVAL -->
      <section class="trainext-glass-card flex flex-col gap-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 class="trainext-title">Trainee Accomplishment Reports</h2>
            <p class="trainext-subtitle text-[11px]">Audit daily work submissions, media proofs, and hours rendered.</p>
          </div>

          <!-- Batch Action Button -->
          <div v-if="pendingReviewLogs.length > 0" class="flex items-center gap-2 w-full sm:w-auto">
            <button 
              type="button" 
              @click="toggleSelectAll"
              class="flex-1 sm:flex-none px-3 py-1.5 rounded-full border border-white/20 text-[10px] text-slate-300 hover:text-white transition cursor-pointer"
            >
              {{ selectedBatchIds.length === pendingReviewLogs.length ? 'Deselect All' : 'Select All Pending' }}
            </button>
            <button 
              type="button" 
              @click="handleBatchApprove"
              :disabled="selectedBatchIds.length === 0 || isBatchProcessing"
              class="flex-1 sm:flex-none trainext-btn-pill-primary h-[34px] px-3.5 text-[10.5px]"
            >
              {{ isBatchProcessing ? 'APPROVING...' : `APPROVE (${selectedBatchIds.length})` }}
            </button>
          </div>
        </div>

        <!-- Filter Tabs -->
        <div class="flex items-center gap-2 pt-1 border-b border-white/10 pb-2 overflow-x-auto">
          <button 
            v-for="tab in (['all', 'pending', 'approved', 'rejected'] as const)"
            :key="tab"
            type="button"
            @click="activeFilter = tab"
            class="px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider transition cursor-pointer shrink-0"
            :class="activeFilter === tab ? 'bg-cyan-500/20 text-[#00d9ff] border border-cyan-500/50' : 'text-[#858994] hover:text-white'"
          >
            {{ tab }}
          </button>
        </div>

        <!-- Empty Feed -->
        <div v-if="filteredLogs.length === 0" class="p-8 text-center text-xs text-[#858994]">
          No reports found under '{{ activeFilter }}' filter.
        </div>

        <!-- Reports List -->
        <div v-else class="flex flex-col gap-3">
          <div 
            v-for="log in filteredLogs" 
            :key="log.id"
            class="p-4 rounded-2xl bg-white/[0.02] border border-white/10 flex flex-col gap-3"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-start gap-3">
                <input 
                  v-if="log.status === 'pending'"
                  type="checkbox" 
                  :value="log.id"
                  v-model="selectedBatchIds"
                  class="mt-1 accent-[#00d9ff] cursor-pointer"
                />
                <div>
                  <h3 class="text-sm font-bold text-white">{{ log.title }}</h3>
                  <div class="flex flex-wrap items-center gap-2 text-[10.5px] text-[#858994] mt-0.5">
                    <span class="text-white font-medium">{{ log.intern?.full_name || 'Intern' }}</span>
                    <span>•</span>
                    <span class="font-mono">{{ log.report_date }}</span>
                    <span>•</span>
                    <span class="text-[#00d9ff] font-semibold">{{ log.rendered_hours }} hrs rendered</span>
                  </div>
                </div>
              </div>

              <span 
                class="trainext-chip shrink-0"
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

            <!-- Proof Attachments Strip -->
            <div class="flex flex-wrap items-center gap-3 pt-1 text-xs">
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

            <!-- Single Item Review Actions -->
            <div v-if="log.status === 'pending'" class="flex flex-col gap-2 pt-2 border-t border-white/10">
              <input 
                v-model="reviewFeedback[log.id]"
                type="text" 
                placeholder="Optional correction remarks or feedback..."
                class="w-full h-8 px-3 rounded-lg bg-black/40 border border-white/15 text-xs text-white placeholder:text-[#858994] outline-none focus:border-[#00d9ff]"
              />
              <div class="flex flex-col sm:flex-row sm:justify-end gap-2">
                <button 
                  type="button"
                  @click="handleReview(log.id, 'rejected')"
                  class="w-full sm:w-auto px-4 py-1.5 rounded-full border border-red-500/40 text-red-300 text-xs font-semibold hover:bg-red-500/20 transition cursor-pointer text-center"
                >
                  Reject
                </button>
                <button 
                  type="button"
                  @click="handleReview(log.id, 'approved')"
                  class="w-full sm:w-auto trainext-btn-pill-primary h-8 sm:h-7 px-5 text-xs"
                >
                  Approve
                </button>
              </div>
            </div>

            <!-- Existing Feedback Display -->
            <div v-else-if="(log as any).feedback" class="p-2.5 rounded-xl bg-white/[0.02] border border-white/10 text-xs text-slate-300">
              <span class="text-[8px] font-bold uppercase tracking-wider text-[#858994] block mb-0.5">FEEDBACK PROVIDED:</span>
              <p>{{ (log as any).feedback }}</p>
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