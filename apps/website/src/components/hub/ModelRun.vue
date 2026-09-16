<script setup lang="ts">
import { ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { WorkshopModelDetail } from '../../config/models-catalogue'
import type { Locale } from '../../i18n/translations'
import ModelDetail from '../workshop/ModelDetail.vue'

interface RunnableOperation {
  readonly slug: string
  readonly task: string
  readonly price: string | undefined
  readonly detail: WorkshopModelDetail
}

const { operations, locale = 'en' } = defineProps<{
  operations: readonly RunnableOperation[]
  locale?: Locale
}>()

// The registry lists a model once per operation and the catalogue collapses
// them into one name, so the page has to hand that choice back before it can
// run anything. A name with a single operation has nothing to choose.
const chosen = ref(0)
</script>

<template>
  <div data-testid="model-run">
    <div
      v-if="operations.length > 1"
      class="mb-6 flex flex-wrap items-center gap-1 rounded-2xl bg-transparency-white-t4 p-1"
      data-testid="model-operations"
    >
      <button
        v-for="(operation, index) in operations"
        :key="operation.slug"
        type="button"
        :aria-pressed="index === chosen"
        :class="
          cn(
            'inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl px-4 text-sm transition-colors',
            index === chosen
              ? 'bg-primary-comfy-yellow text-primary-comfy-ink'
              : 'text-content-secondary hover:text-content-bright'
          )
        "
        @click="chosen = index"
      >
        {{ operation.task }}
        <span
          v-if="operation.price"
          class="font-mono text-2xs tabular-nums opacity-70"
        >
          {{ operation.price }}
        </span>
      </button>
    </div>

    <ModelDetail
      :key="operations[chosen].slug"
      :model="operations[chosen].detail"
      :locale
    />
  </div>
</template>
