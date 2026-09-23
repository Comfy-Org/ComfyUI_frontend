<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'
import { computed } from 'vue'

import type { WorkshopModel } from '../../config/models-catalogue'
import type { Locale } from '../../i18n/translations'
import type { HubKey } from '../../i18n/hub'
import { tHub } from '../../i18n/hub'
import type { HubPortSummary } from '../../lib/hub/workflow-detail'
import IconModel from './IconModel.vue'
import type { WorkflowReach } from '../../lib/hub/workflow-reach'
import { mediaLabel } from './mediaLabel'

const {
  models,
  author,
  usage,
  produces,
  reach,
  openWeights,
  added,
  locale = 'en'
} = defineProps<{
  models: readonly { name: string; model: WorkshopModel | undefined }[]
  author: string
  /** How many times the registry has seen it run. */
  usage: number
  produces: readonly HubPortSummary[]
  /** Where it runs, which is Comfy Cloud unless it needs a server of its own. */
  reach: WorkflowReach | undefined
  /** Whether the weights behind it can be downloaded and run anywhere. */
  openWeights: boolean
  added: string
  locale?: Locale
}>()

const output = computed(() => produces[0])

// One fact per line, each one saying which fact it is. An icon in front of a
// date or a name names nothing the word beside it does not, and five of them
// in a column read as decoration standing in for structure.
const facts = computed<{ label: HubKey; value: string }[]>(() => {
  const rows: { label: HubKey; value: string }[] = [
    {
      label: 'workshop.v2.workflow.factWhere',
      value: tHub(
        reach === 'endpoint'
          ? 'workshop.v2.workflow.runsOwn'
          : 'workshop.v2.workflow.runsCloud',
        locale
      )
    }
  ]
  if (output.value)
    rows.push({
      label: 'workshop.v2.workflow.factOutput',
      value: `${mediaLabel(output.value.media, locale)}, ${tHub(
        'workshop.v2.workflow.perRun',
        locale
      ).replace('{count}', String(output.value.count))}`
    })
  if (usage > 0)
    rows.push({
      label: 'workshop.v2.workflow.factRuns',
      value: new Intl.NumberFormat(locale).format(usage)
    })
  if (openWeights)
    rows.push({
      label: 'workshop.v2.workflow.factWeights',
      value: tHub('workshop.v2.workflow.openWeights', locale)
    })
  rows.push({ label: 'workshop.v2.workflow.factAuthor', value: author })

  const date = new Date(added)
  rows.push({
    label: 'workshop.v2.workflow.factAdded',
    value: Number.isNaN(date.valueOf())
      ? added
      : new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date)
  })
  return rows
})

const band = 'border-t border-transparency-white-t8 px-5 py-4 first:border-t-0'
const bandHeading =
  'text-2xs font-bold tracking-wider text-primary-warm-gray uppercase'
</script>

<template>
  <div
    class="overflow-hidden rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4"
    data-testid="workflow-facts"
  >
    <section
      v-if="models.length > 0"
      :class="band"
      data-testid="workflow-runs-on"
    >
      <h2 :class="bandHeading">
        {{ tHub('workshop.v2.workflow.runsOn', locale) }}
      </h2>
      <ul class="mt-2 flex flex-col gap-1">
        <li v-for="ref in models" :key="ref.name">
          <a
            v-if="ref.model"
            :href="ref.model.href"
            class="group -mx-2 flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors outline-none hover:bg-transparency-white-t8 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
          >
            <IconModel
              class="size-4 shrink-0 text-primary-warm-gray"
              aria-hidden="true"
            />
            <span
              class="min-w-0 flex-1 truncate text-base text-primary-comfy-canvas"
            >
              {{ ref.name }}
            </span>
            <ChevronRight
              class="size-4 shrink-0 text-primary-warm-gray transition-colors group-hover:text-primary-comfy-yellow"
            />
          </a>
          <span v-else class="flex items-center gap-2.5 py-1.5">
            <IconModel
              class="size-4 shrink-0 text-primary-warm-gray"
              aria-hidden="true"
            />
            <span class="min-w-0 truncate text-base text-primary-comfy-canvas">
              {{ ref.name }}
            </span>
          </span>
        </li>
      </ul>
    </section>

    <section :class="band" data-testid="workflow-details">
      <dl class="flex flex-col gap-1 text-sm">
        <div
          v-for="fact in facts"
          :key="fact.label"
          class="grid grid-cols-[7rem_1fr] gap-4"
        >
          <dt class="text-primary-warm-gray">{{ tHub(fact.label, locale) }}</dt>
          <dd class="min-w-0 text-primary-comfy-canvas tabular-nums">
            {{ fact.value }}
          </dd>
        </div>
      </dl>
    </section>
  </div>
</template>
