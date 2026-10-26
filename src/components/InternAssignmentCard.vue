<template>
  <div class="trainext-glass-card font-aileron">
    <!-- Header -->
    <div class="flex flex-wrap items-start justify-between gap-2.5 mb-3">
      <div>
        <h3 class="card-title text-white flex items-center gap-2">
          {{ intern.full_name }}
        </h3>
        <p class="card-subtitle text-[#00C2FF] mt-0.5 font-bold">
          {{ intern.email }}
        </p>
      </div>

      <div class="flex flex-wrap gap-1.5">
        <span class="badge-pill" :class="intern.supervisor_id ? 'badge-pill-success' : 'badge-pill-amber'">
          {{ intern.supervisor_id ? 'Assigned to you' : 'Unassigned intern' }}
        </span>
        <span class="badge-pill badge-pill-slate">
          {{ assignedSiteName }}
        </span>
        <span class="badge-pill" :class="statusBadgeClass(intern.enrollment_status)">
          School: {{ intern.enrollment_status }}
        </span>
        <span class="badge-pill" :class="statusBadgeClass(intern.deployment_status)">
          Deployment: {{ intern.deployment_status }}
        </span>
      </div>
    </div>

    <!-- Progress Meter -->
    <div class="my-3.5 p-3.5 rounded-2xl bg-white/[0.02] border border-white/10">
      <div class="flex items-center justify-between text-xs mb-1.5">
        <span class="font-heavy text-white">
          {{ Number(intern.approved_hours).toFixed(2) }} / {{ Number(intern.required_hours).toFixed(2) }} hrs approved
        </span>
        <span class="font-bold text-[#00C2FF]">{{ progressLabel }}</span>
      </div>

      <div class="w-full h-2 rounded-full bg-slate-800/80 overflow-hidden border border-white/10 p-0.5">
        <div
          class="h-full rounded-full bg-gradient-to-r from-[#A5F3FC] via-[#00C2FF] to-[#38BDF8] shadow-[0_0_10px_#00C2FF] transition-all duration-500"
          :style="{ width: `${Math.min(progressRatio * 100, 100)}%` }"
        ></div>
      </div>

      <p class="mt-2 text-[11px] text-slate-400 font-regular">
        {{ Number(intern.pending_hours).toFixed(2) }} pending hour(s) · {{ intern.pending_reviews }} pending review(s)
      </p>
    </div>

    <!-- Company Deployment Verification Section -->
    <div
      v-if="isMyIntern"
      class="mt-3 p-3.5 rounded-2xl bg-cyan-950/20 border border-[#00C2FF]/30"
    >
      <div class="flex items-center gap-2 mb-1">
        <span class="w-2 h-2 rounded-full bg-[#00C2FF]"></span>
        <h4 class="text-xs font-heavy tracking-wider uppercase text-white">Company Deployment Verification</h4>
      </div>
      <p class="text-[11px] text-slate-300 leading-relaxed font-regular">
        Confirm official deployment to your company. Unlocks geofenced OJT controls.
      </p>

      <p v-if="intern.deployment_feedback" class="text-xs text-cyan-200 mt-2 p-2 rounded-xl bg-cyan-950/40 border border-cyan-800/40">
        <strong>Previous remarks:</strong> {{ intern.deployment_feedback }}
      </p>

      <div class="mt-3">
        <label class="field-label">VERIFICATION REMARKS (SENT BY EMAIL)</label>
        <div class="textarea-box">
          <textarea
            v-model="deploymentFeedback"
            rows="2"
            placeholder="Optional remarks for approval or rejection..."
            class="field-textarea"
          ></textarea>
        </div>
      </div>

      <div class="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          class="pill-btn btn-gradient-cyan text-xs py-2 px-3.5 flex items-center gap-1.5"
          :disabled="reviewingDeployment || !intern.company_site_id"
          @click="reviewDeployment('approved')"
        >
          <ion-spinner v-if="reviewingDeployment" name="crescent" class="w-3.5 h-3.5 text-black" />
          Approve Deployment
        </button>
        <button
          type="button"
          class="pill-btn-danger-sm py-2 px-3.5"
          :disabled="reviewingDeployment"
          @click="reviewDeployment('rejected')"
        >
          Reject Deployment
        </button>
      </div>

      <p v-if="!intern.company_site_id" class="mt-2 text-[11px] text-amber-400 font-semibold">
        ⚠️ Assign and save a company site below before approving deployment.
      </p>
    </div>

    <!-- Assignment Selectors -->
    <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
      <div>
        <label class="field-label">COMPANY SITE</label>
        <div class="select-box">
          <ion-select
            v-model="selectedSiteId"
            interface="popover"
            placeholder="Select a site"
            class="custom-ion-select"
          >
            <ion-select-option value="">Unassigned</ion-select-option>
            <ion-select-option
              v-for="site in sites"
              :key="site.id"
              :value="site.id"
            >
              {{ site.name }} ({{ site.radius_meters.toFixed(0) }}m)
            </ion-select-option>
          </ion-select>
        </div>
      </div>

      <div>
        <label class="field-label">REQUIRED OJT HOURS</label>
        <div class="input-line-box">
          <input
            v-model="requiredHours"
            type="number"
            min="1"
            step="0.5"
            placeholder="e.g. 486"
            class="field-input"
          />
        </div>
      </div>
    </div>

    <!-- Submit Assignment Button -->
    <button
      type="button"
      class="pill-btn btn-gradient-cyan w-full mt-4 flex items-center justify-center gap-2"
      :disabled="saving || !canSave"
      @click="saveAssignment"
    >
      <ion-spinner v-if="saving" name="crescent" class="w-4 h-4 text-black" />
      {{ intern.supervisor_id ? 'UPDATE ASSIGNMENT' : 'ASSIGN TO ME' }}
    </button>

    <p v-if="feedback" class="mt-2 text-xs font-semibold" :class="feedbackColor === 'success' ? 'text-emerald-400' : 'text-rose-400'">
      {{ feedback }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  IonSelect,
  IonSelectOption,
  IonSpinner
} from '@ionic/vue'
import { useSupervisorStore } from '@/stores/supervisor'
import { useAuthStore } from '@/stores/auth'
import type {
  ApprovalStatus,
  CompanySite,
  InternProgress
} from '@/types'

