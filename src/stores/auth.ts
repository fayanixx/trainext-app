import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type {
  MentorOption,
  Profile,
  ProfileUpdateInput,
  UserRole
} from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(null)
  const profile = ref<Profile | null>(null)
  const mentors = ref<MentorOption[]>([])
  const initialized = ref(false)
  const loading = ref(false)
  const error = ref('')

  let subscription: { unsubscribe: () => void } | null = null

  const isAuthenticated = computed(() => Boolean(session.value))
  const isReady = computed(() => initialized.value && Boolean(profile.value))
  const role = computed<UserRole | null>(() => profile.value?.role ?? null)
  const isIntern = computed(() => role.value === 'intern')
  const isSupervisor = computed(() => role.value === 'supervisor')
  const isCoordinator = computed(() => role.value === 'coordinator')
  const displayName = computed(
    () => profile.value?.full_name || profile.value?.email || 'TraiNext user'
  )
  const needsAccountLink = computed(
    () =>
      isIntern.value &&
      (!profile.value?.supervisor_id || !profile.value?.coordinator_id)
  )
  const isFullyVerified = computed(() => {
    if (!profile.value) {
      return false
    }
    if (profile.value.role !== 'intern') {
      return true
    }
    return (
      profile.value.enrollment_status === 'approved' &&
      profile.value.deployment_status === 'approved'
    )
  })

  async function fetchProfile(): Promise<Profile | null> {
    if (!session.value?.user) {
      profile.value = null
      return null
    }

    const { data, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.value.user.id)
      .single()

    if (profileError) {
      error.value = profileError.message
      profile.value = null
      return null
    }

    profile.value = data as Profile
    return profile.value
  }

  async function initialize(): Promise<void> {
    if (initialized.value) {
      return
    }

    loading.value = true
    error.value = ''

    try {
      const { data, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) {
        throw sessionError
      }

      session.value = data.session
      if (session.value) {
        await fetchProfile()
      }

      if (!subscription) {
        const { data: listener } = supabase.auth.onAuthStateChange(
          (event, nextSession) => {
            session.value = nextSession

            if (!nextSession) {
              profile.value = null
              return
            }

            if (
              event === 'SIGNED_IN' ||
              event === 'USER_UPDATED' ||
              event === 'TOKEN_REFRESHED' ||
              event === 'PASSWORD_RECOVERY'
            ) {
              void fetchProfile()
            }
          }
        )
        subscription = listener.subscription
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unable to initialize session.'
    } finally {
      initialized.value = true
      loading.value = false
    }
  }

  async function signIn(email: string, password: string): Promise<Profile> {
    loading.value = true
    error.value = ''

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      })

      if (signInError) {
        throw signInError
      }

      session.value = data.session
      const nextProfile = await fetchProfile()

      if (!nextProfile) {
        throw new Error('Your account is missing a TraiNext profile.')
      }

      return nextProfile
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Sign in failed.'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function signUp(
    email: string,
    password: string,
    fullName: string,
    userRole: UserRole
  ): Promise<{ needsEmailConfirmation: boolean }> {
    loading.value = true
    error.value = ''

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            role: userRole
          }
        }
      })

      if (signUpError) {
        throw signUpError
      }

      session.value = data.session

      if (!data.session) {
        return { needsEmailConfirmation: true }
      }

      await fetchProfile()
      return { needsEmailConfirmation: false }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Sign up failed.'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function verifyOtp(email: string, token: string): Promise<Profile | null> {
    loading.value = true
    error.value = ''

    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: token.trim(),
        type: 'signup'
      })

      if (verifyError) {
        throw verifyError
      }

      session.value = data.session
      const nextProfile = await fetchProfile()
      return nextProfile
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'Unable to verify the email code.'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function resendOtp(email: string): Promise<void> {
    loading.value = true
    error.value = ''

    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim()
      })

      if (resendError) {
        throw resendError
      }
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'Unable to resend the verification code.'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function requestPasswordReset(email: string): Promise<void> {
    loading.value = true
    error.value = ''

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${window.location.origin}/reset-password`
        }
      )

      if (resetError) {
        throw resetError
      }
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'Unable to send the password reset link.'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function updatePassword(password: string): Promise<void> {
    loading.value = true
    error.value = ''

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password
      })

      if (updateError) {
        throw updateError
      }

      await fetchProfile()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unable to update password.'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function updateProfile(input: ProfileUpdateInput): Promise<Profile> {
    loading.value = true
    error.value = ''

    try {
      const { data, error: updateError } = await supabase.rpc('update_my_profile', {
        p_full_name: input.full_name,
        p_phone: input.phone,
        p_id_number: input.id_number,
        p_university_name: input.university_name,
        p_company_name: input.company_name,
        p_company_address: input.company_address,
        p_home_base_address: input.home_base_address,
        p_emergency_contact_name: input.emergency_contact_name,
        p_emergency_contact_relationship: input.emergency_contact_relationship,
        p_emergency_contact_phone: input.emergency_contact_phone
      })

      if (updateError) {
        throw updateError
      }

      profile.value = data as Profile
      return profile.value
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unable to update profile.'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function linkAccounts(
    coordinatorId: string,
    supervisorId: string
  ): Promise<Profile> {
    loading.value = true
    error.value = ''

    try {
      const { data, error: linkError } = await supabase.rpc(
        'link_intern_accounts',
        {
          p_coordinator_id: coordinatorId,
          p_supervisor_id: supervisorId
        }
      )

      if (linkError) {
        throw linkError
      }

      profile.value = data as Profile
      return profile.value
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'Unable to link your accounts.'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function fetchMentors(): Promise<MentorOption[]> {
    const { data, error: mentorError } = await supabase.rpc('list_mentors')
    if (mentorError) {
      throw mentorError
    }
    mentors.value = (data ?? []) as MentorOption[]
    return mentors.value
  }

  async function signOut(): Promise<void> {
    loading.value = true
    try {
      await supabase.auth.signOut()
    } finally {
      session.value = null
      profile.value = null
      mentors.value = []
      loading.value = false
    }
  }

  function clearError(): void {
    error.value = ''
  }

  return {
    session,
    profile,
    mentors,
    initialized,
    loading,
    error,
    isAuthenticated,
    isReady,
    role,
    isIntern,
    isSupervisor,
    isCoordinator,
    isFullyVerified,
    needsAccountLink,
    displayName,
    initialize,
    fetchProfile,
    signIn,
    signUp,
    verifyOtp,
    resendOtp,
    requestPasswordReset,
    updatePassword,
    updateProfile,
    linkAccounts,
    fetchMentors,
    signOut,
    clearError
  }
})
