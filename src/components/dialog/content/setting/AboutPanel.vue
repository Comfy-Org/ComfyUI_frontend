<template>
  <div>
    <h2 class="text-2xl font-bold mb-2">{{ $t('about') }}</h2>
    <div class="space-y-2">
      <a
        v-for="link in links"
        :key="link.url"
        :href="link.url"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center no-underline"
      >
        <Tag class="mr-2">
          <template #icon>
            <i :class="[link.icon, 'mr-2 text-xl']"></i>
          </template>
          {{ link.label }}
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
import { useSystemStatsStore } from '@/stores/systemStatsStore'
import Tag from 'primevue/tag'
import Divider from 'primevue/divider'
import { computed, onMounted } from 'vue'
import SystemStatsPanel from '@/components/common/SystemStatsPanel.vue'

const systemStatsStore = useSystemStatsStore()
const frontendVersion = window['__COMFYUI_FRONTEND_VERSION__']
const coreVersion = computed(
  () => systemStatsStore.systemStats?.system?.comfyui_version ?? ''
)

const links = computed(() => [
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

onMounted(async () => {
  if (!systemStatsStore.systemStats) {
    await systemStatsStore.fetchSystemStats()
  }
})
</script>
