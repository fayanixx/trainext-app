  import emailjs from '@emailjs/browser';

  export type ApprovalStatus = 'approved' | 'rejected' | 'pending';

  export interface EmailNotificationPayload {
    toEmail: string;
    toName: string;
    status: ApprovalStatus;
    feedback?: string;
    reportTitle?: string;
  }

  export const sendStatusEmail = async (payload: EmailNotificationPayload) => {
    try {
      const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID || '';
      const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || '';
      const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || '';

      if (!serviceId || !templateId || !publicKey) {
        console.warn('EmailJS environment variables not set. Skipping email dispatch.');
        return;
      }

      const templateParams = {
        to_email: payload.toEmail,
        to_name: payload.toName,
        status: payload.status.toUpperCase(),
        feedback: payload.feedback || 'No feedback provided.',
        report_title: payload.reportTitle || 'Daily Accomplishment Report',
      };

      await emailjs.send(serviceId, templateId, templateParams, publicKey);
    } catch (error: any) {
      console.error('EmailJS dispatch failed:', error);
    }
  };