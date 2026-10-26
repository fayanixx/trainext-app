<template>
  <ion-modal :is-open="isOpen" @didDismiss="emit('update:isOpen', false)">
    <ion-header class="glass-header">
      <ion-toolbar class="glass-toolbar">
        <ion-title class="font-heavy text-white">Proof Attachments</ion-title>
        <ion-buttons slot="end">
          <button type="button" class="close-pill-btn" @click="emit('update:isOpen', false)">Close</button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="modal-content">
      <div class="mx-auto max-w-3xl space-y-4 px-4 py-6 font-aileron">
        <!-- Top Report Summary -->
        <div v-if="report" class="trainext-glass-card">
          <p class="font-heavy text-white text-base">{{ report.title }}</p>
          <p class="text-xs text-[#00C2FF] font-bold mt-1">
            {{ formatDate(report.report_date) }} · {{ Number(report.hours_spent).toFixed(2) }} hour(s) rendered
          </p>
        </div>

        <div v-if="loading" class="flex items-center gap-2 text-xs text-[#00C2FF] font-bold p-3">
          <ion-spinner name="crescent" class="w-4 h-4 text-[#00C2FF]" />
          Loading secure signed files…
        </div>

        <p v-if="errorMessage" class="text-xs text-rose-400 font-semibold p-2">
          {{ errorMessage }}
        </p>

        <p v-if="!loading && !items.length" class="text-center py-8 text-xs text-slate-400 font-regular">
          No proof files or links were attached to this accomplishment report.
        </p>

        <!-- Attachment Items -->
        <div
          v-for="item in items"
          :key="item.key"
          class="trainext-glass-card space-y-3"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p class="text-sm font-heavy text-white">{{ item.label }}</p>
              <span class="badge-pill badge-pill-cyan text-[10px] mt-1">
                {{ item.kind }}{{ item.external ? ' · external link' : '' }}
              </span>
            </div>

            <button
              v-if="item.url"
              type="button"
              class="pill-btn-outline"
              @click="openItem(item.url)"
            >
              Open in new tab ↗
            </button>
          </div>

          <!-- Preview Frame -->
          <div v-if="item.url && item.kind === 'image'" class="overflow-hidden rounded-xl border border-white/10 bg-black/40">
            <img
              :src="item.url"
              :alt="item.label"
              class="max-h-96 w-full object-contain mx-auto"
            />
          </div>

          <div v-else-if="item.url && item.kind === 'video'" class="overflow-hidden rounded-xl border border-white/10 bg-black">
            <video
              :src="item.url"
              controls
              class="max-h-96 w-full"
            />
          </div>

          <div v-else-if="item.url && item.previewable" class="overflow-hidden rounded-xl border border-white/10 bg-slate-900">
            <iframe
              :src="item.url"
              class="h-96 w-full border-0"
              title="Document proof preview"
            />
          </div>

          <p v-else-if="item.url" class="text-xs text-slate-400 font-regular">
            This document format cannot be embedded directly. Use the button above to view it.
          </p>

          <p v-else class="text-xs text-rose-400 font-semibold">
            The signed link for this proof could not be generated.
          </p>
        </div>
      </div>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  IonButtons,
  IonContent,
  IonHeader,
  IonModal,
  IonSpinner,
  IonTitle,
  IonToolbar
} from '@ionic/vue'
import { useAccomplishmentsStore } from '@/stores/accomplishments'
import type {
  AccomplishmentProof,
  AccomplishmentReport,
  ProofKind
} from '@/types'

interface ViewerItem {
  key: string
  label: string
  kind: ProofKind
  url: string | null
  external: boolean
  previewable: boolean
}

const props = defineProps<{
  isOpen: boolean
  report: AccomplishmentReport | null
}>()

const emit = defineEmits<{ 'update:isOpen': [value: boolean] }>()

const accomplishments = useAccomplishmentsStore()
const items = ref<ViewerItem[]>([])
const loading = ref(false)
const errorMessage = ref('')

function formatDate(value: string): string {
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`)
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

function labelFor(proof: AccomplishmentProof): string {
  if (proof.file_name) {
    return proof.file_name
  }
  if (proof.external_url) {
    return proof.external_url
  }
  return `${proof.kind} proof`
}

async function resolve(proof: AccomplishmentProof): Promise<ViewerItem> {
  let url: string | null = proof.external_url
  if (!url && proof.storage_path) {
    try {
      url = await accomplishments.proofUrl(proof)
    } catch {
      url = null
    }
  }
  return {
    key: proof.id,
    label: labelFor(proof),
    kind: proof.kind,
    url,
    external: Boolean(proof.external_url),
    previewable: proof.mime_type === 'application/pdf'
  }
}

async function load(): Promise<void> {
  items.value = []
  errorMessage.value = ''
  const report = props.report
  const proofs = report?.proofs ?? []

  if (!report || !proofs.length) {
    return
  }

  loading.value = true
  try {
    items.value = await Promise.all(proofs.map((proof) => resolve(proof)))
  } catch (err) {
    errorMessage.value =
      err instanceof Error ? err.message : 'Unable to load proof attachments.'
  } finally {
    loading.value = false
  }
}

function openItem(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer')
}

watch(
  () => [props.isOpen, props.report?.id],
  ([open]) => {
    if (open) {
      void load()
    }
  },
  { immediate: true }
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

.pill-btn-outline {
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(255, 255, 255, 0.25) !important;
  color: #ffffff !important;
  border-radius: 9999px !important;
  padding: 6px 14px !important;
  font-size: 11.5px !important;
  font-weight: 800 !important;
  cursor: pointer !important;
}

.pill-btn-outline:hover {
  border-color: #00C2FF !important;
  color: #00C2FF !important;
}

.badge-pill {
  display: inline-flex !important;
  align-items: center !important;
  padding: 4px 10px !important;
  border-radius: 9999px !important;
  font-size: 10.5px !important;
  font-weight: 800 !important;
}

.badge-pill-cyan {
  background: rgba(0, 194, 255, 0.16) !important;
  color: #00C2FF !important;
  border: 1px solid rgba(0, 194, 255, 0.35) !important;
}
</style>