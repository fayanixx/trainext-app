<template>
  <ion-modal :is-open="isOpen" @didDismiss="emit('update:isOpen', false)">
    <ion-header class="glass-header">
      <ion-toolbar class="glass-toolbar">
        <ion-title class="font-heavy text-white">Profile Settings</ion-title>
        <ion-buttons slot="end">
          <button type="button" class="close-pill-btn" @click="close">Close</button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="modal-content">
      <div class="mx-auto max-w-2xl space-y-5 px-4 py-6 font-aileron">
        <!-- Top Profile Badge Card -->
        <div class="trainext-glass-card">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-full bg-gradient-to-tr from-[#00C2FF] to-[#38BDF8] flex items-center justify-center font-heavy text-black text-lg shadow-[0_0_15px_rgba(0,194,255,0.4)]">
              {{ profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : 'U' }}
            </div>
            <div>
              <p class="text-base font-heavy text-white">{{ profile?.full_name }}</p>
              <p class="text-xs text-slate-300 font-semibold">{{ profile?.email }}</p>
            </div>
          </div>

          <div class="mt-3 flex flex-wrap gap-2 pt-1 border-t border-white/10">
            <span class="badge-pill badge-pill-cyan">{{ roleLabel }}</span>
            <span v-if="profile?.role === 'intern'" class="badge-pill" :class="enrollmentColor">
              Enrollment: {{ profile?.enrollment_status }}
            </span>
            <span v-if="profile?.role === 'intern'" class="badge-pill" :class="deploymentColor">
              Deployment: {{ profile?.deployment_status }}
            </span>
          </div>
        </div>

        <!-- Section 1: Personal Info -->
        <div class="trainext-glass-card space-y-4">
          <h4 class="section-title text-[#00C2FF]">Personal Information</h4>

          <div>
            <label class="field-label">FULL NAME</label>
            <div class="input-line-box">
              <input v-model="form.full_name" type="text" class="field-input" placeholder="Your full name" />
            </div>
          </div>

          <div>
            <label class="field-label">CONTACT NUMBER</label>
            <div class="input-line-box">
              <input v-model="form.phone" type="tel" class="field-input" placeholder="+63 900 000 0000" />
            </div>
          </div>

          <div v-if="profile?.role !== 'supervisor'" class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label class="field-label">STUDENT ID NUMBER</label>
              <div class="input-line-box">
                <input v-model="form.id_number" type="text" class="field-input" placeholder="e.g. 2023-0001" />
              </div>
            </div>
            <div>
              <label class="field-label">UNIVERSITY / SCHOOL</label>
              <div class="input-line-box">
                <input v-model="form.university_name" type="text" class="field-input" placeholder="University name" />
              </div>
            </div>
          </div>
        </div>

        <!-- Section 2: Company Info -->
        <div class="trainext-glass-card space-y-4">
          <h4 class="section-title text-[#00C2FF]">Company & OJT Information</h4>

          <div>
            <label class="field-label">COMPANY NAME</label>
            <div class="input-line-box">
              <input v-model="form.company_name" type="text" class="field-input" placeholder="Company name" />
            </div>
          </div>

          <div>
            <label class="field-label">COMPANY ADDRESS</label>
            <div class="input-line-box">
              <input v-model="form.company_address" type="text" class="field-input" placeholder="Company address" />
            </div>
          </div>

          <div>
            <label class="field-label">BASE RESIDENCE (SAFE-AT-BASE AUDIT REFERENCE)</label>
            <div class="input-line-box">
              <input v-model="form.home_base_address" type="text" class="field-input" placeholder="Your permanent / boarding residence address" />
            </div>
          </div>
        </div>

        <!-- Section 3: Emergency Contact -->
        <div class="trainext-glass-card space-y-4">
          <h4 class="section-title text-[#00C2FF]">Emergency Contact</h4>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label class="field-label">CONTACT PERSON</label>
              <div class="input-line-box">
                <input v-model="form.emergency_contact_name" type="text" class="field-input" placeholder="Guardian name" />
              </div>
            </div>
            <div>
              <label class="field-label">RELATIONSHIP</label>
              <div class="input-line-box">
                <input v-model="form.emergency_contact_relationship" type="text" class="field-input" placeholder="Parent, guardian, sibling" />
              </div>
            </div>
          </div>

          <div>
            <label class="field-label">EMERGENCY CONTACT NUMBER</label>
            <div class="input-line-box">
              <input v-model="form.emergency_contact_phone" type="tel" class="field-input" placeholder="+63 900 000 0000" />
            </div>
          </div>
        </div>

        <p v-if="feedback" class="text-xs font-semibold" :class="feedbackColor === 'success' ? 'text-emerald-400' : 'text-rose-400'">
          {{ feedback }}
        </p>

        <button
          type="button"
          class="pill-btn btn-gradient-cyan w-full flex items-center justify-center gap-2 mt-4"
          :disabled="saving"
          @click="save"
        >
          <ion-spinner v-if="saving" name="crescent" class="w-4 h-4 text-black" />
          SAVE PROFILE
        </button>
      </div>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
  IonButtons,
  IonContent,
  IonHeader,
  IonModal,
  IonSpinner,
  IonTitle,
  IonToolbar
} from '@ionic/vue'
import { useAuthStore } from '@/stores/auth'
import type { ProfileUpdateInput } from '@/types'

