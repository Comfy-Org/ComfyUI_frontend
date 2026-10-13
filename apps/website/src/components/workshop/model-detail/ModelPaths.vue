<script setup lang="ts">
import { ArrowUpRight, Code } from '@lucide/vue'

import Button from '@/components/ui/button/Button.vue'
import { WORKSHOP_CLOUD_BASE_URL } from '@/config/workshop-env'
import { t } from '@/i18n/translations'
import type { PagePaths } from '@/lib/workshop/page-paths'
import { scrollToSection } from '@/lib/workshop/scroll-to-section'

const { paths } = defineProps<{ paths: PagePaths }>()

function jumpToApi(event: MouseEvent) {
  event.preventDefault()
  scrollToSection('api')
}
</script>

<template>
  <ul
    :aria-label="t('workshop.model.paths.label')"
    class="flex flex-wrap gap-2"
    data-testid="model-paths"
  >
    <li v-if="paths.api">
      <Button
        href="#api"
        variant="outline"
        size="sm"
        class="border-primary-warm-white/70 text-primary-warm-white hover:bg-primary-warm-white hover:text-primary-comfy-ink"
        data-testid="model-path-api"
        @click="jumpToApi"
      >
        <template #prepend>
          <Code aria-hidden="true" />
        </template>
        {{ t('workshop.model.paths.api') }}
      </Button>
    </li>
    <li>
      <Button
        :href="WORKSHOP_CLOUD_BASE_URL"
        target="_blank"
        rel="noopener"
        :variant="paths.run ? 'ghost' : 'default'"
        size="sm"
        class="font-bold tracking-wider uppercase"
        data-testid="model-path-cloud"
      >
        {{ t('workshop.model.paths.cloud') }}
        <template #append>
          <ArrowUpRight aria-hidden="true" />
        </template>
      </Button>
    </li>
  </ul>
</template>
