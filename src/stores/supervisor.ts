import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import {
  sendReviewNotification,
  sendVerificationNotification,
  type EmailResult
} from '@/lib/email'
import type {
  AccomplishmentReport,
  ApprovalStatus,
  AttendanceLog,
  InternProgress
} from '@/types'

type ReviewStatus = Exclude<ApprovalStatus, 'pending'>

export interface ReviewResult<T> {
  record: T
  email: EmailResult
}

export const useSupervisorStore = defineStore('supervisor', () => {
  const auth = useAuthStore()
  const interns = ref<InternProgress[]>([])
  const pendingLogs = ref<AttendanceLog[]>([])
  const pendingReports = ref<AccomplishmentReport[]>([])
  const loading = ref(false)
  const error = ref('')

  const totalPending = computed(
    () => pendingLogs.value.length + pendingReports.value.length
  )
  const assignedInterns = computed(() =>
    interns.value.filter((intern) => intern.supervisor_id === auth.profile?.id)
  )
  const unassignedInterns = computed(() =>
    interns.value.filter((intern) => !intern.supervisor_id)
  )
  const visibleInterns = computed(() => [
    ...assignedInterns.value,
    ...unassignedInterns.value
  ])
  const pendingDeploymentCount = computed(
    () =>
      assignedInterns.value.filter(
        (intern) => intern.deployment_status === 'pending'
      ).length
  )

  function internById(id: string): InternProgress | undefined {
    return interns.value.find((intern) => intern.intern_id === id)
  }

  async function fetchProgress(): Promise<InternProgress[]> {
    const { data, error: progressError } = await supabase
      .from('intern_progress')
      .select('*')
      .order('full_name', { ascending: true })

    if (progressError) {
      throw progressError
    }

    interns.value = (data ?? []) as InternProgress[]
    return interns.value
  }

  async function fetchPendingLogs(): Promise<AttendanceLog[]> {
    const { data, error: logsError } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('status', 'pending')
      .not('clock_out_at', 'is', null)
      .order('clock_in_at', { ascending: true })

    if (logsError) {
      throw logsError
    }

    pendingLogs.value = (data ?? []) as AttendanceLog[]
    return pendingLogs.value
  }

  async function fetchPendingReports(): Promise<AccomplishmentReport[]> {
      const { data, error: reportsError } = await supabase
        .from('accomplishment_reports')
        .select('*, proofs:accomplishment_proofs(*)')
        .eq('status', 'pending')
        .order('report_date', { ascending: true })

    if (reportsError) {
      throw reportsError
    }

    pendingReports.value = (data ?? []) as AccomplishmentReport[]
    return pendingReports.value
  }

  async function fetchDashboard(): Promise<void> {
    loading.value = true
    error.value = ''

    try {
      await Promise.all([fetchProgress(), fetchPendingLogs(), fetchPendingReports()])
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'Unable to load supervisor dashboard.'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function reviewAttendance(
    log: AttendanceLog,
    status: ReviewStatus,
    feedback: string,
    reviewerName: string
  ): Promise<ReviewResult<AttendanceLog>> {
    error.value = ''

    const { data, error: reviewError } = await supabase.rpc('review_attendance', {
      p_log_id: log.id,
      p_status: status,
      p_feedback: feedback.trim() || null
    })

    if (reviewError) {
      error.value = reviewError.message
      throw reviewError
    }

    const record = data as AttendanceLog
    const intern = internById(log.intern_id)
    const email = await sendReviewNotification({
      internEmail: intern?.email ?? '',
      internName: intern?.full_name ?? 'Intern',
      reviewerName,
      itemType: 'attendance log',
      itemDetails:
        `Attendance on ${new Date(log.clock_in_at).toLocaleString()} ` +
        `rendered ${Number(log.hours_rendered).toFixed(2)} hour(s).`,
      status,
      feedback: feedback.trim() || null
    })

    pendingLogs.value = pendingLogs.value.filter((item) => item.id !== log.id)
    await fetchProgress()

    return { record, email }
  }

  async function reviewReport(
    report: AccomplishmentReport,
    status: ReviewStatus,
    feedback: string,
    reviewerName: string
  ): Promise<ReviewResult<AccomplishmentReport>> {
    error.value = ''

    const { data, error: reviewError } = await supabase.rpc(
      'review_accomplishment',
      {
        p_report_id: report.id,
        p_status: status,
        p_feedback: feedback.trim() || null
      }
    )

    if (reviewError) {
      error.value = reviewError.message
      throw reviewError
    }

    const record = data as AccomplishmentReport
    const intern = internById(report.intern_id)
    const email = await sendReviewNotification({
      internEmail: intern?.email ?? '',
      internName: intern?.full_name ?? 'Intern',
      reviewerName,
      itemType: 'accomplishment report',
      itemDetails:
        `"${report.title}" for ${new Date(report.report_date).toLocaleDateString()} ` +
        `(${Number(report.hours_spent).toFixed(2)} hour(s) logged).`,
      status,
      feedback: feedback.trim() || null
    })

    pendingReports.value = pendingReports.value.filter(
      (item) => item.id !== report.id
    )
    await fetchProgress()

    return { record, email }
  }

  async function reviewDeployment(
    intern: InternProgress,
    status: ReviewStatus,
    feedback: string,
    reviewerName: string
  ): Promise<ReviewResult<InternProgress>> {
    error.value = ''

    const { data, error: reviewError } = await supabase.rpc('review_deployment', {
      p_intern_id: intern.intern_id,
      p_status: status,
      p_feedback: feedback.trim() || null
    })

    if (reviewError) {
      error.value = reviewError.message
      throw reviewError
    }

    const record = data as InternProgress
    const email = await sendVerificationNotification({
      internEmail: intern.email,
      internName: intern.full_name,
      reviewerName,
      stage: 'company deployment',
      status,
      details:
        `${intern.company_name || auth.profile?.company_name || 'Company'} deployment ` +
        `review for ${intern.full_name}.`,
      feedback: feedback.trim() || null
    })

    await fetchProgress()
    return { record, email }
  }

  async function reviewReportsBatch(
    items: AccomplishmentReport[],
    status: ReviewStatus,
    feedback: string,
    reviewerName: string
  ): Promise<{ processed: number; emailed: number; failures: string[] }> {
    let processed = 0
    let emailed = 0
    const failures: string[] = []

    for (const item of items) {
      try {
        const result = await reviewReport(item, status, feedback, reviewerName)
        processed += 1
        if (result.email.sent) {
          emailed += 1
        }
      } catch (err) {
        failures.push(
          `${item.title}: ${err instanceof Error ? err.message : 'review failed'}`
        )
      }
    }

    return { processed, emailed, failures }
  }

  async function reviewLogsBatch(
    items: AttendanceLog[],
    status: ReviewStatus,
    feedback: string,
    reviewerName: string
  ): Promise<{ processed: number; emailed: number; failures: string[] }> {
    let processed = 0
    let emailed = 0
    const failures: string[] = []

    for (const item of items) {
      try {
        const result = await reviewAttendance(item, status, feedback, reviewerName)
        processed += 1
        if (result.email.sent) {
          emailed += 1
        }
      } catch (err) {
        failures.push(
          `Attendance ${new Date(item.clock_in_at).toLocaleDateString()}: ${
            err instanceof Error ? err.message : 'review failed'
          }`
        )
      }
    }

    return { processed, emailed, failures }
  }

  async function assignIntern(
    internId: string,
    siteId: string | null,
    requiredHours: number
  ): Promise<void> {
    error.value = ''

    const { error: assignError } = await supabase.rpc('assign_intern', {
      p_intern_id: internId,
      p_site_id: siteId,
      p_required_hours: requiredHours
    })

    if (assignError) {
      error.value = assignError.message
      throw assignError
    }

    await Promise.all([fetchProgress(), fetchPendingLogs(), fetchPendingReports()])
  }

  function clear(): void {
    interns.value = []
    pendingLogs.value = []
    pendingReports.value = []
    error.value = ''
  }

  return {
    interns,
    pendingLogs,
    pendingReports,
    loading,
    error,
    totalPending,
    assignedInterns,
    unassignedInterns,
    visibleInterns,
    pendingDeploymentCount,
    internById,
    fetchProgress,
    fetchPendingLogs,
    fetchPendingReports,
    fetchDashboard,
    reviewAttendance,
    reviewReport,
    reviewDeployment,
    reviewReportsBatch,
    reviewLogsBatch,
    assignIntern,
    clear
  }
})
