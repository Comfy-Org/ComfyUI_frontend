<script setup lang="ts">
import { nextTick, ref, useTemplateRef } from 'vue'

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

// The choice sits under the playground's own tabs, inside the part a switch
// rebuilds, so the button that was just pressed is gone by the time the press
// finishes and the keyboard would be left with nothing.
const tabs = useTemplateRef<HTMLButtonElement[]>('tabs')

async function choose(index: number) {
  chosen.value = index
  await nextTick()
  tabs.value?.[index]?.focus()
}
</script>

<template>
  <div data-testid="model-run">
    <ModelDetail
      :key="operations[chosen].slug"
      :model="operations[chosen].detail"
      :locale
    >
      <template v-if="operations.length > 1" #operations>
        <div
          class="inline-flex w-fit flex-wrap items-center gap-1 rounded-2xl bg-transparency-white-t4 p-1"
          data-testid="model-operations"
        >
          <button
            v-for="(operation, index) in operations"
            :key="operation.slug"
            ref="tabs"
            type="button"
            :aria-pressed="index === chosen"
            :class="
              cn(
                'inline-flex h-8 cursor-pointer items-center gap-2 rounded-xl px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50',
                index === chosen
                  ? 'bg-transparency-white-t20 text-content-bright'
                  : 'text-content-secondary hover:text-content-bright'
              )
            "
            @click="choose(index)"
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
      </template>
    </ModelDetail>
  </div>
</template>