const props = defineProps<{ isOpen: boolean }>()
const emit = defineEmits<{ 'update:isOpen': [value: boolean] }>()

const auth = useAuthStore()
const saving = ref(false)
const feedback = ref('')
const feedbackColor = ref<'success' | 'danger'>('success')

const form = reactive<ProfileUpdateInput>({
  full_name: '',
  phone: '',
  id_number: '',
  university_name: '',
  company_name: '',
  company_address: '',
  home_base_address: '',
  emergency_contact_name: '',
  emergency_contact_relationship: '',
  emergency_contact_phone: ''
})

const profile = computed(() => auth.profile)
const roleLabel = computed(() => {
  if (profile.value?.role === 'coordinator') {
    return 'School coordinator'
  }
  if (profile.value?.role === 'supervisor') {
    return 'Company supervisor'
  }
  return 'Intern'
})
const enrollmentColor = computed(() =>
  profile.value?.enrollment_status === 'approved'
    ? 'badge-pill-success'
    : profile.value?.enrollment_status === 'rejected'
      ? 'badge-pill-danger'
      : 'badge-pill-amber'
)
const deploymentColor = computed(() =>
  profile.value?.deployment_status === 'approved'
    ? 'badge-pill-success'
    : profile.value?.deployment_status === 'rejected'
      ? 'badge-pill-danger'
      : 'badge-pill-amber'
)

function hydrate(): void {
  const current = profile.value
  form.full_name = current?.full_name ?? ''
  form.phone = current?.phone ?? ''
  form.id_number = current?.id_number ?? ''
  form.university_name = current?.university_name ?? ''
  form.company_name = current?.company_name ?? ''
  form.company_address = current?.company_address ?? ''
  form.home_base_address = current?.home_base_address ?? ''
  form.emergency_contact_name = current?.emergency_contact_name ?? ''
  form.emergency_contact_relationship =
    current?.emergency_contact_relationship ?? ''
  form.emergency_contact_phone = current?.emergency_contact_phone ?? ''
  feedback.value = ''
}

function close(): void {
  emit('update:isOpen', false)
}

function validate(): string {
  if (!form.full_name.trim()) {
    return 'Full name is required.'
  }
  if (form.phone.trim() && !/^[+()\-\s\d.]{7,20}$/.test(form.phone.trim())) {
    return 'Enter a valid contact number.'
  }
  if (
    form.emergency_contact_phone.trim() &&
    !/^[+()\-\s\d.]{7,20}$/.test(form.emergency_contact_phone.trim())
  ) {
    return 'Enter a valid emergency contact number.'
  }
  return ''
}

async function save(): Promise<void> {
  feedback.value = ''
  const message = validate()
  if (message) {
    feedbackColor.value = 'danger'
    feedback.value = message
    return
  }

  saving.value = true
  try {
    await auth.updateProfile({
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      id_number: form.id_number.trim(),
      university_name: form.university_name.trim(),
      company_name: form.company_name.trim(),
      company_address: form.company_address.trim(),
      home_base_address: form.home_base_address.trim(),
      emergency_contact_name: form.emergency_contact_name.trim(),
      emergency_contact_relationship: form.emergency_contact_relationship.trim(),
      emergency_contact_phone: form.emergency_contact_phone.trim()
    })
    feedbackColor.value = 'success'
    feedback.value = 'Profile updated.'
  } catch (err) {
    feedbackColor.value = 'danger'
    feedback.value =
      err instanceof Error ? err.message : 'Unable to update your profile.'
  } finally {
    saving.value = false
  }
}

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      hydrate()
    }
  }
)
</script>

<style scoped>
.font-aileron {
  font-family: 'Aileron', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
}

.modal-content {
  --background: #020611 !important;
}

.glass-header {
  border-bottom: 1px solid rgba(255, 255, 255, 0.12) !important;
}

.glass-toolbar {
  --background: #040916 !important;
  --color: #ffffff !important;
}

.trainext-glass-card {
  border-radius: 24px !important;
  border: 1px solid rgba(255, 255, 255, 0.18) !important;
  background: rgba(8, 16, 36, 0.6) !important;
  backdrop-filter: blur(8px) saturate(140%) !important;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6), inset 0 1px 1px rgba(255, 255, 255, 0.25) !important;
  padding: 20px !important;
}

.section-title {
  font-family: 'Aileron Heavy', sans-serif !important;
  font-size: 13.5px !important;
  font-weight: 900 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.08em !important;
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

.close-pill-btn {
  padding: 6px 14px;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #ffffff;
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
}

.pill-btn {
  border-radius: 9999px !important;
  padding: 13.5px 22px !important;
  font-family: 'Aileron Heavy', sans-serif !important;
  font-weight: 900 !important;
  font-size: 13.5px !important;
  cursor: pointer !important;
  border: none !important;
}

.btn-gradient-cyan {
  background: linear-gradient(135deg, #a5f3fc 0%, #67e8f9 45%, #38bdf8 100%) !important;
  color: #000000 !important;
  box-shadow: 0 0 20px rgba(0, 194, 255, 0.45) !important;
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

.badge-pill-cyan {
  background: rgba(0, 194, 255, 0.16) !important;
  color: #00C2FF !important;
  border: 1px solid rgba(0, 194, 255, 0.35) !important;
}
</style>