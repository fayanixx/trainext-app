import { ref } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import type { CompanySite, SiteInput } from '@/types'

export const useSitesStore = defineStore('sites', () => {
  const sites = ref<CompanySite[]>([])
  const loading = ref(false)
  const error = ref('')

  async function fetchSites(): Promise<CompanySite[]> {
    loading.value = true
    error.value = ''

    try {
      const { data, error: fetchError } = await supabase
        .from('company_sites')
        .select('*')
        .order('created_at', { ascending: false })

      if (fetchError) {
        throw fetchError
      }

      sites.value = (data ?? []) as CompanySite[]
      return sites.value
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unable to load company sites.'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function createSite(input: SiteInput): Promise<CompanySite> {
    const auth = useAuthStore()
    if (!auth.profile) {
      throw new Error('You must be signed in as a supervisor.')
    }

    loading.value = true
    error.value = ''

    try {
      const { data, error: createError } = await supabase
        .from('company_sites')
        .insert({
          supervisor_id: auth.profile.id,
          ...input
        })
        .select()
        .single()

      if (createError) {
        throw createError
      }

      const created = data as CompanySite
      sites.value = [created, ...sites.value]
      return created
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unable to create company site.'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function updateSite(id: string, input: SiteInput): Promise<CompanySite> {
    loading.value = true
    error.value = ''

    try {
      const { data, error: updateError } = await supabase
        .from('company_sites')
        .update(input)
        .eq('id', id)
        .select()
        .single()

      if (updateError) {
        throw updateError
      }

      const updated = data as CompanySite
      sites.value = sites.value.map((site) => (site.id === id ? updated : site))
      return updated
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unable to update company site.'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function deleteSite(id: string): Promise<void> {
    loading.value = true
    error.value = ''

    try {
      const { error: deleteError } = await supabase
        .from('company_sites')
        .delete()
        .eq('id', id)

      if (deleteError) {
        throw deleteError
      }

      sites.value = sites.value.filter((site) => site.id !== id)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unable to delete company site.'
      throw err
    } finally {
      loading.value = false
    }
  }

  function clear(): void {
    sites.value = []
    error.value = ''
  }

  return {
    sites,
    loading,
    error,
    fetchSites,
    createSite,
    updateSite,
    deleteSite,
    clear
  }
})
