<script setup lang="ts">
import { defineAsyncComponent, h, shallowRef } from 'vue'
import type { FunctionalComponent } from 'vue'

import {
  fetchModelsCatalogue,
  fetchModelsPage
} from '../../config/models-page-data'
import { t } from '../../i18n/translations'

import WorkshopGate from './WorkshopGate.vue'
import WorkshopLoading from './WorkshopLoading.vue'

const { slug } = defineProps<{
  slug?: string
}>()

const loadingLabel = t('workshop.load.pending', 'en')

const Loading: FunctionalComponent = () =>
  h(WorkshopLoading, { label: loadingLabel, 'data-testid': 'models-loading' })

const LoadError: FunctionalComponent<{ error?: unknown }> = () =>
  h(
    'div',
    {
      role: 'alert',
      class:
        'flex min-h-svh flex-col items-center justify-center gap-6 px-6 text-center text-primary-warm-white',
      'data-testid': 'models-load-error'
    },
    [
      h('p', { class: 'text-lg' }, t('workshop.load.failed', 'en')),
      h(
        'button',
        {
          type: 'button',
          class:
            'bg-primary-comfy-yellow hover:bg-primary-comfy-yellow/90 h-11 cursor-pointer rounded-2xl px-6 text-sm font-bold text-primary-comfy-ink',
          'data-testid': 'models-retry',
          onClick: () => {
            Content.value = createContent()
          }
        },
        t('workshop.error.retry', 'en')
      )
    ]
  )
LoadError.props = ['error']

function createContent() {
  return defineAsyncComponent({
    loader: async () => {
      if (slug) {
        const [{ default: ModelPage }, page] = await Promise.all([
          import('./ModelPage.vue'),
          fetchModelsPage(slug)
        ])
        return () => h(ModelPage, { page })
      }
      const [{ default: ModelsCatalogue }, models] = await Promise.all([
        import('./ModelsCatalogue.vue'),
        fetchModelsCatalogue()
      ])
      return () =>
        h(
          'div',
          {
            class:
              'max-w-10xl mx-auto px-6 pt-8 pb-16 max-sm:pt-5 max-sm:pb-10 lg:px-8 lg:pt-12 lg:pb-24'
          },
          [h(ModelsCatalogue, { models })]
        )
    },
    loadingComponent: Loading,
    errorComponent: LoadError,
    onError: (_error, retry, fail, attempts) => {
      if (attempts <= 1) retry()
      else fail()
    },
    delay: 0
  })
}

const Content = shallowRef(createContent())
</script>

<template>
  <WorkshopGate :keep-mounted="Boolean(slug)">
    <component :is="Content" />
    <template #loading>
      <WorkshopLoading :label="loadingLabel" />
    </template>
    <template #fallback>
      <slot name="fallback" />
    </template>
  </WorkshopGate>
</template>
