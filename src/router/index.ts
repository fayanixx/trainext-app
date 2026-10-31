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
  if (role === 'intern') return '/intern'
  return '/auth'
}

router.beforeEach(async (to) => {
  // 1. Password recovery verification
  const isRecoveryHash = window.location.hash.includes('type=recovery') || to.query.type === 'recovery'
  if (isRecoveryHash) {
    if (to.name !== 'ResetPassword' && to.name !== 'Auth') {
      return { name: 'Auth', hash: window.location.hash }
    }
    return true
  }

  // 2. Pahintulutan ang /auth na mag-handle ng OAuth hash tokens nang hindi ginagambala
  const hasAuthToken = window.location.hash.includes('access_token=')
  if (to.name === 'Auth' && hasAuthToken) {
    return true
  }

  const auth = useAuthStore()

  // 3. Siguraduhing may session state bago ipagpatuloy ang evaluation
  if (!auth.isInitialized) {
    try {
      await auth.initialize()
    } catch (e) {
      console.error('Auth initialization error:', e)
    }
  }

  const isPublic = to.meta.public === true

  // 4. Kung authenticated na at may valid role, ilayo sa /auth
  if (to.name === 'Auth' && auth.isAuthenticated && auth.user) {
    if (auth.user.role) {
      return destinationFor(auth.user.role)
    }
    // Kung walang role (bagong Google user), manatili sa /auth para sa modal
    return true
  }

  // 5. Public routes access
  if (isPublic) {
    return true
  }

  // 6. Proteksyon sa authenticated routes
  if (!auth.isAuthenticated || !auth.user) {
    return {
      name: 'Auth',
      query: { redirect: to.fullPath }
    }
  }

  // 7. Kung walang assigned role pa ang authenticated user, ibalik sa /auth para pumili
  if (!auth.user.role) {
    return { name: 'Auth' }
  }

  // 8. Role-based enforcement
  const requiredRole = to.meta.role as string | undefined
  if (requiredRole && auth.user.role !== requiredRole) {
    return destinationFor(auth.user.role)
  }

  return true
})

export default router