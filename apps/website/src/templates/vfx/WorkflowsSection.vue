<script setup lang="ts">
import { computed } from 'vue'

import type { Locale } from '@/i18n/translations'

import CardWorkflowGallery01 from '@/components/blocks/CardWorkflowGallery01.vue'
import type { CardWorkflowItem } from '@/components/blocks/CardWorkflow01.vue'
import CtaBands01 from '@/components/blocks/CtaBands01.vue'
import {
  vfxTutorialsHref,
  vfxWorkflows,
  vfxWorkflowsLibraryHref
} from '@/data/vfx'
import { translationsFor } from '@/i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)

const items = computed<CardWorkflowItem[]>(() =>
  vfxWorkflows(locale).map((workflow) => ({ ...workflow }))
)
</script>

<template>
  <CardWorkflowGallery01
    :title="t('vfx.workflows.title')"
    title-align="center"
    :items
  />
  <CtaBands01
    class="pt-0 lg:pt-0"
    variant="highlight"
    :bands="[
      {
        id: 'tutorials',
        label: t('vfx.workflows.tutorials.label'),
        text: t('vfx.workflows.tutorials.text'),
        cta: {
          label: t('vfx.workflows.tutorials.cta'),
          href: vfxTutorialsHref(locale)
        }
      },
      {
        id: 'library',
        label: t('vfx.workflows.library.label'),
        text: t('vfx.workflows.library.text'),
        cta: {
          label: t('vfx.workflows.library.cta'),
          href: vfxWorkflowsLibraryHref,
          target: '_blank'
        }
      }
    ]"
  />
</template>
