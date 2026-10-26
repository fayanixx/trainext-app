import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { SafeCheckin, TransitPing } from '@/types'

function todayKey(): string {
  const current = new Date()
  const offset = current.getTimezoneOffset() * 60000
  return new Date(current.getTime() - offset).toISOString().slice(0, 10)
}

export const useSafetyStore = defineStore('safety', () => {
  const myCheckin = ref<SafeCheckin | null>(null)
  const checkins = ref<SafeCheckin[]>([])
  const pings = ref<TransitPing[]>([])
  const loading = ref(false)
  const error = ref('')

  let channel: RealtimeChannel | null = null

  async function fetchMyCheckin(internId: string): Promise<SafeCheckin | null> {
    const { data, error: fetchError } = await supabase
      .from('safe_checkins')
      .select('*')
      .eq('intern_id', internId)
      .eq('checkin_date', todayKey())
      .maybeSingle()

    if (fetchError) {
      error.value = fetchError.message
      throw fetchError
    }

    myCheckin.value = (data as SafeCheckin | null) ?? null
    return myCheckin.value
  }

  async function checkIn(
    baseLabel: string,
    latitude: number | null,
    longitude: number | null
  ): Promise<SafeCheckin> {
    loading.value = true
    error.value = ''

    try {
      const { data, error: checkinError } = await supabase.rpc('safe_check_in', {
        p_base_label: baseLabel.trim() || null,
        p_latitude: latitude,
        p_longitude: longitude,
        p_checkin_date: todayKey()
      })

      if (checkinError) {
        throw checkinError
      }

      const created = data as SafeCheckin
      myCheckin.value = created
      checkins.value = [
        created,
        ...checkins.value.filter((item) => item.id !== created.id)
      ]
      return created
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'Unable to record safe check-in.'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function fetchCoordinatorData(internIds: string[]): Promise<void> {
    loading.value = true
    error.value = ''

    try {
      if (!internIds.length) {
        checkins.value = []
        pings.value = []
        return
      }

      const [checkinResult, pingResult] = await Promise.all([
        supabase
          .from('safe_checkins')
          .select('*')
          .in('intern_id', internIds)
          .eq('checkin_date', todayKey())
          .order('checkin_at', { ascending: false }),
        supabase
          .from('transit_pings')
          .select('*')
          .in('intern_id', internIds)
          .order('created_at', { ascending: false })
          .limit(200)
      ])

      if (checkinResult.error) {
        throw checkinResult.error
      }
      if (pingResult.error) {
        throw pingResult.error
      }

      checkins.value = (checkinResult.data ?? []) as SafeCheckin[]
      pings.value = (pingResult.data ?? []) as TransitPing[]
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'Unable to load transit safety data.'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function pingIntern(
    internId: string,
    message: string
  ): Promise<TransitPing> {
    error.value = ''
    const { data, error: pingError } = await supabase.rpc('ping_intern', {
      p_intern_id: internId,
      p_message: message.trim() || null
    })

    if (pingError) {
      error.value = pingError.message
      throw pingError
    }

    const created = data as TransitPing
    pings.value = [created, ...pings.value]
    return created
  }

  function subscribeCoordinator(onChange: () => void): void {
    unsubscribe()
    channel = supabase
      .channel('coordinator-transit')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'safe_checkins' },
        onChange
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance_logs' },
        onChange
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transit_pings' },
        onChange
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
    myCheckin.value = null
    checkins.value = []
    pings.value = []
    error.value = ''
  }

  return {
    myCheckin,
    checkins,
    pings,
    loading,
    error,
    fetchMyCheckin,
    checkIn,
    fetchCoordinatorData,
    pingIntern,
    subscribeCoordinator,
    unsubscribe,
    clear
  }
})
