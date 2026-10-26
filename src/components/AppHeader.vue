<template>
  <ion-header class="glass-header">
    <ion-toolbar class="glass-toolbar">
      <ion-title>
        <span class="font-heavy text-white tracking-wider">TRAIN</span><span class="font-heavy text-[#00C2FF] tracking-wider">NEXT</span>
        <span v-if="subtitle" class="ml-2.5 text-xs font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">· {{ subtitle }}</span>
      </ion-title>

      <ion-buttons slot="end" class="flex items-center gap-2 pr-2">
        <span class="hidden max-w-44 truncate text-xs font-bold text-slate-300 md:inline tracking-wide">
          {{ auth.displayName }}
        </span>

        <!-- Settings Icon Button -->
        <button
          type="button"
          class="header-icon-btn"
          aria-label="Profile settings"
          title="Profile settings"
          @click="settingsOpen = true"
        >
          <svg class="w-4 h-4 text-[#00C2FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        <!-- Sign Out Button -->
        <button
          type="button"
          class="signout-btn"
          @click="handleSignOut"
        >
          Sign out
        </button>
      </ion-buttons>
    </ion-toolbar>
  </ion-header>

  <ProfileSettingsModal
    :is-open="settingsOpen"
    @update:is-open="settingsOpen = $event"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  IonButtons,
  IonHeader,
  IonTitle,
  IonToolbar
} from '@ionic/vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import ProfileSettingsModal from '@/components/ProfileSettingsModal.vue'

withDefaults(defineProps<{ subtitle?: string }>(), { subtitle: '' })

const auth = useAuthStore()
const router = useRouter()
const settingsOpen = ref(false)

async function handleSignOut(): Promise<void> {
  await auth.signOut()
  await router.replace('/auth')
}
</script>

<style scoped>
.font-heavy {
  font-family: 'Aileron Heavy', 'Aileron Bold', sans-serif !important;
  font-weight: 900 !important;
}

.glass-header {
  box-shadow: none !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12) !important;
  backdrop-filter: blur(16px) !important;
  -webkit-backdrop-filter: blur(16px) !important;
}

.glass-toolbar {
  --background: rgba(4, 9, 22, 0.75) !important;
  --color: #ffffff !important;
  --border-width: 0 !important;
  padding: 2px 8px !important;
}

.header-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 9999px;
  background: rgba(0, 194, 255, 0.1);
  border: 1px solid rgba(0, 194, 255, 0.25);
  cursor: pointer;
  transition: all 0.2s ease;
}

.header-icon-btn:hover {
  background: rgba(0, 194, 255, 0.2);
  border-color: #00C2FF;
}

.signout-btn {
  padding: 6px 12px;
  border-radius: 9999px;
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #f87171;
  font-family: 'Aileron Bold', sans-serif;
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.signout-btn:hover {
  background: rgba(239, 68, 68, 0.25);
  color: #ffffff;
}
</style>