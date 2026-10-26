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

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.initialize()

  if (to.meta.public) {
    return true
  }

  if (to.name === 'Auth') {
    if (auth.isAuthenticated && auth.profile) {
      return destinationFor(auth.role)
    }
    return true
  }

  if (!auth.isAuthenticated) {
    return {
      name: 'Auth',
      query: { redirect: to.fullPath }
    }
  }

  if (!auth.profile) {
    await auth.fetchProfile()
  }

  if (!auth.profile) {
    await auth.signOut()
    return { name: 'Auth' }
  }

  const requiredRole = to.meta.role as string | undefined
  if (requiredRole && auth.role !== requiredRole) {
    return destinationFor(auth.role)
  }

  return true
})

function destinationFor(role: string | null): string {
  if (role === 'supervisor') {
    return '/supervisor'
  }
  if (role === 'coordinator') {
    return '/coordinator'
  }
  return '/intern'
}

export default router
