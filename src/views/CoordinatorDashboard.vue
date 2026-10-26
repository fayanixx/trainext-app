<template>
  <ion-page>
    <AppHeader subtitle="Coordinator dashboard" />

    <ion-content :fullscreen="true" class="dashboard-content" style="--background: transparent">
      <!-- Fixed Background Layer (Subway platform na may dark vignette) -->
      <div class="fixed inset-0 bg-[#020611] -z-10 overflow-hidden flex items-center justify-center pointer-events-none select-none">
        <img
          src="/assets/bg-placeholder.png"
          alt="Platform Background"
          class="w-full h-full object-cover object-center brightness-[0.70] contrast-[1.15]"
        />
        <div class="absolute inset-0 bg-gradient-to-b from-[#020611]/60 via-[#020611]/30 to-[#020611]/90"></div>
        <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,194,255,0.12)_0%,transparent_60%)]"></div>
      </div>

      <!-- Pull to Refresh -->
      <ion-refresher slot="fixed" @ionRefresh="handleRefresh">
        <ion-refresher-content />
      </ion-refresher>

      <!-- Main Responsive Container -->
      <div class="mx-auto max-w-6xl space-y-6 px-3.5 sm:px-6 py-6 font-aileron selection:bg-[#00C2FF] selection:text-black">
        
        <!-- Custom Cyber Segment Tabs -->
        <div class="trainext-glass-card p-1.5 flex items-center gap-1.5">
          <button
            type="button"
            class="tab-nav-btn"
            :class="activeTab === 'transit' ? 'tab-nav-btn-active' : ''"
            @click="activeTab = 'transit'"
          >
            <svg class="w-4 h-4 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Live Transit
          </button>

          <button
            type="button"
            class="tab-nav-btn"
            :class="activeTab === 'enrollment' ? 'tab-nav-btn-active' : ''"
            @click="activeTab = 'enrollment'"
          >
            <svg class="w-4 h-4 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            Enrollment
            <span v-if="coordinator.pendingEnrollmentCount" class="badge-counter ml-2">
              {{ coordinator.pendingEnrollmentCount }}
            </span>
          </button>

          <button
            type="button"
            class="tab-nav-btn"
            :class="activeTab === 'exports' ? 'tab-nav-btn-active' : ''"
            @click="activeTab = 'exports'"
          >
            <svg class="w-4 h-4 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            CSV Exports
          </button>
        </div>

        <!-- ======================= TAB 1: LIVE TRANSIT ======================= -->
        <template v-if="activeTab === 'transit'">
          <!-- 4-Stat Overview Grid -->
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div class="stat-tile">
              <p class="stat-label">Safe at Base</p>
              <p class="stat-value text-emerald-400">{{ coordinator.safeCount }}</p>
            </div>
            <div class="stat-tile">
              <p class="stat-label">In Transit</p>
              <p class="stat-value text-[#00C2FF]">{{ coordinator.inTransitCount }}</p>
            </div>
            <div class="stat-tile">
              <p class="stat-label">Delayed</p>
              <p class="stat-value text-rose-400">{{ coordinator.delayedCount }}</p>
            </div>
            <div class="stat-tile">
              <p class="stat-label">Enrollment Checks</p>
              <p class="stat-value text-amber-400">{{ coordinator.pendingEnrollmentCount }}</p>
            </div>
          </div>

          <!-- Live Feed Container -->
          <div class="trainext-glass-card">
            <div class="flex flex-wrap items-center justify-between gap-3 mb-5">
              <div class="flex items-center gap-3">
                <div class="p-2.5 rounded-2xl bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/20">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h3 class="card-title text-white">Live Intern Transit Feed</h3>
                  <p class="card-subtitle text-slate-400">
                    Safe, in-transit, and delayed status from clock-outs and safe-at-base receipts
                  </p>
                </div>
              </div>
              <div class="badge-pill badge-pill-success flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>LIVE RADAR</span>
              </div>
            </div>

            <p v-if="!coordinator.linkedInterns.length" class="text-center py-8 text-xs text-slate-400 font-regular">
              No interns have linked your coordinator account yet.
            </p>
            <p v-else-if="!feedRows.length" class="text-center py-8 text-xs text-slate-400 font-regular">
              No linked interns to monitor.
            </p>

            <!-- Dynamic Feed Rows -->
            <div v-else class="space-y-3.5">
              <div
                v-for="row in feedRows"
                :key="row.intern.intern_id"
                class="history-row"
              >
                <!-- Top Row: Intern Info & Status Badge -->
                <div class="flex flex-wrap items-start justify-between gap-2.5 mb-2.5">
                  <div>
                    <h4 class="text-sm font-heavy text-white flex items-center gap-2">
                      {{ row.intern.full_name }}
                    </h4>
                    <p class="text-xs text-slate-300 mt-0.5 font-regular">
                      {{ row.intern.email }} · <span class="text-[#00C2FF] font-semibold">{{ row.intern.university_name || 'University not set' }}</span>
                    </p>
                    <p class="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                      <svg class="w-3.5 h-3.5 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      Base: {{ row.intern.home_base_address || 'Not set' }}
                    </p>
                  </div>
                  <div class="badge-pill" :class="stateBadgeClass(row.state)">
                    <span class="w-1.5 h-1.5 rounded-full mr-1.5" :class="stateDotClass(row.state)"></span>
                    {{ stateLabel(row.state) }}
                  </div>
                </div>

                <!-- Middle Grid: Telemetry Details -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs p-3 rounded-2xl bg-white/[0.02] border border-white/10">
                  <p v-if="row.checkin" class="text-slate-200">
                    <strong class="text-[#00C2FF]">Safe receipt:</strong> {{ row.checkin.receipt_code }} · {{ formatDateTime(row.checkin.checkin_at) }}
                  </p>
                  <p v-if="row.openLog" class="text-slate-200">
                    <strong class="text-emerald-400">Clocked in:</strong> {{ formatDateTime(row.openLog.clock_in_at) }}
                  </p>
                  <p v-else-if="row.lastLog?.clock_out_at" class="text-slate-200">
                    <strong class="text-slate-400">Last clock-out:</strong> {{ formatDateTime(row.lastLog.clock_out_at) }}
                  </p>
                  <p v-else class="text-slate-400 italic">
                    <strong>Attendance:</strong> No activity logged today
                  </p>
                  <p v-if="row.lastPing" class="text-slate-300">
                    <strong class="text-amber-400">Last ping:</strong> {{ formatDateTime(row.lastPing.created_at) }}
                  </p>
                </div>

                <!-- Bottom Actions -->
                <div class="mt-3.5 flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    class="pill-btn-sm flex items-center gap-1.5"
                    :disabled="pingingId === row.intern.intern_id"
                    @click="confirmPing(row)"
                  >
                    <ion-spinner v-if="pingingId === row.intern.intern_id" name="crescent" class="w-3.5 h-3.5 text-[#00C2FF]" />
                    <svg v-else class="w-3.5 h-3.5 text-[#00C2FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    Ping intern
                  </button>
                  <span v-if="row.state === 'delayed'" class="badge-pill badge-pill-danger text-[10px]">
                    ⚠️ Check-in Overdue
                  </span>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- ======================= TAB 2: ENROLLMENT ======================= -->
        <template v-if="activeTab === 'enrollment'">
          <div class="trainext-glass-card">
            <div class="flex items-center gap-3">
              <div class="p-2.5 rounded-2xl bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/20">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 class="card-title text-white">School Enrollment Verification</h3>
                <p class="card-subtitle text-slate-400">
                  Confirm each intern's academic enrollment credentials. Intern unlocks geofenced OJT controls once approved.
                </p>
              </div>
            </div>

            <p v-if="!coordinator.linkedInterns.length" class="text-center py-8 text-xs text-slate-400 font-regular">
              No interns have linked your coordinator account yet.
            </p>
          </div>

          <!-- Responsive Enrollment Cards Grid -->
          <div class="grid gap-4 md:grid-cols-2">
            <EnrollmentCard
              v-for="intern in coordinator.linkedInterns"
              :key="intern.intern_id"
              :intern="intern"
              @reviewed="showToast"
            />
          </div>
        </template>

        <!-- ======================= TAB 3: CSV EXPORTS ======================= -->
        <template v-if="activeTab === 'exports'">
          <div class="trainext-glass-card">
            <div class="flex items-center gap-3 mb-5">
              <div class="p-2.5 rounded-2xl bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/20">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </div>
              <div>
                <h3 class="card-title text-white">Download CSV Reports</h3>
                <p class="card-subtitle text-slate-400">
                  Export verified accomplishment summaries and safe-at-base records for institutional compliance.
                </p>
              </div>
            </div>

            <!-- Export Cards Grid -->
            <div class="grid gap-4 sm:grid-cols-2">
              <!-- Accomplishments Export Card -->
              <div class="history-row flex flex-col justify-between">
                <div>
                  <div class="flex items-center gap-2.5 mb-2">
                    <div class="p-2 rounded-xl bg-[#00C2FF]/10 text-[#00C2FF]">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h4 class="text-sm font-heavy text-white">Accomplishment Records</h4>
                  </div>
                  <p class="text-xs text-slate-400 leading-relaxed font-regular">
                    Dates, rendered tasks, hours spent, supervisor approval status, feedback, and cloud proof attachments.
                  </p>
                </div>

                <button
                  type="button"
                  class="pill-btn-outline w-full flex items-center justify-center gap-2 mt-4"
                  :disabled="exporting === 'reports' || !coordinator.linkedInterns.length"
                  @click="exportAccomplishments"
                >
                  <ion-spinner v-if="exporting === 'reports'" name="crescent" class="w-4 h-4 text-[#00C2FF]" />
                  <svg v-else class="w-4 h-4 text-[#00C2FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export Accomplishments CSV
                </button>
              </div>

              <!-- Safety Logs Export Card -->
              <div class="history-row flex flex-col justify-between">
                <div>
                  <div class="flex items-center gap-2.5 mb-2">
                    <div class="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <h4 class="text-sm font-heavy text-white">Safety & Transit Logs</h4>
                  </div>
                  <p class="text-xs text-slate-400 leading-relaxed font-regular">
                    Safe-at-base timestamps, encrypted receipt codes, residence coordinates, and geofence audits.
                  </p>
                </div>

                <button
                  type="button"
                  class="pill-btn-outline w-full flex items-center justify-center gap-2 mt-4"
                  :disabled="exporting === 'safety' || !coordinator.linkedInterns.length"
                  @click="exportSafety"
                >
                  <ion-spinner v-if="exporting === 'safety'" name="crescent" class="w-4 h-4 text-[#00C2FF]" />
                  <svg v-else class="w-4 h-4 text-[#00C2FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export Safety Logs CSV
                </button>
              </div>
            </div>

            <!-- Feedback Message -->
            <p v-if="exportMessage" class="mt-4 text-xs font-semibold text-[#00C2FF] flex items-center gap-2">
              <span>✓</span> {{ exportMessage }}
            </p>
          </div>
        </template>
      </div>

      <!-- Toast Feedback -->
      <ion-toast
        :is-open="toast.open"
        :message="toast.message"
        :color="toast.color"
        :duration="4500"
        @ionDidDismiss="toast.open = false"
      />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import {
  IonContent,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonToast,
  alertController
} from '@ionic/vue'
import AppHeader from '@/components/AppHeader.vue'
import EnrollmentCard from '@/components/EnrollmentCard.vue'
import { useAuthStore } from '@/stores/auth'
import { useCoordinatorStore } from '@/stores/coordinator'
import { useSafetyStore } from '@/stores/safety'
import { sendTransitPingNotification } from '@/lib/email'
import { csvFilename, downloadCsv } from '@/lib/csv'
import type { TransitFeedRow, TransitState } from '@/types'

