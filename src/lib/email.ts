import emailjs from '@emailjs/browser'
import type { ApprovalStatus } from '@/types'

const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID as string | undefined
const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID as string | undefined
const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY as string | undefined

export interface EmailResult {
  sent: boolean
  reason?: string
}

export interface ReviewNotification {
  internEmail: string
  internName: string
  reviewerName: string
  itemType: string
  itemDetails: string
  status: Exclude<ApprovalStatus, 'pending'>
  feedback: string | null
}

interface NotificationPayload {
  toEmail: string
  toName: string
  senderName: string
  itemType: string
  itemDetails: string
  statusLabel: string
  feedback: string | null
  subject: string
  heading: string
}

function isConfigured(): boolean {
  return Boolean(serviceId && templateId && publicKey)
}

async function sendNotification(payload: NotificationPayload): Promise<EmailResult> {
  if (!isConfigured()) {
    return {
      sent: false,
      reason:
        'EmailJS is not configured. Add VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID, and VITE_EMAILJS_PUBLIC_KEY.'
    }
  }

  if (!payload.toEmail) {
    return { sent: false, reason: 'Recipient email address is missing.' }
  }

  const feedback = payload.feedback?.trim()
    ? payload.feedback.trim()
    : 'No additional remarks were provided.'

  try {
    await emailjs.send(
      serviceId as string,
      templateId as string,
      {
        to_email: payload.toEmail,
        to_name: payload.toName,
        intern_email: payload.toEmail,
        intern_name: payload.toName,
        reviewer_name: payload.senderName,
        item_type: payload.itemType,
        item_details: payload.itemDetails,
        status: payload.statusLabel,
        feedback,
        subject: payload.subject,
        message:
          `Hello ${payload.toName},\n\n` +
          `${payload.heading}\n\n` +
          `${payload.itemDetails}\n\n` +
          `Status: ${payload.statusLabel}\n` +
          `Remarks: ${feedback}\n\n` +
          'Open TraiNext to review the full details.'
      },
      { publicKey: publicKey as string }
    )
    return { sent: true }
  } catch (error) {
    const reason =
      error instanceof Error
        ? error.message
        : 'EmailJS rejected the notification request.'
    return { sent: false, reason }
  }
}

export function sendReviewNotification(
  notification: ReviewNotification
): Promise<EmailResult> {
  return sendNotification({
    toEmail: notification.internEmail,
    toName: notification.internName,
    senderName: notification.reviewerName,
    itemType: notification.itemType,
    itemDetails: notification.itemDetails,
    statusLabel: notification.status,
    feedback: notification.feedback,
    subject: `TraiNext ${notification.itemType} ${notification.status}`,
    heading: `Your ${notification.itemType} was ${notification.status} by ${notification.reviewerName}.`
  })
}

export interface VerificationNotification {
  internEmail: string
  internName: string
  reviewerName: string
  stage: 'school enrollment' | 'company deployment'
  status: Exclude<ApprovalStatus, 'pending'>
  details: string
  feedback: string | null
}

export function sendVerificationNotification(
  notification: VerificationNotification
): Promise<EmailResult> {
  return sendNotification({
    toEmail: notification.internEmail,
    toName: notification.internName,
    senderName: notification.reviewerName,
    itemType: notification.stage,
    itemDetails: notification.details,
    statusLabel: notification.status,
    feedback: notification.feedback,
    subject: `TraiNext ${notification.stage} ${notification.status}`,
    heading: `Your ${notification.stage} verification was ${notification.status} by ${notification.reviewerName}.`
  })
}

export interface TransitPingNotification {
  internEmail: string
  internName: string
  coordinatorName: string
  message: string
  baseAddress: string | null
}

export function sendTransitPingNotification(
  notification: TransitPingNotification
): Promise<EmailResult> {
  return sendNotification({
    toEmail: notification.internEmail,
    toName: notification.internName,
    senderName: notification.coordinatorName,
    itemType: 'safe-at-base confirmation',
    itemDetails:
      notification.message +
      (notification.baseAddress
        ? ` Registered base address: ${notification.baseAddress}.`
        : ''),
    statusLabel: 'action required',
    feedback: null,
    subject: 'TraiNext transit check: please confirm you are safe',
    heading: `${notification.coordinatorName} is requesting a safe-at-base confirmation.`
  })
}
