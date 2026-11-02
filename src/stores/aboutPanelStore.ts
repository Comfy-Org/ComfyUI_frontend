import { defineStore } from 'pinia'
import { computed } from 'vue'

import { useExternalLink } from '@/composables/useExternalLink'
import { isCloud, isDesktop } from '@/platform/distribution/types'
import type { AboutPageBadge } from '@/types/comfy'
import { electronAPI } from '@/utils/envUtil'
import { formatCommitHash } from '@/utils/formatUtil'

import { useExtensionStore } from '@/platform/extensions/stores/extensionStore'
import { useSystemStatsStore } from './systemStatsStore'

export const useAboutPanelStore = defineStore('aboutPanel', () => {
  const frontendVersion = __COMFYUI_FRONTEND_VERSION__
  const extensionStore = useExtensionStore()
  const systemStatsStore = useSystemStatsStore()
  const { staticUrls } = useExternalLink()
  const coreVersion = computed(
    () => systemStatsStore.systemStats?.system.comfyui_version ?? ''
  )
  const templatesVersion = computed(
    () => systemStatsStore.systemStats?.system.installed_templates_version ?? ''
  )
  const requiredTemplatesVersion = computed(
    () => systemStatsStore.systemStats?.system.required_templates_version ?? ''
  )
  const isTemplatesOutdated = computed(
    () =>
      templatesVersion.value !== '' &&
      requiredTemplatesVersion.value !== '' &&
      templatesVersion.value !== requiredTemplatesVersion.value
  )

  const coreBadges = computed<AboutPageBadge[]>(() => [
    {
      label: `ComfyUI ${
        isDesktop
          ? 'v' + electronAPI().getComfyUIVersion()
          : formatCommitHash(coreVersion.value)
      }`,
      url: isCloud ? staticUrls.comfyOrg : staticUrls.github,
      icon: isCloud ? 'icon-[lucide--cloud]' : 'icon-[lucide--github]'
    },
    {
      label: `ComfyUI_frontend v${frontendVersion}`,
      url: staticUrls.githubFrontend,
      icon: 'icon-[lucide--github]'
    },
    ...(templatesVersion.value
      ? [
          {
            label: `Templates v${templatesVersion.value}`,
            url: 'https://pypi.org/project/comfyui-workflow-templates/',
            icon: 'icon-[lucide--book]',
            ...(isTemplatesOutdated.value
              ? { severity: 'danger' as const }
              : {})
          }
        ]
      : []),
    {
      label: 'Discord',
      url: staticUrls.discord,
      icon: 'pi pi-discord'
    },
    {
      label: 'ComfyOrg',
      url: staticUrls.comfyOrg,
      icon: 'icon-[lucide--globe]'
    }
  ])

  const allBadges = computed<AboutPageBadge[]>(() => [
    ...coreBadges.value,
    ...extensionStore.extensions
      .filter((e) => extensionStore.contributes(e.name))
      .flatMap((e) => e.aboutPageBadges ?? [])
  ])

  return {
    badges: allBadges
  }
})
