<template>
  <div class="about-container flex flex-col gap-2" data-testid="about-panel">
    <h2 class="mb-2 text-2xl font-bold">
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
        <Tag class="mr-2" :severity="badge.severity">
          <template #icon>
            <i :class="cn(badge.icon, 'mr-2 text-xl')" />
          </template>
          {{ badge.label }}
        </Tag>
      </a>
    </div>

    <div class="border-t border-interface-stroke" />

    <SystemStatsPanel
      v-if="systemStatsStore.systemStats"
      :stats="systemStatsStore.systemStats"
    />
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import SystemStatsPanel from '@/components/common/SystemStatsPanel.vue'
import Tag from '@/components/ui/badge/Badge.vue'
import { useAboutPanelStore } from '@/stores/aboutPanelStore'
import { useSystemStatsStore } from '@/stores/systemStatsStore'

const systemStatsStore = useSystemStatsStore()
const aboutPanelStore = useAboutPanelStore()
</script>
