import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { supabase } from '@/lib/supabase';
import type { AccomplishmentLog } from '@/types';
import type { RealtimeChannel } from '@supabase/supabase-js';

export const useAccomplishmentsStore = defineStore('accomplishments', () => {
  /**
   * Reactive Accomplishments State
   */
  const logs = ref<AccomplishmentLog[]>([]);
  const supervisorPendingLogs = ref<any[]>([]);
  const loading = ref(false);
  const errorMessage = ref<string | null>(null);

  /**
   * Persistent LocalStorage Storage Key for Read Notification State Management
   */
  const STORAGE_KEY = 'trainext_read_report_ids';
  const readLogIds = ref<Set<string>>(
    new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'))
  );

  let realtimeChannel: RealtimeChannel | null = null;

  /**
   * Synchronizes Read Notification IDs to LocalStorage
   */
  const saveReadIds = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(readLogIds.value)));
  };

  /**
   * Marks a specific report record as read
   */
  const markAsRead = (logId: string) => {
    if (!logId) return;
    readLogIds.value.add(logId);
    saveReadIds();
  };

  /**
   * Marks all loaded accomplishment report records as read
   */
  const markAllAsRead = () => {
    logs.value.forEach((l) => readLogIds.value.add(l.id));
    saveReadIds();
  };

  /**
   * Computed Unread Reports Count (Reports with pending feedback or updated status)
   */
  const unreadCount = computed(() => {
    return logs.value.filter(
      (l) => !readLogIds.value.has(l.id) && (l.feedback || l.status !== 'pending')
    ).length;
  });

  const BUCKET_NAME = 'proofs';

  /**
   * Uploads verification proof attachments to designated Supabase Storage Bucket
   */
  const uploadProofFile = async (
    file: File,
    folder: 'images' | 'documents' | 'videos'
  ): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9]/g, '_');
    const filePath = `${folder}/${Date.now()}_${cleanFileName}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Upload failed for ${file.name}: ${uploadError.message}`);
    }

    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);
    return data.publicUrl;
  };

  /**
   * Fetches accomplishment reports submitted by a specific intern
   */
  const fetchInternLogs = async (internId: string) => {
    if (!internId) return [];
    loading.value = true;
    errorMessage.value = null;

    try {
      const { data, error } = await supabase
        .from('accomplishment_reports')
        .select('*')
        .eq('intern_id', internId)
        .order('report_date', { ascending: false });

      if (error) throw error;
      logs.value = (data as AccomplishmentLog[]) || [];
      return logs.value;
    } catch (err: any) {
      console.error('Error fetching intern accomplishments:', err.message);
      errorMessage.value = err.message;
      return [];
    } finally {
      loading.value = false;
    }
  };

  /**
   * Submits a new accomplishment report and auto-assigns supervisor mapping if unassigned
   */
  const createLog = async (payload: {
    internId?: string;
    intern_id?: string;
    supervisorId?: string | null;
    supervisor_id?: string | null;
    title: string;
    description?: string;
    tasks?: string;
    reportDate?: string;
    report_date?: string;
    renderedHours?: number;
    rendered_hours?: number;
    hours_spent?: number;
    proofImages?: string[];
    proof_images?: string[];
    proofDocuments?: string[];
    proof_documents?: string[];
    videoUrl?: string | null;
    video_url?: string | null;
  }) => {
    loading.value = true;
    errorMessage.value = null;

    try {
      const intern_id = payload.internId || payload.intern_id;
      if (!intern_id) throw new Error('Intern ID is required.');

      let supervisor_id = payload.supervisorId || payload.supervisor_id || null;

      // Fallback: Fetch assigned supervisor ID from profile if omitted in payload
      if (!supervisor_id) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('supervisor_id')
          .eq('id', intern_id)
          .maybeSingle();
        if (prof?.supervisor_id) {
          supervisor_id = prof.supervisor_id;
        }
      }

      const cleanTitle = (payload.title || '').trim();
      const cleanDesc = (payload.description || payload.tasks || '').trim();
      const reportDate =
        payload.reportDate ||
        payload.report_date ||
        new Date().toISOString().split('T')[0];
      const hours = Number(
        payload.renderedHours ??
        payload.rendered_hours ??
        payload.hours_spent ??
        0
      );

      const insertPayload: any = {
        intern_id,
        supervisor_id,
        title: cleanTitle,
        description: cleanDesc,
        tasks: cleanDesc || cleanTitle,
        task_description: cleanDesc || cleanTitle,
        work_mode: 'onsite',
        report_date: reportDate,
        rendered_hours: hours,
        hours_spent: hours,
        proof_images: payload.proofImages || payload.proof_images || [],
        proof_documents: payload.proofDocuments || payload.proof_documents || [],
        video_url: (payload.videoUrl || payload.video_url || '').trim() || null,
        status: 'pending',
      };

      const { data, error } = await supabase
        .from('accomplishment_reports')
        .insert(insertPayload)
        .select()
        .single();

      if (error) throw error;

      logs.value.unshift(data as AccomplishmentLog);
      markAsRead(data.id);
      return data as AccomplishmentLog;
    } catch (err: any) {
      errorMessage.value = err.message || 'Failed to submit accomplishment report.';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Fetches accomplishment reports assigned to or under the jurisdiction of a supervisor
   */
  const fetchSupervisorLogs = async (supervisorId: string) => {
    loading.value = true;
    errorMessage.value = null;

    try {
      // 1. Fetch linked intern IDs mapped to supervisor
      const { data: linkedInterns } = await supabase
        .from('intern_supervisor_links')
        .select('intern_id')
        .eq('supervisor_id', supervisorId);

      const internIds = (linkedInterns || []).map((l: any) => l.intern_id);

      // 2. Query reports mapped directly or assigned via intern relationships
      let query = supabase
        .from('accomplishment_reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (internIds.length > 0) {
        query = query.or(`supervisor_id.eq.${supervisorId},intern_id.in.(${internIds.join(',')})`);
      } else {
        query = query.or(`supervisor_id.eq.${supervisorId},supervisor_id.is.null`);
      }

      const { data: reports, error: reportsErr } = await query;
      if (reportsErr) throw reportsErr;

      return await attachInternProfiles(reports || []);
    } catch (err: any) {
      console.error('Error fetching supervisor accomplishments:', err.message);
      errorMessage.value = err.message;
      return [];
    } finally {
      loading.value = false;
    }
  };

  /**
   * Attaches intern profile metadata to raw accomplishment report records
   */
  const attachInternProfiles = async (reports: any[]) => {
    if (!reports.length) {
      supervisorPendingLogs.value = [];
      logs.value = [];
      return [];
    }

    const internIds = [...new Set(reports.map((r) => r.intern_id).filter(Boolean))];

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email, contact_number')
      .in('id', internIds);

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

    const merged = reports.map((r: any) => ({
      ...r,
      intern: profileMap.get(r.intern_id) || {
        full_name: 'Intern Trainee',
        email: '',
        contact_number: '',
      },
    }));

    supervisorPendingLogs.value = merged;
    logs.value = merged as AccomplishmentLog[];

    return merged;
  };

  /**
   * Updates review status and remarks for a single accomplishment report
   */
  const reviewLog = async (params: {
    logId: string;
    status: 'approved' | 'rejected';
    feedback?: string;
  }) => {
    loading.value = true;
    errorMessage.value = null;

    try {
      const nowIso = new Date().toISOString();
      const payload: any = {
        status: params.status,
        feedback: params.feedback?.trim() || null,
        reviewed_at: nowIso,
        approved_at: params.status === 'approved' ? nowIso : null,
      };

      const { data, error } = await supabase
        .from('accomplishment_reports')
        .update(payload)
        .eq('id', params.logId)
        .select()
        .single();

      if (error) throw error;

      const updateLocal = (list: any[]) => {
        const idx = list.findIndex((l) => l.id === params.logId);
        if (idx !== -1) {
          list[idx] = { ...list[idx], ...data };
        }
      };

      updateLocal(logs.value);
      updateLocal(supervisorPendingLogs.value);

      return data;
    } catch (err: any) {
      errorMessage.value = err.message || 'Failed to review accomplishment report.';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Performs batch approval for multiple pending accomplishment reports
   */
  const batchApproveLogs = async (logIds: string[]) => {
    if (!logIds.length) return;
    loading.value = true;
    errorMessage.value = null;

    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('accomplishment_reports')
        .update({
          status: 'approved',
          reviewed_at: nowIso,
          approved_at: nowIso,
        })
        .in('id', logIds);

      if (error) throw error;

      const updateBatch = (list: any[]) => {
        return list.map((log) => {
          if (logIds.includes(log.id)) {
            return { ...log, status: 'approved', reviewed_at: nowIso, approved_at: nowIso };
          }
          return log;
        });
      };

      logs.value = updateBatch(logs.value);
      supervisorPendingLogs.value = updateBatch(supervisorPendingLogs.value);

      return true;
    } catch (err: any) {
      errorMessage.value = err.message || 'Failed to batch approve reports.';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Establishes real-time PostgreSQL replication listener for accomplishment report updates
   */
  const subscribeToRealtime = (userId: string, role: 'intern' | 'supervisor' | 'coordinator') => {
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
    }

    const filterField = role === 'intern' ? `intern_id=eq.${userId}` : undefined;

    realtimeChannel = supabase
      .channel(`accomplishments-live-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'accomplishment_reports',
          filter: filterField,
        },
        async () => {
          if (role === 'intern') {
            await fetchInternLogs(userId);
          } else {
            await fetchSupervisorLogs(userId);
          }
        }
      )
      .subscribe();
  };

  /**
   * Disconnects active real-time channel subscription
   */
  const unsubscribeRealtime = () => {
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
  };

  return {
    logs,
    supervisorPendingLogs,
    loading,
    errorMessage,
    readLogIds,
    unreadCount,
    markAsRead,
    markAllAsRead,
    uploadProofFile,
    fetchInternLogs,
    createLog,
    submitReport: createLog,
    fetchSupervisorLogs,
    reviewLog,
    batchApproveLogs,
    subscribeToRealtime,
    unsubscribeRealtime,
  };
});