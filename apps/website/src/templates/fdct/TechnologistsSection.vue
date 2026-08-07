<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import TeamGrid01 from '../../components/blocks/TeamGrid01.vue'
import { technologists } from '../../data/fdct'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <TeamGrid01
    :heading="t('fdct.technologists.title', locale)"
    :lead="t('fdct.technologists.lead', locale)"
    :people="technologists"
  />
</template>
