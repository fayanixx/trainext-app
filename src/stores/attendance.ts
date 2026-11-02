import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { supabase } from '@/lib/supabase';
import { calculateHoursRendered } from '@/lib/geofence';
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
   * Computed Session Statuses
   */
  const isOnDuty = computed(() => activeShift.value?.status === 'on_duty');
  const isInTransit = computed(() => activeShift.value?.status === 'in_transit');
  const isSafeAtBase = computed(() => activeShift.value?.status === 'safe_at_base');
  const hasCompletedShiftToday = computed(() => {
    return (
      activeShift.value?.time_out !== null &&
      activeShift.value?.time_out !== undefined &&
      !isInTransit.value
    );
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
   * Records geofenced Time-In via Database RPC with anti-spoofing validation
   */
  const logTimeIn = async (params: {
    internId: string;
    latitude: number;
    longitude: number;
    supervisorId?: string;
    siteId?: string;
  }) => {
    loading.value = true;
    errorMessage.value = null;

    try {
      // Invoke Database RPC Procedure for Geofence & Anti-Spoofing Checks
      const { data, error } = await supabase.rpc('secure_clock_in', {
        p_intern_id: params.internId,
        p_latitude: params.latitude,
        p_longitude: params.longitude,
      });

      if (error) throw error;

      activeShift.value = data.log as AttendanceLog;
      await fetchAttendanceHistory(params.internId);
      return activeShift.value;
    } catch (err: any) {
      errorMessage.value = err.message || 'Failed to record Time In.';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Records Time-Out, computes total hours rendered, and transitions state to 'in_transit'
   */
  const logTimeOut = async (params?: {
    internId?: string;
    latitude?: number;
    longitude?: number;
  }) => {
    if (!activeShift.value?.id) {
      throw new Error('No active shift found to clock out from.');
    }

    loading.value = true;
    errorMessage.value = null;

    try {
      const timeOutIso = new Date().toISOString();
      let rendered = 0;

      const startTime = activeShift.value.time_in;
      if (typeof calculateHoursRendered === 'function' && startTime) {
        rendered = calculateHoursRendered(startTime, timeOutIso);
      } else if (startTime) {
        const diffMs = new Date(timeOutIso).getTime() - new Date(startTime).getTime();
        rendered = Math.max(0, parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2)));
      }

      const updatePayload: Record<string, any> = {
        time_out: timeOutIso,
        hours_rendered: rendered,
        status: 'in_transit',
      };

      if (params?.latitude !== undefined) {
        updatePayload.time_out_lat = params.latitude;
      }
      if (params?.longitude !== undefined) {
        updatePayload.time_out_lng = params.longitude;
      }

      const { data, error } = await supabase
        .from('attendance_logs')
        .update(updatePayload)
        .eq('id', activeShift.value.id)
        .select()
        .single();

      if (error) throw error;
      activeShift.value = data as AttendanceLog;

      const internId = params?.internId || activeShift.value.intern_id;
      if (internId) {
        await fetchAttendanceHistory(internId);
      }

      return activeShift.value;
    } catch (err: any) {
      errorMessage.value = err.message || 'Failed to record Time Out.';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Confirms intern arrival at safe quarters and updates shift status to 'safe_at_base'
   */
  const confirmSafeAtBase = async (params?: {
    logId?: string;
    internId?: string;
    latitude?: number;
    longitude?: number;
    transitNotes?: string;
  }) => {
    const targetLogId = params?.logId || activeShift.value?.id;
    if (!targetLogId) {
      throw new Error('No active transit record found.');
    }

    loading.value = true;
    errorMessage.value = null;

    try {
      const safeTimeIso = new Date().toISOString();

      const updatePayload: Record<string, any> = {
        status: 'safe_at_base',
        safe_at_base_time: safeTimeIso,
        transit_waiver_agreed: true,
      };

      if (params?.latitude !== undefined) {
        updatePayload.safe_location_lat = params.latitude;
      }
      if (params?.longitude !== undefined) {
        updatePayload.safe_location_lng = params.longitude;
      }
      if (params?.transitNotes) {
        updatePayload.transit_notes = params.transitNotes;
      }

      const { data, error } = await supabase
        .from('attendance_logs')
        .update(updatePayload)
        .eq('id', targetLogId)
        .select()
        .single();

      if (error) throw error;
      activeShift.value = data as AttendanceLog;

      const internId = params?.internId || activeShift.value.intern_id;
      if (internId) {
        await fetchAttendanceHistory(internId);
      }

      return activeShift.value;
    } catch (err: any) {
      errorMessage.value = err.message || 'Failed to record Safe at Base arrival.';
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
    isOnDuty,
    isInTransit,
    isSafeAtBase,
    hasCompletedShiftToday,
    fetchTodayShift,
    logTimeIn,
    timeIn: logTimeIn,
    logTimeOut,
    timeOut: logTimeOut,
    confirmSafeAtBase,
    markSafeAtBase: confirmSafeAtBase,
    fetchAttendanceHistory,
  };
});