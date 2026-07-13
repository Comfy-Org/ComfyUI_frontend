<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import ApiCodeBlock from './ApiCodeBlock.vue'
import type { ApiSpec } from './apiSpec'
import { exampleResponseBody } from './apiSpec'
import ApiDocsSection from './ApiDocsSection.vue'

const { spec } = defineProps<{ spec: ApiSpec }>()

const { t } = useI18n()

const exampleResponse = computed(() =>
  JSON.stringify(exampleResponseBody(spec), null, 2)
)
</script>

<template>
  <ApiDocsSection
    :title="t('apiBuilder.responseTitle')"
    :description="t('apiBuilder.responseDescription')"
  >
    <div class="flex flex-col gap-4">
      <div>
        <h3 class="m-0 text-xs font-medium text-muted-foreground uppercase">
          {{ t('apiBuilder.outputsLabel') }}
        </h3>
        <ul class="m-0 mt-2 flex list-none flex-col gap-2 p-0">
          <li
            v-for="output in spec.outputs"
            :key="output.key"
            class="flex items-center gap-2"
          >
            <i class="icon-[lucide--image] size-4 text-muted-foreground" />
            <code
              class="rounded-md bg-secondary-background px-1.5 py-0.5 font-mono text-xs"
            >
              {{ output.key }}
            </code>
          </li>
        </ul>
      </div>
      <div>
        <h3 class="m-0 text-xs font-medium text-muted-foreground uppercase">
          {{ t('apiBuilder.exampleResponse') }}
        </h3>
        <ApiCodeBlock class="mt-2" :code="exampleResponse" language="json" />
      </div>
    </div>
  </ApiDocsSection>
</template>
