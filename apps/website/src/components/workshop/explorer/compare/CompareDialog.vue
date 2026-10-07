<script setup lang="ts">
import { computed } from 'vue'

import Dialog from '@/components/ui/dialog/Dialog.vue'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import type { WorkshopModel } from '@/config/models-catalogue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { compareRows } from '@/lib/workshop/explorer/compare'
import WorkshopCardMedia from '@/components/workshop/WorkshopCardMedia.vue'

const { models, locale = 'en' } = defineProps<{
  models: readonly WorkshopModel[]
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const open = defineModel<boolean>('open', { default: false })
const rows = computed(() => compareRows(models, locale))
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      :close-label="t('workshop.explorer.compare.close')"
      :aria-describedby="undefined"
      class="flex flex-col gap-6 sm:max-w-4xl"
      data-testid="compare-dialog"
    >
      <div class="flex flex-col gap-2 pr-16">
        <p
          class="text-sm font-medium tracking-widest text-primary-comfy-yellow uppercase"
        >
          {{ t('workshop.explorer.compare.label') }}
        </p>
        <DialogTitle class="text-2xl font-light lg:text-3xl">
          {{ t('workshop.explorer.compare.title', { count: models.length }) }}
        </DialogTitle>
      </div>

      <div class="overflow-x-auto">
        <table
          class="w-full min-w-136 table-fixed border-collapse text-left text-sm"
        >
          <colgroup>
            <col class="w-36" />
            <col v-for="model in models" :key="model.slug" />
          </colgroup>
          <thead>
            <tr>
              <td />
              <th
                v-for="model in models"
                :key="model.slug"
                scope="col"
                class="pr-4 pb-4 align-bottom font-medium text-primary-warm-white"
              >
                <component
                  :is="model.href ? 'a' : 'span'"
                  :href="model.href"
                  class="group flex flex-col gap-2 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
                >
                  <span
                    class="relative block aspect-4/3 w-full overflow-hidden rounded-xl bg-hub-surface"
                    data-testid="compare-thumbnail"
                  >
                    <WorkshopCardMedia :model />
                  </span>
                  <span
                    class="transition-colors group-hover:text-primary-comfy-yellow"
                  >
                    {{ model.name }}
                  </span>
                </component>
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
              <th
                scope="row"
                class="py-3 pr-4 text-xs font-medium tracking-wider text-primary-warm-gray uppercase"
              >
                {{ t(row.label) }}
              </th>
              <td
                v-for="(value, index) in row.values"
                :key="models[index].slug"
                class="py-3 pr-4 text-primary-comfy-canvas"
              >
                {{ value }}
              </td>
            </tr>
            <tr class="border-t border-transparency-white-t8">
              <td />
              <td v-for="model in models" :key="model.slug" class="pt-5 pr-4">
                <a
                  v-if="model.href"
                  :href="model.href"
                  class="flex h-10 w-full items-center justify-center rounded-2xl border border-transparency-white-t20 px-4 text-sm font-medium text-primary-warm-white transition-colors outline-none hover:border-primary-comfy-yellow hover:text-primary-comfy-yellow focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
                  data-testid="compare-model-link"
                >
                  <span class="truncate">
                    {{
                      t('workshop.explorer.compare.try', { name: model.name })
                    }}
                  </span>
                </a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </DialogContent>
  </Dialog>
</template>
