import { createRouter, createWebHistory } from '@ionic/vue-router'
import type { RouteRecordRaw } from 'vue-router'
import AuthView from '@/views/AuthView.vue'
import InternDashboard from '@/views/InternDashboard.vue'
import SupervisorDashboard from '@/views/SupervisorDashboard.vue'
import CoordinatorDashboard from '@/views/CoordinatorDashboard.vue'
import ResetPasswordView from '@/views/ResetPasswordView.vue'
import { useAuthStore } from '@/stores/auth'

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/auth'
  },
  {
    path: '/auth',
    name: 'Auth',
    component: AuthView,
    meta: { public: true }
  },
  {
    path: '/login',
    redirect: '/auth'
  },
  {
    path: '/reset-password',
    name: 'ResetPassword',
    component: ResetPasswordView,
    meta: { public: true }
  },
  {
    path: '/intern',
    name: 'InternDashboard',
    component: InternDashboard,
    meta: { requiresAuth: true, role: 'intern' }
  },
  {
    path: '/supervisor',
    name: 'SupervisorDashboard',
    component: SupervisorDashboard,
    meta: { requiresAuth: true, role: 'supervisor' }
  },
  {
    path: '/coordinator',
    name: 'CoordinatorDashboard',
    component: CoordinatorDashboard,
    meta: { requiresAuth: true, role: 'coordinator' }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/auth'
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

function destinationFor(role?: string | null): string {
  if (role === 'supervisor') return '/supervisor'
  if (role === 'coordinator') return '/coordinator'
  return '/intern'
}

router.beforeEach(async (to) => {
  // 1. Kung recovery link ang binuksan mula sa email, huwag harangin o i-redirect sa dashboard
  const isRecoveryHash = window.location.hash.includes('type=recovery') || to.query.type === 'recovery'
  if (to.name === 'ResetPassword' || isRecoveryHash) {
    if (to.name !== 'ResetPassword') {
      return { name: 'ResetPassword', hash: window.location.hash }
    }
    return true
  }

  const auth = useAuthStore()

  // 2. Tiyaking initialized ang session bago mag-decide ang guard
  if (!auth.isInitialized) {
    try {
      await auth.initialize()
    } catch (e) {
      console.error('Auth initialization error:', e)
    }
  }

  const isPublic = to.meta.public === true

  // 3. Kung naka-login na at pumunta sa /auth o /login, idiretso sa dashboard
  if (to.name === 'Auth' && auth.isAuthenticated && auth.user) {
    return destinationFor(auth.user.role)
  }

  // 4. Papasukin kapag public route (e.g. login, reset-password request)
  if (isPublic) {
    return true
  }

  // 5. Kung kailangan ng login pero walang session, balik sa /auth
  if (!auth.isAuthenticated || !auth.user) {
    return {
      name: 'Auth',
      query: { redirect: to.fullPath }
    }
  }

  // 6. Role-based check
  const requiredRole = to.meta.role as string | undefined
  if (requiredRole && auth.user.role !== requiredRole) {
    return destinationFor(auth.user.role)
  }

  return true
})

export default router