type TabName = 'transit' | 'enrollment' | 'exports'

const auth = useAuthStore()
const coordinator = useCoordinatorStore()
const safety = useSafetyStore()

const activeTab = ref<TabName>('transit')
const pingingId = ref('')
const exporting = ref('')
const exportMessage = ref('')
const toast = reactive({
  open: false,
  message: '',
  color: 'success'
})

let refreshTimer: number | null = null

const feedRows = computed(() =>
  [...coordinator.feed].sort((a, b) => {
    const rank: Record<TransitState, number> = {
      delayed: 0,
      in_transit: 1,
      safe: 2
    }
    const byState = rank[a.state] - rank[b.state]
    if (byState !== 0) {
      return byState
    }
    return a.intern.full_name.localeCompare(b.intern.full_name)
  })
)

function stateLabel(state: TransitState): string {
  if (state === 'safe') {
    return 'Safe at base'
  }
  if (state === 'in_transit') {
    return 'In transit'
  }
  return 'Delayed'
}

function stateBadgeClass(state: TransitState): string {
  if (state === 'safe') return 'badge-pill-success'
  if (state === 'in_transit') return 'badge-pill-cyan'
  return 'badge-pill-danger'
}

function stateDotClass(state: TransitState): string {
  if (state === 'safe') return 'bg-emerald-400'
  if (state === 'in_transit') return 'bg-[#00C2FF] animate-pulse'
  return 'bg-rose-400 animate-pulse'
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function showToast(message: string, color = 'success'): void {
  toast.message = message
  toast.color = color
  toast.open = true
}

async function loadData(): Promise<void> {
  await coordinator.fetchDashboard()
}

async function handleRefresh(event: CustomEvent): Promise<void> {
  try {
    await loadData()
  } finally {
    (event.target as HTMLIonRefresherElement).complete()
  }
}

function scheduleRefresh(): void {
  if (refreshTimer !== null) {
    window.clearTimeout(refreshTimer)
  }
  refreshTimer = window.setTimeout(() => {
    refreshTimer = null
    void loadData().catch(() => undefined)
  }, 600)
}

async function confirmPing(row: TransitFeedRow): Promise<void> {
  const alert = await alertController.create({
    header: `Ping ${row.intern.full_name}`,
    message:
      'Send a safe-at-base reminder. The intern receives an in-app record and an email.',
    inputs: [
      {
        name: 'message',
        type: 'textarea',
        value: 'Please confirm that you are safe at base.',
        placeholder: 'Message to the intern'
      }
    ],
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      {
        text: 'Send ping',
        role: 'confirm',
        handler: (data) => {
          void sendPing(row, String(data.message ?? ''))
        }
      }
    ]
  })

  await alert.present()
}

