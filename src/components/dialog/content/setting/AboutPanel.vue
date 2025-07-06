<template>
  <PanelTemplate value="About" class="about-container">
    <h2 class="text-2xl font-bold mb-2">
      {{ $t('g.about') }}
    </h2>
    <div class="space-y-2">
      <a
        v-for="badge in aboutPanelStore.badges"
        :key="badge.url"
        :href="badge.url"
        target="_blank"
        rel="noopener noreferrer"
        class="about-badge inline-flex items-center no-underline"
        :title="badge.url"
      >
        <Tag class="mr-2">
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
  </PanelTemplate>
</template>

<script setup lang="ts">
import Divider from 'primevue/divider'
import Tag from 'primevue/tag'
import { onMounted } from 'vue'

import SystemStatsPanel from '@/components/common/SystemStatsPanel.vue'
import { useAboutPanelStore } from '@/stores/aboutPanelStore'
import { useSystemStatsStore } from '@/stores/systemStatsStore'

import PanelTemplate from './PanelTemplate.vue'

const systemStatsStore = useSystemStatsStore()
const aboutPanelStore = useAboutPanelStore()

onMounted(async () => {
  if (!systemStatsStore.systemStats) {
    await systemStatsStore.fetchSystemStats()
  }
})
</script>
