import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type {
  AccomplishmentProof,
  AccomplishmentReport,
  ProofKind
} from '@/types'

const PROOF_BUCKET = 'accomplishment-proofs'
const MAX_PROOF_BYTES = 50 * 1024 * 1024

export interface NewAccomplishmentReport {
  report_date: string
  title: string
  tasks: string
  hours_spent: number
  attendance_log_id?: string | null
  files?: File[]
  links?: string[]
}

function kindForFile(file: File): ProofKind {
  if (file.type.startsWith('image/')) {
    return 'image'
  }
  if (file.type.startsWith('video/')) {
    return 'video'
  }
  return 'document'
}

function kindForLink(url: string): ProofKind {
  const lower = url.toLowerCase()
  if (/\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/.test(lower)) {
    return 'image'
  }
  if (
    /\.(mp4|webm|mov|avi|mkv)(\?.*)?$/.test(lower) ||
    /youtube\.com|youtu\.be|vimeo\.com/.test(lower)
  ) {
    return 'video'
  }
  return 'document'
}

function extensionFor(file: File): string {
  const fromName = file.name.split('.').pop()
  if (fromName && fromName.length <= 8) {
    return fromName.toLowerCase()
  }
  if (file.type === 'application/pdf') {
    return 'pdf'
  }
  return 'bin'
}

function normalizeLink(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) {
    return ''
  }
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`
  const parsed = new URL(withProtocol)
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Proof links must use http or https.')
  }
  return parsed.toString()
}

export const useAccomplishmentsStore = defineStore('accomplishments', () => {
  const reports = ref<AccomplishmentReport[]>([])
  const loading = ref(false)
  const error = ref('')

  let channel: RealtimeChannel | null = null

  const approvedCount = computed(
    () => reports.value.filter((report) => report.status === 'approved').length
  )
  const pendingCount = computed(
    () => reports.value.filter((report) => report.status === 'pending').length
  )
  const proofCount = computed(() =>
    reports.value.reduce((total, report) => total + (report.proofs?.length ?? 0), 0)
  )

  async function fetchReports(internId: string): Promise<AccomplishmentReport[]> {
    loading.value = true
    error.value = ''

    try {
      const { data, error: fetchError } = await supabase
        .from('accomplishment_reports')
        .select('*, proofs:accomplishment_proofs(*)')
        .eq('intern_id', internId)
        .order('report_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (fetchError) {
        throw fetchError
      }

      reports.value = (data ?? []) as AccomplishmentReport[]
      return reports.value
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'Unable to load accomplishment reports.'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function uploadProofs(
    internId: string,
    reportId: string,
    files: File[],
    links: string[]
  ): Promise<AccomplishmentProof[]> {
    const rows: Array<Omit<AccomplishmentProof, 'id' | 'created_at'>> = []

    for (const file of files) {
      if (file.size > MAX_PROOF_BYTES) {
        throw new Error(`${file.name} exceeds the 50 MB proof limit.`)
      }
      const ext = extensionFor(file)
      const path = `${internId}/${reportId}/${crypto.randomUUID()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from(PROOF_BUCKET)
        .upload(path, file, {
          contentType: file.type || 'application/octet-stream',
          upsert: false
        })
      if (uploadError) {
        throw uploadError
      }
      rows.push({
        report_id: reportId,
        intern_id: internId,
        kind: kindForFile(file),
        storage_path: path,
        external_url: null,
        file_name: file.name,
        mime_type: file.type || null
      })
    }

    for (const raw of links) {
      const url = normalizeLink(raw)
      if (!url) {
        continue
      }
      rows.push({
        report_id: reportId,
        intern_id: internId,
        kind: kindForLink(url),
        storage_path: null,
        external_url: url,
        file_name: url,
        mime_type: null
      })
    }

    if (!rows.length) {
      return []
    }

    const { data, error: proofError } = await supabase
      .from('accomplishment_proofs')
      .insert(rows)
      .select()

    if (proofError) {
      throw proofError
    }

    return (data ?? []) as AccomplishmentProof[]
  }

  async function submitReport(
    internId: string,
    input: NewAccomplishmentReport
  ): Promise<AccomplishmentReport> {
    loading.value = true
    error.value = ''

    try {
      const { data, error: submitError } = await supabase
        .from('accomplishment_reports')
        .insert({
          intern_id: internId,
          report_date: input.report_date,
          title: input.title.trim(),
          tasks: input.tasks.trim(),
          hours_spent: input.hours_spent,
          attendance_log_id: input.attendance_log_id ?? null
        })
        .select()
        .single()

      if (submitError) {
        throw submitError
      }

      const created = data as AccomplishmentReport
      created.proofs = await uploadProofs(
        internId,
        created.id,
        input.files ?? [],
        input.links ?? []
      )
      reports.value = [created, ...reports.value]
      return created
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'Unable to submit accomplishment report.'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function deleteReport(id: string): Promise<void> {
    error.value = ''
    const report = reports.value.find((item) => item.id === id)
    const paths =
      report?.proofs
        ?.map((proof) => proof.storage_path)
        .filter((path): path is string => Boolean(path)) ?? []

    if (paths.length) {
      await supabase.storage.from(PROOF_BUCKET).remove(paths)
    }

    const { error: deleteError } = await supabase
      .from('accomplishment_reports')
      .delete()
      .eq('id', id)

    if (deleteError) {
      error.value = deleteError.message
      throw deleteError
    }

    reports.value = reports.value.filter((item) => item.id !== id)
  }

  async function proofUrl(proof: AccomplishmentProof): Promise<string | null> {
    if (proof.external_url) {
      return proof.external_url
    }
    if (!proof.storage_path) {
      return null
    }
    const { data, error: signError } = await supabase.storage
      .from(PROOF_BUCKET)
      .createSignedUrl(proof.storage_path, 3600)
    if (signError) {
      throw signError
    }
    return data.signedUrl
  }

  function subscribe(internId: string): void {
    unsubscribe()
    channel = supabase
      .channel(`reports-${internId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'accomplishment_reports',
          filter: `intern_id=eq.${internId}`
        },
        () => {
          void fetchReports(internId)
        }
      )
      .subscribe()
  }

  function unsubscribe(): void {
    if (channel) {
      void supabase.removeChannel(channel)
      channel = null
    }
  }

  function clear(): void {
    unsubscribe()
    reports.value = []
    error.value = ''
  }

  return {
    reports,
    loading,
    error,
    approvedCount,
    pendingCount,
    proofCount,
    fetchReports,
    submitReport,
    deleteReport,
    proofUrl,
    subscribe,
    unsubscribe,
    clear
  }
})
