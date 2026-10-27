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

// Single, modern return-based navigation guard (No next() callback)
router.beforeEach(async (to) => {
  const auth = useAuthStore()

  // 1. I-load ang user profile kapag wala pa sa store
  if (!auth.user) {
    try {
      await auth.fetchProfile()
    } catch (e) {
      console.error('Auth initialization error:', e)
    }
  }

  const isPublic = to.meta.public === true

  // 2. Kung naka-login na at sinubukang pumunta sa /auth, idiretso sa dashboard ng kanyang role
  if (to.name === 'Auth' && auth.isAuthenticated && auth.user) {
    return destinationFor(auth.user.role)
  }

  // 3. Kung public route (e.g. /auth, /reset-password), papasukin
  if (isPublic) {
    return true
  }

  // 4. Kung kailangan ng login pero hindi authenticated
  if (!auth.isAuthenticated || !auth.user) {
    return {
      name: 'Auth',
      query: { redirect: to.fullPath }
    }
  }

  // 5. Role-based check (haharangin kung mali ang dashboard na binubuksan)
  const requiredRole = to.meta.role as string | undefined
  if (requiredRole && auth.user.role !== requiredRole) {
    return destinationFor(auth.user.role)
  }

  return true
})

export default router