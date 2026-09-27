<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'
import { t } from '../../../i18n/translations'
import Button from '../../ui/button/Button.vue'

const { href, locale = 'en' } = defineProps<{
  href: string
  locale?: Locale
}>()
</script>

<template>
  <div class="mt-8 flex justify-center">
    <Button as="a" :href variant="default" size="lg">
      {{ t('customers.story.readMore', locale) }}
      <template #append>
        <span class="text-base" aria-hidden="true">↗</span>
      </template>
    </Button>
  </div>
</template>
