<script setup lang="ts">
import { Link, Plus, X } from '@lucide/vue'
import { useClipboard } from '@vueuse/core'
import { computed, ref, useId, watch } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import IconButton from '@/components/ui/icon-button/IconButton.vue'
import WorkshopCardMedia from '@/components/workshop/WorkshopCardMedia.vue'
import type { WorkshopModel } from '@/config/models-catalogue'
import type { SamePromptSample } from '@/data/compareSamePrompt'
import { SAME_PROMPT_SAMPLES } from '@/data/compareSamePrompt'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { compareRows, MAX_COMPARED } from '@/lib/workshop/explorer/compare'
import { accessFor } from '@/lib/workshop/explorer/model-access'
import type { SamePromptFilter } from '@/lib/workshop/explorer/same-prompt'
import {
  samePromptRows,
  samePromptTypes
} from '@/lib/workshop/explorer/same-prompt'

const {
  models,
  toolbar = false,
  removable = false,
  samples = SAME_PROMPT_SAMPLES,
  locale = 'en'
} = defineProps<{
  models: readonly WorkshopModel[]
  /** The catalogue's own view: a title, Add model and Copy link. */
  toolbar?: boolean
  /** Whether each column can be taken out of the comparison. */
  removable?: boolean
  samples?: readonly SamePromptSample[]
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{ remove: [slug: string]; add: [] }>()

const titleId = `compare-view-${useId()}`
const rows = computed(() => compareRows(models, locale))
const slugs = computed(() => models.map((model) => model.slug))
const types = computed(() => samePromptTypes(samples, slugs.value))
const filter = ref<SamePromptFilter>('all')
watch(types, (offered) => {
  if (filter.value !== 'all' && !offered.includes(filter.value))
    filter.value = 'all'
})
const prompts = computed(() =>
  samePromptRows(samples, slugs.value, filter.value)
)
const filters = computed<SamePromptFilter[]>(() => ['all', ...types.value])

const { copy, copied } = useClipboard({ legacy: true })
function copyLink() {
  void copy(location.href)
}

const cellClass = 'px-2 py-3 align-top'
const labelClass =
  'sticky left-0 z-10 bg-page py-3 pr-3 text-xs font-medium tracking-wider text-primary-warm-gray uppercase'
</script>

<template>
  <section
    :aria-labelledby="toolbar ? titleId : undefined"
    data-testid="compare-view"
  >
    <header
      v-if="toolbar"
      class="mb-8 flex flex-wrap items-center justify-between gap-4"
    >
      <h2
        :id="titleId"
        class="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-2xl font-light text-primary-warm-white sm:text-3xl lg:text-4xl"
      >
        {{ t('workshop.explorer.compare.viewTitle', { count: models.length }) }}
        <span class="text-base whitespace-nowrap text-primary-warm-gray">
          {{ t('workshop.explorer.compare.upTo', { max: MAX_COMPARED }) }}
        </span>
      </h2>
      <div class="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          :prepend-icon="Plus"
          data-testid="compare-add"
          @click="emit('add')"
        >
          {{ t('workshop.explorer.compare.add') }}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          :prepend-icon="Link"
          data-testid="compare-copy"
          @click="copyLink"
        >
          <span aria-live="polite">
            {{
              copied
                ? t('workshop.explorer.compare.copied')
                : t('workshop.explorer.compare.copyLink')
            }}
          </span>
        </Button>
      </div>
    </header>

    <div class="-mx-6 overflow-x-auto px-6 lg:mx-0 lg:px-0">
      <table
        class="w-full table-fixed border-collapse text-left text-sm"
        :style="{ minWidth: `${7 + models.length * 14}rem` }"
      >
        <colgroup>
          <col class="w-28 sm:w-40" />
          <col v-for="model in models" :key="model.slug" />
        </colgroup>
        <thead>
          <tr>
            <td class="sticky left-0 z-10 bg-page" />
            <th
              v-for="model in models"
              :key="model.slug"
              scope="col"
              :class="cn(cellClass, 'pt-0 font-normal')"
              :aria-label="model.name"
              data-testid="compare-column"
            >
              <div
                class="relative flex flex-col gap-3 rounded-3xl bg-hub-surface p-2 pb-4"
              >
                <span
                  class="relative block aspect-4/3 w-full overflow-hidden rounded-2xl bg-hub-surface"
                  data-testid="compare-thumbnail"
                >
                  <WorkshopCardMedia :model />
                </span>
                <IconButton
                  v-if="removable"
                  type="button"
                  size="sm"
                  class="absolute top-4 right-4 z-10 bg-primary-comfy-ink/60 backdrop-blur-md"
                  :aria-label="
                    t('workshop.explorer.compare.remove', { name: model.name })
                  "
                  data-testid="compare-remove"
                  @click="emit('remove', model.slug)"
                >
                  <X class="size-3.5" aria-hidden="true" />
                </IconButton>
                <div class="flex flex-col gap-1 px-2">
                  <span class="text-base font-medium text-primary-warm-white">
                    {{ model.name }}
                  </span>
                  <span class="text-xs text-primary-warm-gray">
                    {{ model.provider ?? '—' }}
                  </span>
                </div>
                <div class="flex flex-wrap gap-2 px-2">
                  <Button
                    v-if="model.href"
                    :href="model.href"
                    size="sm"
                    :aria-label="
                      t('workshop.explorer.compare.try', { name: model.name })
                    "
                    data-testid="compare-model-link"
                  >
                    {{ t('workshop.explorer.compare.tryShort') }}
                  </Button>
                  <Button
                    v-if="model.href && accessFor(model).includes('api')"
                    :href="`${model.href}#api`"
                    variant="outline"
                    size="sm"
                    :aria-label="
                      t('workshop.explorer.compare.apiFor', {
                        name: model.name
                      })
                    "
                    data-testid="compare-api-link"
                  >
                    {{ t('workshop.explorer.compare.api') }}
                  </Button>
                </div>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.key"
            class="border-t border-transparency-white-t8"
            :data-testid="`compare-row-${row.key}`"
          >
            <th scope="row" :class="labelClass">{{ t(row.label) }}</th>
            <td
              v-for="(value, index) in row.values"
              :key="models[index].slug"
              :class="cn(cellClass, 'text-primary-comfy-canvas')"
            >
              {{ value }}
            </td>
          </tr>
        </tbody>
        <tbody v-if="types.length" data-testid="compare-same-prompt">
          <tr class="border-t border-transparency-white-t8">
            <td :colspan="models.length + 1" class="pt-10 pb-4">
              <div
                class="sticky left-0 flex w-fit max-w-[calc(100vw-3rem)] flex-col gap-3"
              >
                <h3 class="text-xl font-medium text-primary-warm-white">
                  {{ t('workshop.explorer.compare.samePrompt') }}
                </h3>
                <p class="text-sm text-primary-warm-gray">
                  {{ t('workshop.explorer.compare.samePromptNote') }}
                </p>
                <div
                  role="group"
                  :aria-label="t('workshop.explorer.compare.promptTypes')"
                  class="flex flex-wrap gap-2"
                >
                  <button
                    v-for="option in filters"
                    :key="option"
                    type="button"
                    :aria-pressed="filter === option"
                    :class="
                      cn(
                        'h-8 cursor-pointer rounded-full px-3 text-xs font-medium text-primary-comfy-canvas transition-colors outline-none hover:bg-transparency-white-t4 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50',
                        filter === option
                          ? 'bg-transparency-white-t8 text-primary-warm-white'
                          : 'ring-1 ring-transparency-white-t8'
                      )
                    "
                    :data-testid="`compare-prompt-type-${option}`"
                    @click="filter = option"
                  >
                    {{ t(`workshop.explorer.compare.types.${option}`) }}
                  </button>
                </div>
              </div>
            </td>
          </tr>
          <tr
            v-for="sample in prompts"
            :key="sample.prompt"
            class="border-t border-transparency-white-t8"
            data-testid="compare-prompt-row"
          >
            <th
              scope="row"
              :class="cn(labelClass, 'tracking-normal normal-case')"
            >
              <span class="block text-2xs tracking-wider uppercase">
                {{ t('workshop.explorer.compare.prompt') }}
              </span>
              <span
                class="mt-1 block text-sm font-normal text-primary-comfy-canvas"
              >
                {{ sample.prompt }}
              </span>
            </th>
            <td v-for="model in models" :key="model.slug" :class="cellClass">
              <img
                v-if="sample.images[model.slug]"
                :src="sample.images[model.slug]"
                :alt="
                  t('workshop.explorer.compare.sampleAlt', {
                    model: model.name,
                    prompt: sample.prompt
                  })
                "
                width="960"
                height="640"
                loading="lazy"
                class="aspect-3/2 w-full rounded-2xl bg-hub-surface object-cover"
              />
              <p v-else class="py-2 text-xs text-primary-warm-gray">
                {{ t('workshop.explorer.compare.noSample') }}
              </p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
