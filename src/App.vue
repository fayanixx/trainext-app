<template>
  <ion-app>
    <!-- TraiNext 5-Second Initialization Splash Screen -->
    <transition name="fade">
      <div 
        v-if="isInitializing" 
        class="fixed inset-0 z-[99999] flex flex-col items-center justify-center select-none px-6 py-8 overflow-hidden bg-[#050b14]"
      >
        <!-- Mismong Railway Background ng TraiNext -->
        <div class="trainext-bg-railway" aria-hidden="true"></div>
        <div class="trainext-bg-overlay opacity-90" aria-hidden="true"></div>

        <!-- Centered Responsive Mobile Container -->
        <div class="relative z-10 flex flex-col items-center justify-center gap-1 w-[84vw] max-w-xs">
          <img
            src="/assets/trainext-logo.png"
            alt="TraiNext"
            class="w-64 sm:w-72 max-w-[90%] h-auto object-contain drop-shadow-[0_0_35px_rgba(0,217,255,0.45)] animate-pulse"
          />

          <!-- 0-100% Line Loading Container (Dikit sa Logo at Text) -->
          <div class="w-full flex flex-col items-center gap-1.5">
            <!-- Loading Track at Fill Line -->
            <div class="w-full h-1.5 bg-white/10 rounded-full overflow-hidden border border-white/10 relative shadow-inner">
              <div 
                class="h-full bg-gradient-to-r from-[#00d9ff]/70 to-[#00d9ff] rounded-full shadow-[0_0_15px_rgba(0,217,255,0.9)] transition-all duration-75 ease-out"
                :style="{ width: `${progress}%` }"
              ></div>
            </div>

            <!-- Percentage Counter Lang (Minimalist at Malinis) -->
            <div class="w-full flex justify-end pr-0.5">
              <span class="text-[11px] sm:text-xs font-mono font-bold tracking-widest text-[#00d9ff] drop-shadow-[0_0_8px_rgba(0,217,255,0.6)]">
                {{ Math.round(progress) }}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <CyberToast />
    <router-view />
  </ion-app>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { IonApp } from '@ionic/vue';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import CyberToast from '@/components/CyberToast.vue';
import { useAuthStore } from '@/stores/auth';
import { supabase } from '@/lib/supabase';

const router = useRouter();
const authStore = useAuthStore();

const isInitializing = ref(true);
const progress = ref(0);

function destinationFor(role?: string | null): string {
  if (role === 'supervisor') return '/supervisor';
  if (role === 'coordinator') return '/coordinator';
  if (role === 'intern') return '/intern';
  return '/auth';
}

onMounted(async () => {
  // 1. Simulan ang auth store check
  const initPromise = (async () => {
    try {
      if (!authStore.isInitialized) {
        await authStore.initialize();
      }
    } catch (err) {
      console.error('App init error:', err);
    }
  })();

  // 2. 5-Second (5000ms) Progress Counter mula 0 hanggang 100%
  const duration = 5000;
  const intervalTime = 50;
  const step = 100 / (duration / intervalTime);

  const timer = setInterval(() => {
    if (progress.value < 100) {
      progress.value = Math.min(progress.value + step, 100);
    } else {
      clearInterval(timer);
    }
  }, intervalTime);

  // 3. Hintaying magkasabay ang 5 segundo at ang auth validation
  await Promise.all([
    initPromise,
    new Promise((resolve) => setTimeout(resolve, duration)),
  ]);

  progress.value = 100;
  clearInterval(timer);

  // Kapag walang login session, tiyaking dadalhin ito sa /auth
  if (!authStore.isAuthenticated) {
    router.replace('/auth');
  }

  // Makinis na paglaho ng splash overlay
  setTimeout(() => {
    isInitializing.value = false;
  }, 350);

  // 4. Capacitor Deep Link Listener para sa Native Android Google OAuth
  if (Capacitor.isNativePlatform()) {
    CapApp.addListener('appUrlOpen', async (event) => {
      const rawUrl = event.url;
      if (rawUrl.includes('com.trainext.app') || rawUrl.includes('access_token=')) {
        try {
          const hashIndex = rawUrl.indexOf('#');
          const hash = hashIndex !== -1 ? rawUrl.substring(hashIndex + 1) : '';
          const params = new URLSearchParams(hash);

          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');

          if (accessToken && refreshToken) {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (error) throw error;

            if (data.session?.user) {
              await authStore.fetchProfile(data.session.user.id);
              if (authStore.user?.role) {
                router.replace(destinationFor(authStore.user.role));
              } else {
                router.replace('/auth');
              }
            }
          }
        } catch (err) {
          console.error('Deep link auth error:', err);
        }
      }
    });
  }
});
</script>

<style scoped>
/* Smooth fade out ng splash screen */
.fade-leave-active {
  transition: opacity 0.5s ease, transform 0.7s ease;
}
.fade-leave-to {
  opacity: 0;
  transform: scale(1.2);
}
</style>