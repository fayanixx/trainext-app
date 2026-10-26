import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { AttendanceLog, GeoPosition } from '@/types'

export const useAttendanceStore = defineStore('attendance', () => {
  const logs = ref<AttendanceLog[]>([])
  const loading = ref(false)
  const error = ref('')

  let channel: RealtimeChannel | null = null

  const openLog = computed(
    () => logs.value.find((log) => log.clock_out_at === null) ?? null
  )
  const approvedHours = computed(() =>
    logs.value
      .filter((log) => log.status === 'approved')
      .reduce((total, log) => total + Number(log.hours_rendered || 0), 0)
  )
  const pendingHours = computed(() =>
    logs.value
      .filter((log) => log.status === 'pending' && log.clock_out_at !== null)
      .reduce((total, log) => total + Number(log.hours_rendered || 0), 0)
  )
  const totalLoggedHours = computed(() =>
    logs.value
      .filter((log) => log.clock_out_at !== null)
      .reduce((total, log) => total + Number(log.hours_rendered || 0), 0)
  )
  const pendingReviewCount = computed(
    () => logs.value.filter((log) => log.status === 'pending').length
  )

  async function fetchLogs(internId: string): Promise<AttendanceLog[]> {
    loading.value = true
    error.value = ''

    try {
      const { data, error: fetchError } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('intern_id', internId)
        .order('clock_in_at', { ascending: false })

      if (fetchError) {
        throw fetchError
      }

      logs.value = (data ?? []) as AttendanceLog[]
      return logs.value
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unable to load attendance logs.'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function clockIn(
    siteId: string,
    position: GeoPosition
  ): Promise<AttendanceLog> {
    loading.value = true
    error.value = ''

    try {
      const { data, error: clockError } = await supabase.rpc('clock_in', {
        p_site_id: siteId,
        p_latitude: position.latitude,
        p_longitude: position.longitude
      })

      if (clockError) {
        throw clockError
      }

      const created = data as AttendanceLog
      logs.value = [created, ...logs.value.filter((log) => log.id !== created.id)]
      return created
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Clock-in failed.'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function clockOut(position: GeoPosition): Promise<AttendanceLog> {
    loading.value = true
    error.value = ''

    try {
      const { data, error: clockError } = await supabase.rpc('clock_out', {
        p_latitude: position.latitude,
        p_longitude: position.longitude
      })

      if (clockError) {
        throw clockError
      }

      const updated = data as AttendanceLog
      logs.value = logs.value.map((log) => (log.id === updated.id ? updated : log))
      return updated
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Clock-out failed.'
      throw err
    } finally {
      loading.value = false
    }
  }

  function subscribe(internId: string): void {
    unsubscribe()
    channel = supabase
      .channel(`attendance-${internId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance_logs',
          filter: `intern_id=eq.${internId}`
        },
        () => {
          void fetchLogs(internId)
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
    logs.value = []
    error.value = ''
  }

  return {
    logs,
    loading,
    error,
    openLog,
    approvedHours,
    pendingHours,
    totalLoggedHours,
    pendingReviewCount,
    fetchLogs,
    clockIn,
    clockOut,
    subscribe,
    unsubscribe,
    clear
  }
})
