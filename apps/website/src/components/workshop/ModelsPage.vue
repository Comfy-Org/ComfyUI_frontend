<script setup lang="ts">
import { useMounted } from '@vueuse/core'
import { defineAsyncComponent, h, shallowRef, useSlots } from 'vue'
import type { FunctionalComponent } from 'vue'

import {
  fetchModelsCatalogue,
  fetchModelsPage
} from '../../config/models-page-data'
import { t } from '../../i18n/translations'

import WorkshopLoading from './WorkshopLoading.vue'

const { slug } = defineProps<{
  slug?: string
}>()

const slots = useSlots()
const mounted = useMounted()
const loadingLabel = t('workshop.load.pending', 'en')

// The page around this island is static and public; the island only adds
// the interactive catalogue or the playground on top. Its `loading` slot is
// what the server renders and what stays up while the data loads, so a
// crawler, a reader without script, and a visitor on a slow connection all
// get the same content. Without a slot, a compact frame marks the spot.
const Loading: FunctionalComponent = () =>
  slots.loading?.() ??
  h(WorkshopLoading, {
    label: loadingLabel,
    minh: false,
    'data-testid': 'models-loading'
  })

const LoadError: FunctionalComponent<{ error?: unknown }> = () =>
  h(
    'div',
    {
      role: 'alert',
      class:
        'flex flex-col items-center justify-center gap-6 px-6 py-16 text-center text-primary-warm-white',
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
        const [{ default: ModelDetail }, page] = await Promise.all([
          import('./ModelDetail.vue'),
          fetchModelsPage(slug)
        ])
        return () => h(ModelDetail, { model: page.model })
      }
      const [{ default: ModelsCatalogue }, models] = await Promise.all([
        import('./ModelsCatalogue.vue'),
        fetchModelsCatalogue()
      ])
      return () => h(ModelsCatalogue, { models })
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
  <!-- Data loads in the browser only. On the server, and until hydration,
    the static slot is the page; rendering the async component there would
    fetch page data at build time and bake its failure into the HTML. -->
  <component :is="Content" v-if="mounted" />
  <Loading v-else />
</template>