const props = defineProps<{
  intern: InternProgress
  sites: CompanySite[]
}>()

const emit = defineEmits<{
  assigned: [message: string, color: string]
}>()

const supervisor = useSupervisorStore()
const auth = useAuthStore()

const selectedSiteId = ref(props.intern.company_site_id ?? '')
const requiredHours = ref(String(props.intern.required_hours))
const saving = ref(false)
const deploymentFeedback = ref('')
const reviewingDeployment = ref(false)
const feedback = ref('')
const feedbackColor = ref<'success' | 'danger'>('success')

const isMyIntern = computed(
  () => props.intern.supervisor_id === auth.profile?.id
)

function statusBadgeClass(status: ApprovalStatus): string {
  if (status === 'approved') return 'badge-pill-success'
  if (status === 'rejected') return 'badge-pill-danger'
  return 'badge-pill-amber'
}

const canSave = computed(() => {
  const hours = Number(requiredHours.value)
  return Number.isFinite(hours) && hours > 0
})

const progressRatio = computed(() => {
  const required = Number(props.intern.required_hours)
  if (required <= 0) {
    return 0
  }
  return Math.min(Number(props.intern.approved_hours) / required, 1)
})

const progressLabel = computed(
  () => `${(progressRatio.value * 100).toFixed(1)}% complete`
)

const assignedSiteName = computed(() => {
  const site = props.sites.find((item) => item.id === props.intern.company_site_id)
  return site ? site.name : 'No site assigned'
})

watch(
  () => props.intern,
  (intern) => {
    selectedSiteId.value = intern.company_site_id ?? ''
    requiredHours.value = String(intern.required_hours)
  },
  { deep: true }
)

async function reviewDeployment(
  status: Exclude<ApprovalStatus, 'pending'>
): Promise<void> {
  if (!isMyIntern.value) {
    emit('assigned', 'Link the intern account before verifying deployment.', 'danger')
    return
  }

  reviewingDeployment.value = true
  try {
    const result = await supervisor.reviewDeployment(
      props.intern,
      status,
      deploymentFeedback.value,
      auth.displayName
    )
    deploymentFeedback.value = ''
    if (result.email.sent) {
      emit(
        'assigned',
        `Deployment ${status}. Intern notified by email.`,
        'success'
      )
    } else {
      emit(
        'assigned',
        `Deployment ${status}. Email was not sent: ${result.email.reason ?? 'unknown error'}.`,
        'warning'
      )
    }
  } catch (err) {
    emit(
      'assigned',
      err instanceof Error ? err.message : 'Unable to verify deployment.',
      'danger'
    )
  } finally {
    reviewingDeployment.value = false
  }
}

async function saveAssignment(): Promise<void> {
  feedback.value = ''

  if (!canSave.value) {
    feedbackColor.value = 'danger'
    feedback.value = 'Enter required hours greater than zero.'
    return
  }

  saving.value = true

  try {
    await supervisor.assignIntern(
      props.intern.intern_id,
      selectedSiteId.value || null,
      Number(requiredHours.value)
    )
    feedbackColor.value = 'success'
    feedback.value = 'Assignment saved.'
    emit('assigned', `Assignment updated for ${props.intern.full_name}.`, 'success')
  } catch (err) {
    feedbackColor.value = 'danger'
    feedback.value =
      err instanceof Error ? err.message : 'Unable to update assignment.'
    emit('assigned', feedback.value, 'danger')
  } finally {
    saving.value = false
  }
}
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

.input-line-box {
  display: flex !important;
  align-items: center !important;
  border-bottom: 1.25px solid rgba(255, 255, 255, 0.35) !important;
  padding-bottom: 6px !important;
  padding-top: 4px !important;
  transition: border-color 0.2s ease !important;
}

.input-line-box:focus-within {
  border-bottom-color: #00C2FF !important;
}

.field-input {
  width: 100% !important;
  background: transparent !important;
  color: #ffffff !important;
  font-size: 13.5px !important;
  outline: none !important;
  border: none !important;
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

.textarea-box {
  border-bottom: 1.25px solid rgba(255, 255, 255, 0.35) !important;
  padding: 4px 0 !important;
}

.field-textarea {
  width: 100% !important;
  background: transparent !important;
  color: #ffffff !important;
  font-size: 13px !important;
  outline: none !important;
  border: none !important;
  resize: vertical !important;
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

.badge-pill-slate {
  background: rgba(148, 163, 184, 0.12) !important;
  color: #cbd5e1 !important;
  border: 1px solid rgba(255, 255, 255, 0.15) !important;
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

.pill-btn-danger-sm {
  background: rgba(239, 68, 68, 0.12) !important;
  border: 1px solid rgba(239, 68, 68, 0.3) !important;
  color: #f87171 !important;
  border-radius: 9999px !important;
  font-family: 'Aileron Bold', sans-serif !important;
  font-weight: 800 !important;
  font-size: 11px !important;
  cursor: pointer !important;
}
</style>