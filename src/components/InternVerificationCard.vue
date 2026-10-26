<template>
  <div class="trainext-glass-card font-aileron">
    <!-- Header -->
    <div class="flex items-center gap-3 mb-4">
      <div class="p-2.5 rounded-2xl bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/20">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      </div>
      <div>
        <h3 class="card-title text-white">Account Placement Verification</h3>
        <p class="card-subtitle text-slate-400">
          Your school coordinator and company supervisor must both confirm your placement before OJT features unlock.
        </p>
      </div>
    </div>

    <!-- Dual Mentor Telemetry Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
      <!-- School Coordinator Block -->
      <div class="p-3.5 rounded-2xl bg-white/[0.02] border border-white/10">
        <p class="text-[10px] font-heavy uppercase tracking-widest text-slate-400">School Enrollment</p>
        <p class="mt-1 font-heavy text-white text-sm">{{ coordinatorName }}</p>
        <p class="text-xs text-[#00C2FF] font-semibold">{{ coordinatorOrg || 'School unassigned' }}</p>

        <span class="badge-pill mt-2.5 text-[10px]" :class="statusBadgeClass(profile?.enrollment_status)">
          {{ profile?.enrollment_status ?? 'pending' }}
        </span>

        <p v-if="profile?.enrollment_feedback" class="mt-2 text-xs text-cyan-200 p-2 rounded-xl bg-cyan-950/30 border border-cyan-800/40 font-regular">
          {{ profile.enrollment_feedback }}
        </p>
      </div>

      <!-- Company Supervisor Block -->
      <div class="p-3.5 rounded-2xl bg-white/[0.02] border border-white/10">
        <p class="text-[10px] font-heavy uppercase tracking-widest text-slate-400">Company Deployment</p>
        <p class="mt-1 font-heavy text-white text-sm">{{ supervisorName }}</p>
        <p class="text-xs text-[#00C2FF] font-semibold">{{ supervisorOrg || 'Company unassigned' }}</p>

        <span class="badge-pill mt-2.5 text-[10px]" :class="statusBadgeClass(profile?.deployment_status)">
          {{ profile?.deployment_status ?? 'pending' }}
        </span>

        <p v-if="profile?.deployment_feedback" class="mt-2 text-xs text-cyan-200 p-2 rounded-xl bg-cyan-950/30 border border-cyan-800/40 font-regular">
          {{ profile.deployment_feedback }}
        </p>
      </div>
    </div>

    <!-- Overall Summary & Edit Trigger -->
    <div
      v-if="!editing && !auth.needsAccountLink"
      class="mt-4 flex flex-wrap items-center justify-between gap-3 pt-1"
    >
      <span class="badge-pill" :class="auth.isFullyVerified ? 'badge-pill-success' : 'badge-pill-amber'">
        <span class="w-1.5 h-1.5 rounded-full mr-1.5" :class="auth.isFullyVerified ? 'bg-emerald-400' : 'bg-amber-400'"></span>
        {{ auth.isFullyVerified ? 'Fully verified — attendance and reports unlocked' : 'Waiting for both verifications' }}
      </span>

      <button
        type="button"
        class="pill-btn-outline"
        @click="startEditing"
      >
        Change Linked Mentors
      </button>
    </div>

    <!-- Edit Mentors Form -->
    <div v-if="editing || auth.needsAccountLink" class="mt-5 p-4 rounded-2xl bg-white/[0.02] border border-white/10">
      <p class="text-xs text-slate-300 font-regular leading-relaxed mb-3">
        Select the school coordinator and company supervisor who will verify your OJT. Linking or relinking resets both verification decisions to pending.
      </p>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div>
          <label class="field-label">SCHOOL COORDINATOR</label>
          <div class="select-box">
            <ion-select
              v-model="coordinatorId"
              interface="popover"
              placeholder="Select coordinator"
              class="custom-ion-select"
            >
              <ion-select-option
                v-for="mentor in coordinatorOptions"
                :key="mentor.id"
                :value="mentor.id"
              >
                {{ mentor.full_name }}{{ mentor.organization ? ` — ${mentor.organization}` : '' }}
              </ion-select-option>
            </ion-select>
          </div>
        </div>

        <div>
          <label class="field-label">COMPANY SUPERVISOR</label>
          <div class="select-box">
            <ion-select
              v-model="supervisorId"
              interface="popover"
              placeholder="Select supervisor"
              class="custom-ion-select"
            >
              <ion-select-option
                v-for="mentor in supervisorOptions"
                :key="mentor.id"
                :value="mentor.id"
              >
                {{ mentor.full_name }}{{ mentor.organization ? ` — ${mentor.organization}` : '' }}
              </ion-select-option>
            </ion-select>
          </div>
        </div>
      </div>

      <p
        v-if="!coordinatorOptions.length || !supervisorOptions.length"
        class="mt-3 text-xs text-amber-400 font-semibold"
      >
        ⚠️ Coordinator or supervisor account is not available yet. Ask them to register first, then refresh this page.
      </p>

      <div class="mt-4 flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          class="pill-btn btn-gradient-cyan text-xs py-2 px-4 flex items-center gap-1.5"
          :disabled="saving || !coordinatorId || !supervisorId"
          @click="save"
        >
          <ion-spinner v-if="saving" name="crescent" class="w-3.5 h-3.5 text-black" />
          Save Linked Accounts
        </button>

        <button
          v-if="!auth.needsAccountLink"
          type="button"
          class="pill-btn-outline"
          @click="editing = false"
        >
          Cancel
        </button>
      </div>
    </div>

    <p v-if="feedback" class="mt-3 text-xs font-semibold" :class="feedbackColor === 'success' ? 'text-emerald-400' : 'text-rose-400'">
      {{ feedback }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  IonSelect,
  IonSelectOption,
  IonSpinner
} from '@ionic/vue'
import { useAuthStore } from '@/stores/auth'
import type { ApprovalStatus } from '@/types'

