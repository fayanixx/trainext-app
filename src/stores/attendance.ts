import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { supabase } from '@/lib/supabase';
import { calculateHoursRendered } from '@/lib/geofence';
import type { AttendanceLog } from '@/types';

export const useAttendanceStore = defineStore('attendance', () => {
  const activeShift = ref<AttendanceLog | null>(null);
  const attendanceHistory = ref<AttendanceLog[]>([]);
  const loading = ref(false);
  const errorMessage = ref<string | null>(null);

  // Computed Session Statuses
  const isOnDuty = computed(() => activeShift.value?.status === 'on_duty');
  const isInTransit = computed(() => activeShift.value?.status === 'in_transit');
  const isSafeAtBase = computed(() => activeShift.value?.status === 'safe_at_base');
  const hasCompletedShiftToday = computed(() => {
    return activeShift.value?.time_out !== null && activeShift.value?.time_out !== undefined && !isInTransit.value;
  });

  /**
   * 1. Fetch Today's Shift for Current Intern
   */
  const fetchTodayShift = async (internId: string) => {
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
   * 2. Log Geofenced Time-In
   */
  const logTimeIn = async (params: {
    internId: string;
    supervisorId?: string;
    latitude: number;
    longitude: number;
  }) => {
    loading.value = true;
    errorMessage.value = null;

    try {
      const nowIso = new Date().toISOString();
      const today = nowIso.split('T')[0];

      const payload = {
        intern_id: params.internId,
        supervisor_id: params.supervisorId || null,
        date: today,
        time_in: nowIso,
        time_in_lat: params.latitude,
        time_in_lng: params.longitude,
        status: 'on_duty',
        hours_rendered: 0,
      };

      const { data, error } = await supabase
        .from('attendance_logs')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      activeShift.value = data as AttendanceLog;
      return activeShift.value;
    } catch (err: any) {
      errorMessage.value = err.message || 'Failed to record Time In.';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * 3. Log Time-Out and Automatically Transition to 'in_transit' Status
   */
  const logTimeOut = async () => {
    if (!activeShift.value) {
      throw new Error('No active shift found to clock out from.');
    }

    loading.value = true;
    errorMessage.value = null;

    try {
      const timeOutIso = new Date().toISOString();
      const rendered = calculateHoursRendered(activeShift.value.time_in, timeOutIso);

      const { data, error } = await supabase
        .from('attendance_logs')
        .update({
          time_out: timeOutIso,
          hours_rendered: rendered,
          status: 'in_transit', // Automatic transit state
        })
        .eq('id', activeShift.value.id)
        .select()
        .single();

      if (error) throw error;
      activeShift.value = data as AttendanceLog;
      return activeShift.value;
    } catch (err: any) {
      errorMessage.value = err.message || 'Failed to record Time Out.';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * 4. Confirm Safe at Base (Legal Waiver & Transit Conclusion)
   */
  const confirmSafeAtBase = async () => {
    if (!activeShift.value) {
      throw new Error('No active transit record found.');
    }

    loading.value = true;
    errorMessage.value = null;

    try {
      const safeTimeIso = new Date().toISOString();

      const { data, error } = await supabase
        .from('attendance_logs')
        .update({
          status: 'safe_at_base',
          safe_at_base_time: safeTimeIso,
          transit_waiver_agreed: true,
        })
        .eq('id', activeShift.value.id)
        .select()
        .single();

      if (error) throw error;
      activeShift.value = data as AttendanceLog;
      return activeShift.value;
    } catch (err: any) {
      errorMessage.value = err.message || 'Failed to record Safe at Base arrival.';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * 5. Fetch Intern Attendance History
   */
  const fetchAttendanceHistory = async (internId: string) => {
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
    logTimeOut,
    confirmSafeAtBase,
    fetchAttendanceHistory,
  };
});