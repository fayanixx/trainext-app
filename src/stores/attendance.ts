import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { supabase } from '@/lib/supabase';
import type { AttendanceLog } from '@/types';

export const useAttendanceStore = defineStore('attendance', () => {
  const activeShift = ref<AttendanceLog | null>(null);
  const attendanceHistory = ref<AttendanceLog[]>([]);
  const loading = ref(false);
  const errorMessage = ref<string | null>(null);

  const hasAMIn = computed(() => !!activeShift.value?.am_arrival);
  const hasAMOut = computed(() => !!activeShift.value?.am_departure);
  const hasPMIn = computed(() => !!activeShift.value?.pm_arrival);
  const hasPMOut = computed(() => !!activeShift.value?.pm_departure);

  const hasCompletedShiftToday = computed(() => {
    return hasAMIn.value && hasAMOut.value && hasPMIn.value && hasPMOut.value;
  });

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

  const logAttendanceTime = async (params: {
    internId: string;
    slot: 'am_arrival' | 'am_departure' | 'pm_arrival' | 'pm_departure';
    latitude?: number;
    longitude?: number;
  }) => {
    loading.value = true;
    errorMessage.value = null;

    try {
      const now = new Date();
      const currentHour = now.getHours();

      if (params.slot === 'am_arrival' || params.slot === 'am_departure') {
        if (currentHour >= 12) {
          throw new Error('AM attendance is restricted between 12:00 AM and 11:59 AM.');
        }
      } else if (params.slot === 'pm_arrival' || params.slot === 'pm_departure') {
        if (currentHour < 12) {
          throw new Error('PM attendance opens starting at 12:00 PM.');
        }
      }

      const today = now.toISOString().split('T')[0];
      const currentTimeIso = now.toTimeString().split(' ')[0];

      if (!activeShift.value) {
        const insertPayload: Record<string, any> = {
          intern_id: params.internId,
          date: today,
        };

        if (params.slot === 'am_arrival') {
          insertPayload.am_arrival = currentTimeIso;
          insertPayload.time_in_lat = params.latitude;
          insertPayload.time_in_lng = params.longitude;
        } else if (params.slot === 'pm_arrival') {
          insertPayload.pm_arrival = currentTimeIso;
          insertPayload.time_in_lat = params.latitude;
          insertPayload.time_in_lng = params.longitude;
        } else {
          throw new Error('Time in must be recorded before logging departure.');
        }

        const { data, error } = await supabase
          .from('attendance_logs')
          .insert([insertPayload])
          .select()
          .single();

        if (error) throw error;
        activeShift.value = data as AttendanceLog;
      } else {
        const updatePayload: Record<string, any> = {};
        
        if (params.slot === 'am_arrival') {
          if (activeShift.value.am_arrival) throw new Error('AM Arrival has already been recorded.');
          updatePayload.am_arrival = currentTimeIso;
        } else if (params.slot === 'am_departure') {
          if (activeShift.value.am_departure) throw new Error('AM Departure has already been recorded.');
          updatePayload.am_departure = currentTimeIso;
        } else if (params.slot === 'pm_arrival') {
          if (activeShift.value.pm_arrival) throw new Error('PM Arrival has already been recorded.');
          updatePayload.pm_arrival = currentTimeIso;
        } else if (params.slot === 'pm_departure') {
          if (activeShift.value.pm_departure) throw new Error('PM Departure has already been recorded.');
          updatePayload.pm_departure = currentTimeIso;
        }

        if (params.latitude !== undefined) {
          if (params.slot === 'am_arrival' || params.slot === 'pm_arrival') updatePayload.time_in_lat = params.latitude;
          if (params.slot === 'am_departure' || params.slot === 'pm_departure') updatePayload.time_out_lat = params.latitude;
        }
        if (params.longitude !== undefined) {
          if (params.slot === 'am_arrival' || params.slot === 'pm_arrival') updatePayload.time_in_lng = params.longitude;
          if (params.slot === 'am_departure' || params.slot === 'pm_departure') updatePayload.time_out_lng = params.longitude;
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
      errorMessage.value = err.message || 'Failed to record attendance time.';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const confirmSafeAtBase = async (params: {
    logId?: string;
    internId?: string;
    transitNotes?: string;
    latitude?: number;
    longitude?: number;
  }) => {
    loading.value = true;
    errorMessage.value = null;

    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const currentTimeIso = now.toTimeString().split(' ')[0]; // FIXED: Local time format matching other logs

      const updatePayload: Record<string, any> = {
        status: 'safe_at_base',
        safe_at_base_time: currentTimeIso,
      };

      if (params.transitNotes) {
        updatePayload.transit_notes = params.transitNotes;
      }
      if (params.latitude !== undefined) {
        updatePayload.safe_location_lat = params.latitude;
      }
      if (params.longitude !== undefined) {
        updatePayload.safe_location_lng = params.longitude;
      }

      let targetLogId = params.logId;

      if (!targetLogId && params.internId) {
        if (activeShift.value && activeShift.value.intern_id === params.internId) {
          targetLogId = activeShift.value.id;
        } else {
          const { data: existingLog } = await supabase
            .from('attendance_logs')
            .select('id')
            .eq('intern_id', params.internId)
            .eq('date', today)
            .maybeSingle();

          if (existingLog) {
            targetLogId = existingLog.id;
          }
        }
      }

      if (!targetLogId) {
        throw new Error('No active attendance log found to update.');
      }

      const { data, error } = await supabase
        .from('attendance_logs')
        .update(updatePayload)
        .eq('id', targetLogId)
        .select()
        .single();

      if (error) throw error;

      if (activeShift.value && activeShift.value.id === targetLogId) {
        activeShift.value = data as AttendanceLog;
      }

      return data;
    } catch (err: any) {
      errorMessage.value = err.message || 'Failed to confirm Safe at Base status.';
      throw err;
    } finally {
      loading.value = false;
    }
  };

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
    confirmSafeAtBase,
    fetchAttendanceHistory,
  };
});