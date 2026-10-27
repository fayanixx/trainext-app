import { defineStore } from 'pinia';
import { ref } from 'vue';
import { supabase } from '@/lib/supabase';
import type { AccomplishmentLog } from '@/types';

export const useAccomplishmentsStore = defineStore('accomplishments', () => {
  const logs = ref<AccomplishmentLog[]>([]);
  const supervisorPendingLogs = ref<any[]>([]);
  const loading = ref(false);
  const errorMessage = ref<string | null>(null);

  const BUCKET_NAME = 'accomplishment-proofs';

  /**
   * Helper: Tumutukoy kung accomplishment_reports o accomplishment_logs ang gagamitin
   */
  const getTableName = () => 'accomplishment_reports';

  /**
   * 1. Upload File to Supabase Storage Bucket ('accomplishment-proofs')
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
   * 2. Fetch Accomplishment Logs for an Intern
   */
  const fetchInternLogs = async (internId: string) => {
    if (!internId) return [];
    loading.value = true;
    errorMessage.value = null;

    try {
      // Primary: accomplishment_reports
      let { data, error } = await supabase
        .from('accomplishment_reports')
        .select('*')
        .eq('intern_id', internId)
        .order('report_date', { ascending: false });

      // Fallback kung accomplishment_logs ang active sa database
      if (error && error.code === '42P01') {
        const fallback = await supabase
          .from('accomplishment_logs')
          .select('*')
          .eq('intern_id', internId)
          .order('report_date', { ascending: false });

        data = fallback.data;
        error = fallback.error;
      }

      if (error) throw error;
      logs.value = (data as AccomplishmentLog[]) || [];
      return logs.value;
    } catch (err: any) {
      console.error('Error fetching accomplishments:', err.message);
      errorMessage.value = err.message;
      return [];
    } finally {
      loading.value = false;
    }
  };

  /**
   * 3. Submit New Accomplishment Log
   */
  const createLog = async (payload: {
    internId?: string;
    intern_id?: string;
    supervisorId?: string | null;
    supervisor_id?: string | null;
    title: string;
    description: string;
    reportDate?: string;
    report_date?: string;
    renderedHours?: number;
    rendered_hours?: number;
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

        const insertData: any = {
        intern_id,
        supervisor_id: payload.supervisorId || payload.supervisor_id || null,
        title: payload.title.trim(),
        description: payload.description.trim(),
        tasks: payload.description.trim(), // Dual-map para masatisfy ang 'tasks' column
        task: payload.title.trim(),        // Fallback para sa singular 'task' column
        report_date:
          payload.reportDate ||
          payload.report_date ||
          new Date().toISOString().split('T')[0],
        rendered_hours: Number(payload.renderedHours ?? payload.rendered_hours ?? 0),
        proof_images: payload.proofImages || payload.proof_images || [],
        proof_documents: payload.proofDocuments || payload.proof_documents || [],
        video_url: (payload.videoUrl || payload.video_url || '').trim() || null,
        status: 'pending',
      };

      let targetTable = 'accomplishment_reports';
      let { data, error } = await supabase
        .from(targetTable)
        .insert(insertData)
        .select()
        .single();

      if (error && error.code === '42P01') {
        targetTable = 'accomplishment_logs';
        const fallback = await supabase
          .from(targetTable)
          .insert(insertData)
          .select()
          .single();

        data = fallback.data;
        error = fallback.error;
      }

      if (error) throw error;

      logs.value.unshift(data as AccomplishmentLog);
      return data as AccomplishmentLog;
    } catch (err: any) {
      errorMessage.value = err.message || 'Failed to submit accomplishment log.';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * 4. Update an Existing Pending Accomplishment Log
   */
  const updateLog = async (
    id: string,
    updates: Partial<{
      title: string;
      description: string;
      report_date: string;
      rendered_hours: number;
      proof_images: string[];
      proof_documents: string[];
      video_url: string | null;
    }>
  ) => {
    loading.value = true;
    errorMessage.value = null;

    try {
      let targetTable = 'accomplishment_reports';
      let { data, error } = await supabase
        .from(targetTable)
        .update(updates)
        .eq('id', id)
        .eq('status', 'pending')
        .select()
        .single();

      if (error && error.code === '42P01') {
        targetTable = 'accomplishment_logs';
        const fallback = await supabase
          .from(targetTable)
          .update(updates)
          .eq('id', id)
          .eq('status', 'pending')
          .select()
          .single();

        data = fallback.data;
        error = fallback.error;
      }

      if (error) throw error;

      const idx = logs.value.findIndex((l) => l.id === id);
      if (idx !== -1) {
        logs.value[idx] = data as AccomplishmentLog;
      }
      return data as AccomplishmentLog;
    } catch (err: any) {
      errorMessage.value = err.message || 'Failed to update accomplishment log.';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * 5. Delete a Pending Accomplishment Log
   */
  const deleteLog = async (id: string) => {
    loading.value = true;
    errorMessage.value = null;

    try {
      let targetTable = 'accomplishment_reports';
      let { error } = await supabase
        .from(targetTable)
        .delete()
        .eq('id', id)
        .eq('status', 'pending');

      if (error && error.code === '42P01') {
        targetTable = 'accomplishment_logs';
        const fallback = await supabase
          .from(targetTable)
          .delete()
          .eq('id', id)
          .eq('status', 'pending');
        error = fallback.error;
      }

      if (error) throw error;

      logs.value = logs.value.filter((l) => l.id !== id);
      return true;
    } catch (err: any) {
      errorMessage.value = err.message || 'Failed to delete accomplishment log.';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * 6. Fetch Logs Assigned to Supervisor
   */
  const fetchSupervisorLogs = async (supervisorId: string) => {
    loading.value = true;
    errorMessage.value = null;

    try {
      let targetTable = 'accomplishment_reports';
      let { data, error } = await supabase
        .from(targetTable)
        .select(`
          *,
          intern:profiles!intern_id (
            id,
            full_name,
            contact_number
          )
        `)
        .eq('supervisor_id', supervisorId)
        .order('created_at', { ascending: false });

      if (error && error.code === '42P01') {
        targetTable = 'accomplishment_logs';
        const fallback = await supabase
          .from(targetTable)
          .select(`
            *,
            intern:profiles!accomplishment_logs_intern_id_fkey (
              id,
              full_name,
              contact_number
            )
          `)
          .eq('supervisor_id', supervisorId)
          .order('created_at', { ascending: false });

        data = fallback.data;
        error = fallback.error;
      }

      if (error) throw error;
      supervisorPendingLogs.value = (data as any[]) || [];
      return supervisorPendingLogs.value;
    } catch (err: any) {
      console.error('Error fetching supervisor logs:', err.message);
      errorMessage.value = err.message;
      return [];
    } finally {
      loading.value = false;
    }
  };

  /**
   * 7. Single Review (Approve or Reject with Feedback)
   */
  const reviewLog = async (params: {
    logId: string;
    status: 'approved' | 'rejected';
    feedback?: string;
  }) => {
    loading.value = true;
    errorMessage.value = null;

    try {
      const payload: any = {
        status: params.status,
        feedback: params.feedback?.trim() || null,
        approved_at: params.status === 'approved' ? new Date().toISOString() : null,
      };

      let targetTable = 'accomplishment_reports';
      let { data, error } = await supabase
        .from(targetTable)
        .update(payload)
        .eq('id', params.logId)
        .select()
        .single();

      if (error && error.code === '42P01') {
        targetTable = 'accomplishment_logs';
        const fallback = await supabase
          .from(targetTable)
          .update(payload)
          .eq('id', params.logId)
          .select()
          .single();

        data = fallback.data;
        error = fallback.error;
      }

      if (error) throw error;

      const idx = supervisorPendingLogs.value.findIndex((l) => l.id === params.logId);
      if (idx !== -1) {
        supervisorPendingLogs.value[idx] = {
          ...supervisorPendingLogs.value[idx],
          ...data,
        };
      }
      return data;
    } catch (err: any) {
      errorMessage.value = err.message || 'Failed to submit review.';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * 8. Batch Approve Accomplishments
   */
  const batchApproveLogs = async (logIds: string[]) => {
    if (!logIds.length) return;
    loading.value = true;
    errorMessage.value = null;

    try {
      const nowIso = new Date().toISOString();
      let targetTable = 'accomplishment_reports';
      let { error } = await supabase
        .from(targetTable)
        .update({
          status: 'approved',
          approved_at: nowIso,
        })
        .in('id', logIds);

      if (error && error.code === '42P01') {
        targetTable = 'accomplishment_logs';
        const fallback = await supabase
          .from(targetTable)
          .update({
            status: 'approved',
            approved_at: nowIso,
          })
          .in('id', logIds);
        error = fallback.error;
      }

      if (error) throw error;

      supervisorPendingLogs.value = supervisorPendingLogs.value.map((log) => {
        if (logIds.includes(log.id)) {
          return { ...log, status: 'approved', approved_at: nowIso };
        }
        return log;
      });
      return true;
    } catch (err: any) {
      errorMessage.value = err.message || 'Failed to batch approve logs.';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  return {
    logs,
    supervisorPendingLogs,
    loading,
    errorMessage,
    uploadProofFile,
    fetchInternLogs,
    createLog,
    submitReport: createLog,
    updateLog,
    deleteLog,
    fetchSupervisorLogs,
    reviewLog,
    batchApproveLogs,
  };
});