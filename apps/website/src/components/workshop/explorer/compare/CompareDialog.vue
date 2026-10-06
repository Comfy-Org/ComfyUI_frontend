<script setup lang="ts">
import { computed } from 'vue'

import Dialog from '@/components/ui/dialog/Dialog.vue'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import type { WorkshopModel } from '@/config/models-catalogue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { compareRows } from '@/lib/workshop/explorer/compare'

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
          <thead>
            <tr>
              <td class="w-36" />
              <th
                v-for="model in models"
                :key="model.slug"
                scope="col"
                class="pr-4 pb-4 align-bottom font-medium text-primary-warm-white"
              >
                {{ model.name }}
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
              <th
                scope="row"
                class="py-3 pr-4 text-xs font-medium tracking-wider text-primary-warm-gray uppercase"
              >
                {{ t('workshop.explorer.compare.page') }}
              </th>
              <td v-for="model in models" :key="model.slug" class="py-3 pr-4">
                <a
                  v-if="model.href"
                  :href="model.href"
                  class="rounded-lg font-medium text-primary-comfy-yellow underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
                  data-testid="compare-model-link"
                >
                  {{ t('workshop.explorer.compare.openModel') }}
                  <span class="sr-only">{{ model.name }}</span>
                </a>
                <span v-else class="text-primary-comfy-canvas">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </DialogContent>
  </Dialog>
</template>
