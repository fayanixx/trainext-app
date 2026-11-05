import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { supabase } from '@/lib/supabase';
import type { AttendanceLog } from '@/types';

export const useAttendanceStore = defineStore('attendance', () => {
  /**
   * Reactive Attendance State
   */
  const activeShift = ref<AttendanceLog | null>(null);
  const attendanceHistory = ref<AttendanceLog[]>([]);
  const loading = ref(false);
  const errorMessage = ref<string | null>(null);

  /**
   * Computed Session Statuses para sa 4-Time Entry System
   */
  const hasAMIn = computed(() => !!activeShift.value?.am_arrival);
  const hasAMOut = computed(() => !!activeShift.value?.am_departure);
  const hasPMIn = computed(() => !!activeShift.value?.pm_arrival);
  const hasPMOut = computed(() => !!activeShift.value?.pm_departure);

  const hasCompletedShiftToday = computed(() => {
    return hasAMIn.value && hasAMOut.value && hasPMIn.value && hasPMOut.value;
  });

  /**
   * Fetches active shift log for the specified intern on the current calendar date
   */
  const fetchTodayShift = async (internId: string) => {
    if (!internId) return null;
    loading.value = true;
    errorMessage.value = null;

    try {
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('intern_id', internId)
        .eq('date', today)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      activeShift.value = (data as AttendanceLog) || null;
      return activeShift.value;
    } catch (err: any) {
      console.error('Error fetching today attendance:', err.message);
      errorMessage.value = err.message;
      return null;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Universal Time Logging para sa Apat na Time Slots (AM In, AM Out, PM In, PM Out)
   */
  const logAttendanceTime = async (params: {
    internId: string;
    slot: 'am_arrival' | 'am_departure' | 'pm_arrival' | 'pm_departure';
    latitude?: number;
    longitude?: number;
  }) => {
    loading.value = true;
    errorMessage.value = null;

    try {
      const today = new Date().toISOString().split('T')[0];
      const currentTimeIso = new Date().toTimeString().split(' ')[0]; // HH:MM:SS format para sa TIME column

      // Kung wala pang record ngayong araw at AM In ang kailangan, gumawa ng bagong row
      if (!activeShift.value) {
        if (params.slot !== 'am_arrival') {
          throw new Error('Kailangan munang mag-Time In (AM Arrival) ngayong umaga.');
        }

        const insertPayload: Record<string, any> = {
          intern_id: params.internId,
          date: today,
          am_arrival: currentTimeIso,
          time_in_lat: params.latitude,
          time_in_lng: params.longitude,
        };

        const { data, error } = await supabase
          .from('attendance_logs')
          .insert([insertPayload])
          .select()
          .single();

        if (error) throw error;
        activeShift.value = data as AttendanceLog;
      } else {
        // I-update ang umiiral na attendance log depende sa slot
        const updatePayload: Record<string, any> = {};
        
        if (params.slot === 'am_arrival') {
          if (activeShift.value.am_arrival) throw new Error('Mayroon nang AM Arrival record.');
          updatePayload.am_arrival = currentTimeIso;
        } else if (params.slot === 'am_departure') {
          if (activeShift.value.am_departure) throw new Error('Mayroon nang AM Departure record.');
          updatePayload.am_departure = currentTimeIso;
        } else if (params.slot === 'pm_arrival') {
          if (activeShift.value.pm_arrival) throw new Error('Mayroon nang PM Arrival record.');
          updatePayload.pm_arrival = currentTimeIso;
        } else if (params.slot === 'pm_departure') {
          if (activeShift.value.pm_departure) throw new Error('Mayroon nang PM Departure record.');
          updatePayload.pm_departure = currentTimeIso;
          
          // Kalkulahin din ang kabuuang oras o undertime kung kinakailangan dito
        }

        if (params.latitude !== undefined) {
          if (params.slot === 'am_arrival') updatePayload.time_in_lat = params.latitude;
          if (params.slot === 'pm_departure') updatePayload.time_out_lat = params.latitude;
        }
        if (params.longitude !== undefined) {
          if (params.slot === 'am_arrival') updatePayload.time_in_lng = params.longitude;
          if (params.slot === 'pm_departure') updatePayload.time_out_lng = params.longitude;
        }

        const { data, error } = await supabase
          .from('attendance_logs')
          .update(updatePayload)
          .eq('id', activeShift.value.id)
          .select()
          .single();

        if (error) throw error;
        activeShift.value = data as AttendanceLog;
      }

      await fetchAttendanceHistory(params.internId);
      return activeShift.value;
    } catch (err: any) {
      errorMessage.value = err.message || 'Nabigong maitala ang oras.';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Fetches historical attendance logs for an intern ordered chronologically
   */
  const fetchAttendanceHistory = async (internId: string) => {
    if (!internId) return [];
    loading.value = true;

    try {
      const { data, error } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('intern_id', internId)
        .order('date', { ascending: false });

      if (error) throw error;
      attendanceHistory.value = (data as AttendanceLog[]) || [];
      return attendanceHistory.value;
    } catch (err: any) {
      console.error('Error fetching attendance history:', err.message);
      return [];
    } finally {
      loading.value = false;
    }
  };

  return {
    activeShift,
    attendanceHistory,
    loading,
    errorMessage,
    hasAMIn,
    hasAMOut,
    hasPMIn,
    hasPMOut,
    hasCompletedShiftToday,
    fetchTodayShift,
    logAttendanceTime,
    fetchAttendanceHistory,
  };
});