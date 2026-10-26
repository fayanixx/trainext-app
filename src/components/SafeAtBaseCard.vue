<template>
  <div class="trainext-glass-card font-aileron">
    <!-- Header -->
    <div class="flex items-center gap-3 mb-4">
      <div class="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      </div>
      <div>
        <h3 class="card-title text-white">Safe-at-Base Check-in</h3>
        <p class="card-subtitle text-slate-400">Timestamped transit audit for your school coordinator</p>
      </div>
    </div>

    <!-- Active Receipt Issued State -->
    <template v-if="safety.myCheckin">
      <div class="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/40">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div>
            <p class="text-[10px] font-heavy uppercase tracking-widest text-emerald-400">Digital Safe-at-Base Receipt</p>
            <p class="mt-1 text-3xl font-heavy tracking-wider text-emerald-300 drop-shadow-[0_0_12px_rgba(52,211,153,0.5)]">
              {{ safety.myCheckin.receipt_code }}
            </p>
          </div>
          <span class="badge-pill badge-pill-success">
            Safe at Base
          </span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs p-3 rounded-xl bg-black/30 border border-white/10 my-3">
          <p class="text-slate-300">
            <strong class="text-slate-400 block uppercase text-[10px]">Confirmed</strong>
            <span class="text-white">{{ formatDateTime(safety.myCheckin.checkin_at) }}</span>
          </p>
          <p class="text-slate-300">
            <strong class="text-slate-400 block uppercase text-[10px]">Base Residence</strong>
            <span class="text-white">{{ safety.myCheckin.base_label }}</span>
          </p>
          <p v-if="safety.myCheckin.latitude !== null" class="text-slate-300">
            <strong class="text-slate-400 block uppercase text-[10px]">GPS Coordinates</strong>
            <span class="text-[#00C2FF] font-mono">{{ safety.myCheckin.latitude.toFixed(5) }}, {{ safety.myCheckin.longitude?.toFixed(5) }}</span>
          </p>
          <p class="text-slate-300">
            <strong class="text-slate-400 block uppercase text-[10px]">Audit Receipt ID</strong>
            <span class="text-slate-400 font-mono text-[11px]">{{ safety.myCheckin.id }}</span>
          </p>
        </div>

        <p class="text-[11px] text-slate-300 font-regular leading-relaxed">
          This record confirms that you reported safe arrival at your registered base. It is visible to your school coordinator and kept as part of your permanent OJT safety log.
        </p>
      </div>
    </template>

    <!-- Not Checked-in State -->
    <template v-else>
      <p class="text-xs text-slate-300 font-regular leading-relaxed mb-3">
        After leaving your OJT company site, confirm that you have safely arrived at your base residence. The system records the exact timestamp and issues a digital receipt for institutional audit.
      </p>

      <div class="p-3.5 rounded-2xl bg-white/[0.02] border border-white/10 text-xs text-slate-300 space-y-2">
        <p class="font-heavy text-white uppercase text-[11px] tracking-wider">Safety Declaration</p>
        <p class="font-regular leading-relaxed">
          By checking in, I confirm that I have safely reached my base residence and that the information I provide is accurate. I understand this timestamped confirmation is shared with my school coordinator.
        </p>
        <p class="pt-1 border-t border-white/10 text-slate-400">
          Registered base:
          <strong class="text-[#00C2FF]">{{ profile?.home_base_address || 'Not set in profile settings' }}</strong>
        </p>
      </div>

      <p v-if="openLog" class="mt-3 text-xs text-amber-400 font-semibold">
        ⚠️ Clock out of your active shift before confirming safe arrival.
      </p>

      <button
        type="button"
        class="pill-btn btn-gradient-cyan w-full flex items-center justify-center gap-2 mt-4"
        :disabled="safety.loading || openLog"
        @click="confirmCheckIn"
      >
        <ion-spinner v-if="safety.loading" name="crescent" class="w-4 h-4 text-black" />
        I AM SAFE AT BASE
      </button>
    </template>

    <p v-if="feedback" class="mt-3 text-xs font-semibold" :class="feedbackColor === 'success' ? 'text-emerald-400' : 'text-rose-400'">
      {{ feedback }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  IonSpinner,
  alertController
} from '@ionic/vue'
import { useAuthStore } from '@/stores/auth'
import { useSafetyStore } from '@/stores/safety'
import { useGeolocation } from '@/composables/useGeolocation'

defineProps<{ openLog: boolean }>()

const auth = useAuthStore()
const safety = useSafetyStore()
const { refresh: refreshLocation } = useGeolocation()

const feedback = ref('')
const feedbackColor = ref<'success' | 'danger'>('success')
const profile = computed(() => auth.profile)

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

async function confirmCheckIn(): Promise<void> {
  const alert = await alertController.create({
    header: 'Confirm safe arrival',
    message:
      'This will timestamp your safe-at-base confirmation and issue a digital receipt visible to your coordinator.',
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      {
        text: 'Confirm',
        role: 'confirm',
        handler: () => {
          void performCheckIn()
        }
      }
    ]
  })
  await alert.present()
}

async function performCheckIn(): Promise<void> {
  if (!profile.value) {
    return
  }

  feedback.value = ''
  let latitude: number | null = null
  let longitude: number | null = null

  try {
    const position = await refreshLocation()
    latitude = position.latitude
    longitude = position.longitude
  } catch {
    latitude = null
    longitude = null
  }

  try {
    const receipt = await safety.checkIn(
      profile.value.home_base_address ?? '',
      latitude,
      longitude
    )
    feedbackColor.value = 'success'
    feedback.value = `Safe arrival recorded. Receipt ${receipt.receipt_code}.`
  } catch (err) {
    feedbackColor.value = 'danger'
    feedback.value =
      err instanceof Error ? err.message : 'Unable to record safe check-in.'
  }
}

onMounted(async () => {
  if (!profile.value) {
    return
  }
  try {
    await safety.fetchMyCheckin(profile.value.id)
  } catch {
    feedbackColor.value = 'danger'
    feedback.value = safety.error || 'Unable to load today\'s safe check-in.'
  }
})
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

.pill-btn {
  border-radius: 9999px !important;
  padding: 13.5px 22px !important;
  font-family: 'Aileron Heavy', sans-serif !important;
  font-weight: 900 !important;
  font-size: 13.5px !important;
  cursor: pointer !important;
  border: none !important;
  transition: all 0.2s ease !important;
}

.pill-btn:disabled {
  opacity: 0.45 !important;
  cursor: not-allowed !important;
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
  background: rgba(16, 185, 129, 0.2) !important;
  color: #34d399 !important;
  border: 1px solid rgba(16, 185, 129, 0.4) !important;
}
</style>