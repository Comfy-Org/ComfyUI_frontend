<script setup lang="ts">
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import { computed, ref } from 'vue'

import type { Locale } from '../../i18n/translations'
import type { ModelLaunchCompare } from './types'

import VideoCompareSlider from '../../components/common/VideoCompareSlider.vue'
import { t } from '../../i18n/translations'

const { locale = 'en', compare } = defineProps<{
  compare: ModelLaunchCompare
  locale?: Locale
}>()

const activeId = ref(compare.tabs[0]?.id ?? '')
const activeTab = computed(
  () => compare.tabs.find((tab) => tab.id === activeId.value) ?? compare.tabs[0]
)
</script>

<template>
  <section class="mx-auto max-w-9xl px-6 py-16 lg:px-20 lg:py-24">
    <TabsRoot
      v-model="activeId"
      class="flex flex-col items-stretch gap-10 rounded-5xl bg-transparency-white-t4 p-2 lg:flex-row lg:gap-8"
    >
      <div class="flex min-w-0 flex-1 flex-col justify-between p-6">
        <div>
          <h2 class="text-3xl font-light text-primary-comfy-canvas lg:text-4xl">
            {{ t(compare.headingKey, locale) }}
          </h2>
          <p
            v-if="compare.bodyKey"
            class="mt-6 text-sm text-primary-comfy-canvas/70"
          >
            {{ t(compare.bodyKey, locale) }}
          </p>
        </div>

        <div class="mt-10 flex flex-col gap-4">
          <TabsList
            :aria-label="t('modelLaunch.compare.tabsLabel', locale)"
            class="scrollbar-none flex w-full max-w-full overflow-x-auto rounded-2xl border border-white/15 bg-primary-comfy-ink p-1 sm:w-auto sm:self-start"
          >
            <TabsTrigger
              v-for="tab in compare.tabs"
              :key="tab.id"
              :value="tab.id"
              class="flex-1 cursor-pointer rounded-xl px-1 py-2 text-center text-[10px] font-bold tracking-normal whitespace-nowrap text-smoke-700 uppercase transition-colors hover:text-primary-comfy-canvas focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none data-[state=active]:bg-secondary-mauve data-[state=active]:text-primary-warm-white sm:flex-none sm:px-5 sm:text-xs sm:tracking-wider lg:px-2 lg:text-[11px] lg:tracking-normal xl:px-5 xl:text-xs xl:tracking-wider"
            >
              {{ tab.label[locale] || tab.label.en }}
            </TabsTrigger>
          </TabsList>
          <p
            v-if="activeTab"
            aria-live="polite"
            class="text-sm text-primary-comfy-canvas"
          >
            {{ activeTab.caption[locale] || activeTab.caption.en }}
          </p>
        </div>
      </div>

      <div class="w-full min-w-0 flex-1">
        <TabsContent
          v-for="tab in compare.tabs"
          :key="tab.id"
          :value="tab.id"
          class="focus-visible:outline-none"
        >
          <VideoCompareSlider
            :before-src="tab.beforeSrc"
            :after-src="tab.afterSrc"
            :before-label="t('modelLaunch.compare.before', locale)"
            :after-label="t('modelLaunch.compare.after', locale)"
            :slider-label="t('modelLaunch.compare.sliderLabel', locale)"
            class="rounded-4.5xl"
          />
        </TabsContent>
      </div>
    </TabsRoot>
  </section>
</template>
