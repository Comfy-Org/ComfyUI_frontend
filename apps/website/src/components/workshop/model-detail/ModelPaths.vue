<script setup lang="ts">
import { Cloud, Code, Play } from '@lucide/vue'

import Button from '@/components/ui/button/Button.vue'
import { WORKSHOP_CLOUD_BASE_URL } from '@/config/workshop-env'
import { t } from '@/i18n/translations'
import type { PagePaths } from '@/lib/workshop/page-paths'
import { scrollToSection } from '@/lib/workshop/scroll-to-section'

const { paths } = defineProps<{ paths: PagePaths }>()

const secondaryPathClass = 'font-bold tracking-wider uppercase'
function jumpTo(event: MouseEvent, section: 'playground' | 'api') {
  event.preventDefault()
  scrollToSection(section)
}
</script>

<template>
  <ul
    :aria-label="t('workshop.model.paths.label')"
    class="flex flex-wrap gap-2"
    data-testid="model-paths"
  >
    <li v-if="paths.run">
      <Button
        href="#playground"
        size="sm"
        data-testid="model-path-run"
        @click="jumpTo($event, 'playground')"
      >
        <template #prepend>
          <Play class="size-3.5 fill-current" aria-hidden="true" />
        </template>
        {{ t('workshop.model.paths.run') }}
      </Button>
    </li>
    <li>
      <Button
        :href="WORKSHOP_CLOUD_BASE_URL"
        target="_blank"
        rel="noopener"
        variant="ghost"
        size="sm"
        :class="secondaryPathClass"
        data-testid="model-path-cloud"
      >
        <template #prepend>
          <Cloud aria-hidden="true" />
        </template>
        {{ t('workshop.model.paths.cloud') }}
      </Button>
    </li>
    <li v-if="paths.api">
      <Button
        href="#api"
        variant="ghost"
        size="sm"
        :class="secondaryPathClass"
        data-testid="model-path-api"
        @click="jumpTo($event, 'api')"
      >
        <template #prepend>
          <Code aria-hidden="true" />
        </template>
        {{ t('workshop.model.paths.api') }}
      </Button>
    </li>
  </ul>
</template>