async function sendPing(row: TransitFeedRow, message: string): Promise<void> {
  pingingId.value = row.intern.intern_id
  try {
    const text = message.trim() || 'Please confirm that you are safe at base.'
    await safety.pingIntern(row.intern.intern_id, text)
    const result = await sendTransitPingNotification({
      internEmail: row.intern.email,
      internName: row.intern.full_name,
      coordinatorName: auth.displayName,
      message: text,
      baseAddress: row.intern.home_base_address
    })
    if (result.sent) {
      showToast(`Ping sent to ${row.intern.full_name} and emailed.`, 'success')
    } else {
      showToast(
        `Ping recorded. Email was not sent: ${result.reason ?? 'unknown error'}.`,
        'warning'
      )
    }
  } catch (err) {
    showToast(
      err instanceof Error ? err.message : 'Unable to ping the intern.',
      'danger'
    )
  } finally {
    pingingId.value = ''
  }
}

async function exportAccomplishments(): Promise<void> {
  exporting.value = 'reports'
  exportMessage.value = ''
  try {
    const rows = await coordinator.fetchReportsForExport()
    downloadCsv(csvFilename('trainext-coordinator-accomplishments'), rows, [
      {
        label: 'Intern',
        value: (row) => coordinator.internById(row.intern_id)?.full_name ?? ''
      },
      {
        label: 'Email',
        value: (row) => coordinator.internById(row.intern_id)?.email ?? ''
      },
      { label: 'Report date', value: (row) => row.report_date },
      { label: 'Title', value: (row) => row.title },
      { label: 'Tasks', value: (row) => row.tasks },
      { label: 'Hours spent', value: (row) => Number(row.hours_spent).toFixed(2) },
      { label: 'Status', value: (row) => row.status },
      { label: 'Feedback', value: (row) => row.feedback ?? '' },
      { label: 'Proof count', value: (row) => row.proofs?.length ?? 0 },
      {
        label: 'Proof links',
        value: (row) =>
          (row.proofs ?? [])
            .map((proof) => proof.external_url ?? proof.file_name ?? '')
            .filter(Boolean)
            .join(' | ')
      }
    ])
    exportMessage.value = `${rows.length} accomplishment record(s) exported.`
    showToast('Accomplishment CSV downloaded.', 'success')
  } catch (err) {
    showToast(
      err instanceof Error ? err.message : 'Unable to export accomplishments.',
      'danger'
    )
  } finally {
    exporting.value = ''
  }
}

