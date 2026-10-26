<template>
  <div class="trainext-glass-card font-aileron">
    <!-- Header -->
    <div class="flex flex-wrap items-start justify-between gap-2.5 mb-3">
      <div>
        <h3 class="card-title text-white flex items-center gap-2">
          {{ intern.full_name }}
        </h3>
        <p class="card-subtitle text-[#00C2FF] mt-0.5 font-bold">
          {{ intern.email }} · School Enrollment
        </p>
      </div>

      <div class="flex flex-wrap gap-1.5">
        <span class="badge-pill" :class="statusBadgeClass(intern.enrollment_status)">
          Enrollment: {{ intern.enrollment_status }}
        </span>
        <span class="badge-pill" :class="statusBadgeClass(intern.deployment_status)">
          Deployment: {{ intern.deployment_status }}
        </span>
      </div>
    </div>

    <!-- Telemetry Details Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs p-3.5 rounded-2xl bg-white/[0.02] border border-white/10 my-3">
      <p class="text-slate-300">
        <strong class="text-slate-400 block uppercase text-[10px] tracking-wider">Student ID</strong>
        <span class="text-white font-semibold">{{ intern.id_number || 'Not provided' }}</span>
      </p>
      <p class="text-slate-300">
        <strong class="text-slate-400 block uppercase text-[10px] tracking-wider">Contact</strong>
        <span class="text-white font-semibold">{{ intern.phone || 'Not provided' }}</span>
      </p>
      <p class="text-slate-300">
        <strong class="text-slate-400 block uppercase text-[10px] tracking-wider">University / School</strong>
        <span class="text-white font-semibold">{{ intern.university_name || intern.company_name || 'Not provided' }}</span>
      </p>
      <p class="text-slate-300">
        <strong class="text-slate-400 block uppercase text-[10px] tracking-wider">Base Residence</strong>
        <span class="text-white font-semibold">{{ intern.home_base_address || 'Not provided' }}</span>
      </p>
    </div>

    <p v-if="intern.enrollment_feedback" class="text-xs text-cyan-200 p-2.5 rounded-xl bg-cyan-950/30 border border-cyan-800/40 my-3 font-regular">
      <strong>Previous remarks:</strong> {{ intern.enrollment_feedback }}
    </p>

    <!-- Remarks Textarea -->
    <div class="mt-3">
      <label class="field-label">ENROLLMENT VERIFICATION REMARKS (SENT BY EMAIL)</label>
      <div class="textarea-box">
        <textarea
          v-model="feedback"
          rows="2"
          placeholder="Optional remarks for approval or rejection..."
          class="field-textarea"
        ></textarea>
      </div>
    </div>

    <!-- Actions -->
    <div class="mt-4 flex flex-wrap items-center gap-2.5">
      <button
        type="button"
        class="pill-btn btn-gradient-cyan text-xs py-2 px-4 flex items-center gap-1.5"
        :disabled="reviewing"
        @click="review('approved')"
      >
        <ion-spinner v-if="reviewing" name="crescent" class="w-3.5 h-3.5 text-black" />
        Approve Enrollment
      </button>

      <button
        type="button"
        class="pill-btn-danger-sm py-2 px-4"
        :disabled="reviewing"
        @click="review('rejected')"
      >
        Reject Enrollment
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { IonSpinner } from '@ionic/vue'
import { useAuthStore } from '@/stores/auth'
import { useCoordinatorStore } from '@/stores/coordinator'
import type { ApprovalStatus, InternProgress } from '@/types'

const props = defineProps<{ intern: InternProgress }>()
const emit = defineEmits<{ reviewed: [message: string, color: string] }>()

const auth = useAuthStore()
const coordinator = useCoordinatorStore()
const feedback = ref('')
const reviewing = ref(false)

function statusBadgeClass(status: ApprovalStatus): string {
  if (status === 'approved') return 'badge-pill-success'
  if (status === 'rejected') return 'badge-pill-danger'
  return 'badge-pill-amber'
}

async function review(status: Exclude<ApprovalStatus, 'pending'>): Promise<void> {
  reviewing.value = true
  try {
    const result = await coordinator.reviewEnrollment(
      props.intern.intern_id,
      status,
      feedback.value,
      auth.displayName
    )
    feedback.value = ''
    if (result.email.sent) {
      emit(
        'reviewed',
        `Enrollment ${status}. Intern notified by email.`,
        'success'
      )
    } else {
      emit(
        'reviewed',
        `Enrollment ${status}. Email was not sent: ${result.email.reason ?? 'unknown error'}.`,
        'warning'
      )
    }
  } catch (err) {
    emit(
      'reviewed',
      err instanceof Error ? err.message : 'Unable to verify enrollment.',
      'danger'
    )
  } finally {
    reviewing.value = false
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

.textarea-box {
  border-bottom: 1.25px solid rgba(255, 255, 255, 0.35) !important;
  padding: 4px 0 !important;
  transition: border-color 0.2s ease !important;
}

.textarea-box:focus-within {
  border-bottom-color: #00C2FF !important;
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

.field-textarea::placeholder {
  color: rgba(148, 163, 184, 0.6) !important;
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