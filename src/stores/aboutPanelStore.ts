import { defineStore } from 'pinia'
import { computed } from 'vue'

import { AboutPageBadge } from '@/types/comfy'
import { electronAPI, isElectron } from '@/utils/envUtil'

import { useExtensionStore } from './extensionStore'
import { useSystemStatsStore } from './systemStatsStore'

export const useAboutPanelStore = defineStore('aboutPanel', () => {
  const frontendVersion = __COMFYUI_FRONTEND_VERSION__
  const extensionStore = useExtensionStore()
  const systemStatsStore = useSystemStatsStore()
  const coreVersion = computed(
    () => systemStatsStore?.systemStats?.system?.comfyui_version ?? ''
  )

  const coreBadges = computed<AboutPageBadge[]>(() => [
    // In electron, the ComfyUI is packaged without the git repo,
    // so the python server's API doesn't have the version info.
    {
      label: `ComfyUI ${
        isElectron()
          ? 'v' + electronAPI().getComfyUIVersion()
          : coreVersion.value
      }`,
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
