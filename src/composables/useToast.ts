import { ref } from 'vue';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
}

const toasts = ref<ToastMessage[]>([]);

export function useToast() {
  const showToast = (message: string, type: ToastType = 'info', title?: string, duration = 4000) => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const toast: ToastMessage = { id, type, title, message };
    toasts.value.push(toast);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  };

  const removeToast = (id: string) => {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  };

  return {
    toasts,
    showToast,
    removeToast,
    success: (msg: string, title = 'SUCCESS') => showToast(msg, 'success', title),
    error: (msg: string, title = 'ERROR') => showToast(msg, 'error', title),
    warning: (msg: string, title = 'WARNING') => showToast(msg, 'warning', title),
    info: (msg: string, title = 'NOTICE') => showToast(msg, 'info', title),
  };
}