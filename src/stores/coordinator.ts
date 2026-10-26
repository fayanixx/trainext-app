import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useSafetyStore } from '@/stores/safety'
import {
  sendVerificationNotification,
  type EmailResult
} from '@/lib/email'
import type {
  AccomplishmentReport,
  ApprovalStatus,
  AttendanceLog,
  InternProgress,
  SafeCheckin,
  TransitFeedRow,
  TransitState
} from '@/types'

type ReviewStatus = Exclude<ApprovalStatus, 'pending'>

export interface EnrollmentResult {
  record: InternProgress
  email: EmailResult
}

const TRANSIT_GRACE_MS = 90 * 60 * 1000

function localDayKey(value: string): string {
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

function todayKey(): string {
  return localDayKey(new Date().toISOString())
}

export const useCoordinatorStore = defineStore('coordinator', () => {
  const auth = useAuthStore()
  const safety = useSafetyStore()
  const interns = ref<InternProgress[]>([])
  const logs = ref<AttendanceLog[]>([])
  const loading = ref(false)
  const error = ref('')

  const linkedInterns = computed(() =>
    interns.value.filter((intern) => intern.coordinator_id === auth.profile?.id)
  )
  const pendingEnrollmentCount = computed(
    () =>
      linkedInterns.value.filter((intern) => intern.enrollment_status === 'pending')
        .length
  )
  const linkedIds = computed(() => linkedInterns.value.map((intern) => intern.intern_id))

  const feed = computed<TransitFeedRow[]>(() => {
    const now = Date.now()
    return linkedInterns.value.map((intern) => {
      const checkin =
        safety.checkins.find((item) => item.intern_id === intern.intern_id) ?? null
      const internLogs = logs.value
        .filter((item) => item.intern_id === intern.intern_id)
        .sort(
          (a, b) =>
            new Date(b.clock_in_at).getTime() - new Date(a.clock_in_at).getTime()
        )
      const openLog = internLogs.find((item) => item.clock_out_at === null) ?? null
      const lastLog = internLogs[0] ?? null
      const lastPing =
        safety.pings.find((item) => item.intern_id === intern.intern_id) ?? null

      let state: TransitState = 'delayed'
      if (checkin) {
        state = 'safe'
      } else if (openLog) {
        state = 'in_transit'
      } else if (
        lastLog?.clock_out_at &&
        now - new Date(lastLog.clock_out_at).getTime() < TRANSIT_GRACE_MS
      ) {
        state = 'in_transit'
      }

      return {
        intern,
        state,
        checkin,
        openLog,
        lastLog,
        lastPing
      }
    })
  })

  const safeCount = computed(
    () => feed.value.filter((row) => row.state === 'safe').length
  )
  const inTransitCount = computed(
    () => feed.value.filter((row) => row.state === 'in_transit').length
  )
  const delayedCount = computed(
    () => feed.value.filter((row) => row.state === 'delayed').length
  )

  function internById(id: string): InternProgress | undefined {
    return linkedInterns.value.find((intern) => intern.intern_id === id)
  }

  async function fetchInterns(): Promise<InternProgress[]> {
    if (!auth.profile) {
      interns.value = []
      return []
    }

    const { data, error: fetchError } = await supabase
      .from('intern_progress')
      .select('*')
      .eq('coordinator_id', auth.profile.id)
      .order('full_name', { ascending: true })

    if (fetchError) {
      throw fetchError
    }

    interns.value = (data ?? []) as InternProgress[]
    return interns.value
  }

  async function fetchLogs(): Promise<void> {
    const ids = linkedIds.value
    if (!ids.length) {
      logs.value = []
      return
    }

    const { data, error: logError } = await supabase
      .from('attendance_logs')
      .select('*')
      .in('intern_id', ids)
      .order('clock_in_at', { ascending: false })
      .limit(1000)

    if (logError) {
      throw logError
    }

    logs.value = (data ?? []) as AttendanceLog[]
  }

  async function fetchDashboard(): Promise<void> {
    loading.value = true
    error.value = ''

    try {
      await fetchInterns()
      await Promise.all([
        fetchLogs(),
        safety.fetchCoordinatorData(linkedIds.value)
      ])
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'Unable to load coordinator dashboard.'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function reviewEnrollment(
    internId: string,
    status: ReviewStatus,
    feedback: string,
    reviewerName: string
  ): Promise<EnrollmentResult> {
    error.value = ''

    const { data, error: reviewError } = await supabase.rpc('review_enrollment', {
      p_intern_id: internId,
      p_status: status,
      p_feedback: feedback.trim() || null
    })

    if (reviewError) {
      error.value = reviewError.message
      throw reviewError
    }

    const record = data as InternProgress
    const current = internById(internId)
    const email = await sendVerificationNotification({
      internEmail: current?.email ?? record.email ?? '',
      internName: current?.full_name ?? record.full_name ?? 'Intern',
      reviewerName,
      stage: 'school enrollment',
      status,
      details:
        `${current?.university_name || 'Your school'} enrollment review for ` +
        `${current?.full_name || 'the intern'}.`,
      feedback: feedback.trim() || null
    })

    await fetchInterns()
    return { record, email }
  }

  async function fetchReportsForExport(): Promise<AccomplishmentReport[]> {
    const ids = linkedIds.value
    if (!ids.length) {
      return []
    }
    const { data, error: reportError } = await supabase
      .from('accomplishment_reports')
      .select('*, proofs:accomplishment_proofs(*)')
      .in('intern_id', ids)
      .order('report_date', { ascending: false })

    if (reportError) {
      throw reportError
    }
    return (data ?? []) as AccomplishmentReport[]
  }

  async function fetchSafetyForExport(): Promise<SafeCheckin[]> {
    const ids = linkedIds.value
    if (!ids.length) {
      return []
    }
    const { data, error: safetyError } = await supabase
      .from('safe_checkins')
      .select('*')
      .in('intern_id', ids)
      .order('checkin_at', { ascending: false })

    if (safetyError) {
      throw safetyError
    }
    return (data ?? []) as SafeCheckin[]
  }

  async function todayCheckins(): Promise<SafeCheckin[]> {
    const ids = linkedIds.value
    if (!ids.length) {
      return []
    }
    const { data, error: checkinError } = await supabase
      .from('safe_checkins')
      .select('*')
      .in('intern_id', ids)
      .eq('checkin_date', todayKey())
      .order('checkin_at', { ascending: false })

    if (checkinError) {
      throw checkinError
    }
    return (data ?? []) as SafeCheckin[]
  }

  function clear(): void {
    interns.value = []
    logs.value = []
    error.value = ''
  }

  return {
    interns,
    linkedInterns,
    logs,
    loading,
    error,
    pendingEnrollmentCount,
    linkedIds,
    feed,
    safeCount,
    inTransitCount,
    delayedCount,
    internById,
    fetchInterns,
    fetchLogs,
    fetchDashboard,
    reviewEnrollment,
    fetchReportsForExport,
    fetchSafetyForExport,
    todayCheckins,
    clear
  }
})