async function exportSafety(): Promise<void> {
  exporting.value = 'safety'
  exportMessage.value = ''
  try {
    const rows = await coordinator.fetchSafetyForExport()
    downloadCsv(csvFilename('trainext-safety-logs'), rows, [
      {
        label: 'Intern',
        value: (row) => coordinator.internById(row.intern_id)?.full_name ?? ''
      },
      {
        label: 'Email',
        value: (row) => coordinator.internById(row.intern_id)?.email ?? ''
      },
      { label: 'Check-in date', value: (row) => row.checkin_date },
      {
        label: 'Check-in time',
        value: (row) => new Date(row.checkin_at).toLocaleString()
      },
      { label: 'Base label', value: (row) => row.base_label },
      { label: 'Receipt code', value: (row) => row.receipt_code },
      { label: 'Latitude', value: (row) => row.latitude ?? '' },
      { label: 'Longitude', value: (row) => row.longitude ?? '' },
      { label: 'Audit ID', value: (row) => row.id }
    ])
    exportMessage.value = `${rows.length} safety record(s) exported.`
    showToast('Safety log CSV downloaded.', 'success')
  } catch (err) {
    showToast(
      err instanceof Error ? err.message : 'Unable to export safety logs.',
      'danger'
    )
  } finally {
    exporting.value = ''
  }
}