const auth = useAuthStore()
const coordinatorId = ref('')
const supervisorId = ref('')
const editing = ref(false)
const saving = ref(false)
const feedback = ref('')
const feedbackColor = ref<'success' | 'danger'>('success')

const profile = computed(() => auth.profile)
const coordinatorOptions = computed(() =>
  auth.mentors.filter((mentor) => mentor.role === 'coordinator')
)
const supervisorOptions = computed(() =>
  auth.mentors.filter((mentor) => mentor.role === 'supervisor')
)
const coordinatorName = computed(() => {
  const match = auth.mentors.find((mentor) => mentor.id === profile.value?.coordinator_id)
  return match?.full_name ?? 'Not linked yet'
})
const supervisorName = computed(() => {
  const match = auth.mentors.find((mentor) => mentor.id === profile.value?.supervisor_id)
  return match?.full_name ?? 'Not linked yet'
})
const coordinatorOrg = computed(() => {
  const match = auth.mentors.find((mentor) => mentor.id === profile.value?.coordinator_id)
  return match?.organization || profile.value?.university_name || ''
})
const supervisorOrg = computed(() => {
  const match = auth.mentors.find((mentor) => mentor.id === profile.value?.supervisor_id)
  return match?.organization || profile.value?.company_name || ''
})

function statusBadgeClass(status: ApprovalStatus | undefined): string {
  if (status === 'approved') return 'badge-pill-success'
  if (status === 'rejected') return 'badge-pill-danger'
  return 'badge-pill-amber'
}

function syncSelection(): void {
  coordinatorId.value = profile.value?.coordinator_id ?? ''
  supervisorId.value = profile.value?.supervisor_id ?? ''
}

function startEditing(): void {
  syncSelection()
  editing.value = true
  feedback.value = ''
}

async function save(): Promise<void> {
  feedback.value = ''
  saving.value = true
  try {
    await auth.linkAccounts(coordinatorId.value, supervisorId.value)
    editing.value = false
    feedbackColor.value = 'success'
    feedback.value =
      'Linked accounts saved. Both verifications are now pending confirmation.'
  } catch (err) {
    feedbackColor.value = 'danger'
    feedback.value =
      err instanceof Error ? err.message : 'Unable to link your accounts.'
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  try {
    if (!auth.mentors.length) {
      await auth.fetchMentors()
    }
    syncSelection()
  } catch (err) {
    feedbackColor.value = 'danger'
    feedback.value =
      err instanceof Error ? err.message : 'Unable to load coordinators and supervisors.'
  }
})

watch(
  () => profile.value?.coordinator_id,
  () => syncSelection()
)
</script>

<style scoped>
.font-aileron {
  font-family: 'Aileron', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
}

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
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.75), inset 0 1px 1px rgba(255, 255, 255, 0.35) !important;
  padding: 24px !important;
}

.card-title {
  font-family: 'Aileron Heavy', 'Aileron Bold', sans-serif !important;
  font-size: 18px !important;
  font-weight: 900 !important;
  margin: 0 !important;
}

.card-subtitle {
  font-size: 11.5px !important;
  margin: 0 !important;
}

.field-label {
  font-size: 9.5px !important;
  font-family: 'Aileron Heavy', sans-serif !important;
  font-weight: 900 !important;
  letter-spacing: 0.14em !important;
  color: #cbd5e1 !important;
  text-transform: uppercase !important;
  display: block !important;
  margin-bottom: 4px !important;
}

.select-box {
  border-bottom: 1.25px solid rgba(255, 255, 255, 0.35) !important;
  padding-bottom: 2px !important;
}

.custom-ion-select {
  --placeholder-color: rgba(148, 163, 184, 0.7);
  --color: #ffffff;
  font-size: 13px;
}

.badge-pill {
  display: inline-flex !important;
  align-items: center !important;
  padding: 4px 10px !important;
  border-radius: 9999px !important;
  font-size: 10.5px !important;
  font-weight: 800 !important;
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

.badge-pill-amber {
  background: rgba(245, 158, 11, 0.16) !important;
  color: #fbbf24 !important;
  border: 1px solid rgba(245, 158, 11, 0.35) !important;
}

.pill-btn {
  border-radius: 9999px !important;
  font-family: 'Aileron Heavy', sans-serif !important;
  font-weight: 900 !important;
  cursor: pointer !important;
  border: none !important;
  transition: all 0.2s ease !important;
}

.btn-gradient-cyan {
  background: linear-gradient(135deg, #a5f3fc 0%, #67e8f9 45%, #38bdf8 100%) !important;
  color: #000000 !important;
  box-shadow: 0 0 18px rgba(0, 194, 255, 0.45) !important;
}

.pill-btn-outline {
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(255, 255, 255, 0.25) !important;
  color: #ffffff !important;
  border-radius: 9999px !important;
  padding: 6px 14px !important;
  font-size: 11px !important;
  font-weight: 800 !important;
  cursor: pointer !important;
  transition: all 0.2s ease !important;
}

.pill-btn-outline:hover {
  border-color: #00C2FF !important;
  color: #00C2FF !important;
}
</style>