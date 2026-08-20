<script setup lang="ts">
import type { Locale, TranslationKey } from '../../i18n/translations'

import SectionHeader from '../../components/common/SectionHeader.vue'
import WireNodeLayout from '../../components/common/WireNodeLayout.vue'
import { t } from '../../i18n/translations'

const { locale } = defineProps<{ locale: Locale }>()

const reasons: TranslationKey[] = [
  'fdct.builders.reason1',
  'fdct.builders.reason2',
  'fdct.builders.reason3',
  'fdct.builders.reason4'
]
</script>

<template>
  <section class="px-6 py-24 lg:px-20 lg:py-32">
    <SectionHeader>
      {{ t('fdct.builders.title', locale) }}
      <template #subtitle>
        <p
          class="mx-auto mt-6 max-w-xl text-base font-light text-primary-comfy-canvas lg:text-lg"
        >
          {{ t('fdct.builders.lead', locale) }}
        </p>
      </template>
    </SectionHeader>
    <div class="mt-16 lg:mt-24">
      <WireNodeLayout
        variant="node"
        label-key="fdct.builders.nodeLabel"
        :reasons
        :locale
      />
    </div>
  </section>
</template>