onMounted(async () => {
  try {
    await loadData()
    safety.subscribeCoordinator(scheduleRefresh)
  } catch (err) {
    showToast(
      err instanceof Error ? err.message : 'Unable to load coordinator dashboard.',
      'danger'
    )
  }
})

onBeforeUnmount(() => {
  if (refreshTimer !== null) {
    window.clearTimeout(refreshTimer)
    refreshTimer = null
  }
  safety.unsubscribe()
})
</script>

<style scoped>
/* Typography Definition */
.font-aileron {
  font-family: 'Aileron', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
}

.font-regular {
  font-family: 'Aileron', sans-serif !important;
  font-weight: 400 !important;
}

.font-bold {
  font-family: 'Aileron Bold', 'Aileron', sans-serif !important;
  font-weight: 700 !important;
}

.font-heavy {
  font-family: 'Aileron Heavy', 'Aileron Black', 'Aileron Bold', 'Aileron', sans-serif !important;
  font-weight: 900 !important;
}

/* Ionic Background Override */
ion-content.dashboard-content {
  --background: transparent !important;
}
ion-content.dashboard-content::part(background) {
  background: transparent !important;
}

/* Crisp & Transparent Glassmorphic Cards */
.trainext-glass-card {
  border-radius: 28px !important;
  border: 1px solid rgba(255, 255, 255, 0.22) !important;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.06) 0%,
    rgba(4, 9, 22, 0.38) 40%,
    rgba(2, 6, 17, 0.50) 100%
  ) !important;
  backdrop-filter: blur(8px) saturate(140%) !important;
  -webkit-backdrop-filter: blur(8px) saturate(140%) !important;
  box-shadow: 
    0 16px 40px rgba(0, 0, 0, 0.75),
    inset 0 1px 1px rgba(255, 255, 255, 0.35) !important;
  padding: 24px !important;
  box-sizing: border-box !important;
}

/* Custom Navigation Segment Tabs */
.tab-nav-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 14px;
  border-radius: 9999px;
  font-family: 'Aileron Bold', 'Aileron', sans-serif;
  font-size: 13px;
  font-weight: 700;
  color: #94a3b8;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.25s ease;
}

.tab-nav-btn:hover {
  color: #ffffff;
}

.tab-nav-btn-active {
  background: rgba(0, 194, 255, 0.16) !important;
  color: #00C2FF !important;
  border: 1px solid rgba(0, 194, 255, 0.35) !important;
  box-shadow: 0 0 14px rgba(0, 194, 255, 0.25) !important;
}

