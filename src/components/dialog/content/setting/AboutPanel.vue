<template>
  <div class="about-container flex flex-col gap-2" data-testid="about-panel">
    <h2 class="mb-2 text-2xl font-bold">
      {{ $t('g.about') }}
    </h2>
    <div class="space-y-2">
      <a
        v-for="badge in badges"
        :key="badge.url"
        :href="badge.url"
        target="_blank"
        rel="noopener noreferrer"
        class="about-badge inline-flex items-center no-underline"
        :title="badge.url"
      >
        <Tag class="mr-2" :severity="badge.severity">
          <template #icon>
            <i :class="[badge.icon, 'mr-2 text-xl']" />
          </template>
          {{ badge.label }}
        </Tag>
      </a>
    </div>

    <Divider />

    <SystemStatsPanel
      v-if="systemStatsStore.systemStats"
      :stats="systemStatsStore.systemStats"
    />
  </div>
</template>

<script setup lang="ts">
import Divider from 'primevue/divider'
import Tag from 'primevue/tag'
import { computed } from 'vue'

import SystemStatsPanel from '@/components/common/SystemStatsPanel.vue'
import { useExternalLink } from '@/composables/useExternalLink'
import { isCloud, isDesktop } from '@/platform/distribution/types'
import { useExtensionStore } from '@/stores/extensionStore'
import { useSystemStatsStore } from '@/stores/systemStatsStore'
import type { AboutPageBadge } from '@/types/comfy'
import { electronAPI } from '@/utils/envUtil'
import { formatCommitHash } from '@/utils/formatUtil'

const systemStatsStore = useSystemStatsStore()
const extensionStore = useExtensionStore()
const { staticUrls } = useExternalLink()

const frontendVersion = __COMFYUI_FRONTEND_VERSION__
const coreVersion = computed(
  () => systemStatsStore?.systemStats?.system?.comfyui_version ?? ''
)
const templatesVersion = computed(
  () => systemStatsStore?.systemStats?.system?.installed_templates_version ?? ''
)
const requiredTemplatesVersion = computed(
  () => systemStatsStore?.systemStats?.system?.required_templates_version ?? ''
)
const isTemplatesOutdated = computed(
  () =>
    templatesVersion.value !== '' &&
    requiredTemplatesVersion.value !== '' &&
    templatesVersion.value !== requiredTemplatesVersion.value
)

const coreBadges = computed<AboutPageBadge[]>(() => [
  // In electron, ComfyUI is packaged without the git repo, so the python
  // server's API doesn't have the version info.
  {
    label: `ComfyUI ${
      isDesktop
        ? 'v' + electronAPI().getComfyUIVersion()
        : formatCommitHash(coreVersion.value)
    }`,
    url: isCloud ? staticUrls.comfyOrg : staticUrls.github,
    icon: isCloud ? 'pi pi-cloud' : 'pi pi-github'
  },
  {
    label: `ComfyUI_frontend v${frontendVersion}`,
    url: staticUrls.githubFrontend,
    icon: 'pi pi-github'
  },
  ...(templatesVersion.value
    ? [
        {
          label: `Templates v${templatesVersion.value}`,
          url: 'https://pypi.org/project/comfyui-workflow-templates/',
          icon: 'pi pi-book',
          ...(isTemplatesOutdated.value ? { severity: 'danger' as const } : {})
        }
      ]
    : []),
  {
    label: 'Discord',
    url: staticUrls.discord,
    icon: 'pi pi-discord'
  },
  { label: 'ComfyOrg', url: staticUrls.comfyOrg, icon: 'pi pi-globe' }
])

const badges = computed<AboutPageBadge[]>(() => [
  ...coreBadges.value,
  ...extensionStore.extensions.flatMap((e) => e.aboutPageBadges ?? [])
])
</script>
