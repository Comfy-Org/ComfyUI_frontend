<template>
  <PanelTemplate value="About" class="about-container">
    <h2 class="text-2xl font-bold mb-2">{{ $t('g.about') }}</h2>
    <div class="space-y-2">
      <a
        v-for="badge in aboutPanelStore.badges"
        :key="badge.label"
        @click="handleBadgeClick(badge, $event)"
        rel="noopener noreferrer"
        class="about-badge inline-flex items-center no-underline"
        :title="badge.type === 'url' ? badge.url : null"
      >
        <Tag class="mr-2">
          <template #icon>
            <i :class="[badge.icon, 'mr-2 text-xl']"></i>
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
  </PanelTemplate>
</template>

<script setup lang="ts">
import Divider from 'primevue/divider'
import Tag from 'primevue/tag'
import { onMounted } from 'vue'

import SystemStatsPanel from '@/components/common/SystemStatsPanel.vue'
import { useAboutPanelStore } from '@/stores/aboutPanelStore'
import { useCommandStore } from '@/stores/commandStore'
import { useSystemStatsStore } from '@/stores/systemStatsStore'
import type { AboutPageBadge } from '@/types/comfy'

import PanelTemplate from './PanelTemplate.vue'

const systemStatsStore = useSystemStatsStore()
const aboutPanelStore = useAboutPanelStore()

const handleBadgeClick = (badge: AboutPageBadge, event: MouseEvent) => {
  if (badge.type === 'command') {
    event.preventDefault()
    useCommandStore().execute(badge.command)
  } else {
    window.open(badge.url, '_blank')
  }
}

onMounted(async () => {
  if (!systemStatsStore.systemStats) {
    await systemStatsStore.fetchSystemStats()
  }
})
</script>
