import { AboutPageBadge } from '@/types/comfy'
import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useSystemStatsStore } from './systemStatsStore'
import { useExtensionStore } from './extensionStore'

export const useAboutPanelStore = defineStore('aboutPanel', () => {
  const frontendVersion = __COMFYUI_FRONTEND_VERSION__
  const extensionStore = useExtensionStore()
  const systemStatsStore = useSystemStatsStore()
  const coreVersion = computed(
    () => systemStatsStore?.systemStats?.system?.comfyui_version ?? ''
  )

  const coreBadges = computed<AboutPageBadge[]>(() => [
    {
      label: `ComfyUI ${coreVersion.value}`,
      url: 'https://github.com/comfyanonymous/ComfyUI',
      icon: 'pi pi-github'
    },
    {
      label: `ComfyUI_frontend v${frontendVersion}`,
      url: 'https://github.com/Comfy-Org/ComfyUI_frontend',
      icon: 'pi pi-github'
    },
    {
      label: 'Discord',
      url: 'https://www.comfy.org/discord',
      icon: 'pi pi-discord'
    },
    { label: 'ComfyOrg', url: 'https://www.comfy.org/', icon: 'pi pi-globe' }
  ])

  const allBadges = computed<AboutPageBadge[]>(() => [
    ...coreBadges.value,
    ...extensionStore.extensions.flatMap((e) => e.aboutPageBadges ?? [])
  ])

  return {
    badges: allBadges
  }
})