.badge-counter {
  padding: 2px 7px;
  background: #ef4444;
  color: #ffffff;
  border-radius: 9999px;
  font-size: 10px;
  font-weight: 900;
}

/* Metric Stat Tiles */
.stat-tile {
  background: rgba(255, 255, 255, 0.04) !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  border-radius: 20px !important;
  padding: 14px 12px !important;
  text-align: center !important;
}

.stat-label {
  font-size: 9.5px !important;
  font-weight: 800 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.1em !important;
  color: #94a3b8 !important;
  margin: 0 !important;
}

.stat-value {
  font-size: 22px !important;
  font-family: 'Aileron Heavy', 'Aileron', sans-serif !important;
  font-weight: 900 !important;
  margin: 4px 0 0 0 !important;
}

/* Card Header Titles */
.card-title {
  font-family: 'Aileron Heavy', 'Aileron Bold', 'Aileron', sans-serif !important;
  font-size: 19px !important;
  font-weight: 900 !important;
  letter-spacing: -0.01em !important;
  margin: 0 !important;
}

.card-subtitle {
  font-family: 'Aileron Bold', 'Aileron', sans-serif !important;
  font-size: 12px !important;
  font-weight: 700 !important;
  letter-spacing: 0.01em !important;
  margin: 0 !important;
}

/* History / Feed Row */
.history-row {
  background: rgba(255, 255, 255, 0.03) !important;
  border: 1px solid rgba(255, 255, 255, 0.10) !important;
  border-radius: 20px !important;
  padding: 16px 18px !important;
  transition: all 0.2s ease !important;
}

.history-row:hover {
  background: rgba(255, 255, 255, 0.06) !important;
  border-color: rgba(0, 194, 255, 0.3) !important;
}

/* Badges / Chips */
.badge-pill {
  display: inline-flex !important;
  align-items: center !important;
  padding: 5px 12px !important;
  border-radius: 9999px !important;
  font-size: 11px !important;
  font-weight: 800 !important;
  letter-spacing: 0.04em !important;
}

.badge-pill-success {
  background: rgba(16, 185, 129, 0.16) !important;
  color: #34d399 !important;
  border: 1px solid rgba(16, 185, 129, 0.35) !important;
}

.badge-pill-danger {
  background: rgba(239, 68, 68, 0.16) !important;
  color: #f87171 !important;
  border: 1px solid rgba(239, 68, 68, 0.35) !important;
}

.badge-pill-cyan {
  background: rgba(0, 194, 255, 0.16) !important;
  color: #00C2FF !important;
  border: 1px solid rgba(0, 194, 255, 0.35) !important;
}

.badge-pill-slate {
  background: rgba(148, 163, 184, 0.12) !important;
  color: #cbd5e1 !important;
  border: 1px solid rgba(255, 255, 255, 0.15) !important;
}

/* Action Buttons */
.pill-btn-outline {
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(255, 255, 255, 0.25) !important;
  color: #ffffff !important;
  border-radius: 9999px !important;
  padding: 8px 16px !important;
  font-size: 11.5px !important;
  font-weight: 800 !important;
  cursor: pointer !important;
  transition: all 0.2s ease !important;
}

.pill-btn-outline:hover:not(:disabled) {
  border-color: #00C2FF !important;
  color: #00C2FF !important;
}

.pill-btn-outline:disabled {
  opacity: 0.45 !important;
  cursor: not-allowed !important;
}

.pill-btn-sm {
  background: rgba(0, 194, 255, 0.12) !important;
  border: 1px solid rgba(0, 194, 255, 0.3) !important;
  color: #00C2FF !important;
  border-radius: 9999px !important;
  padding: 5px 12px !important;
  font-size: 11px !important;
  font-weight: 800 !important;
  cursor: pointer !important;
  transition: all 0.2s ease !important;
}

.pill-btn-sm:hover:not(:disabled) {
  background: rgba(0, 194, 255, 0.25) !important;
}

.pill-btn-sm:disabled {
  opacity: 0.45 !important;
  cursor: not-allowed !important;
}
</style>