<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { t } from '../../i18n/translations'
import NodeBadge from '../common/NodeBadge.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const row1 = [{ text: 'BUILD WHAT' }]
const row2 = [{ text: "DOESN'T EXIST" }, { text: 'YET' }]
</script>

<template>
  <section
    class="bg-primary-comfy-ink flex flex-col items-center px-4 py-24 lg:px-6 lg:py-32"
  >
    <!-- Node rows -->
    <div
      class="font-formula-condensed relative flex flex-col items-center font-semibold"
    >
      <NodeBadge :segments="row1" />

      <!-- Vertical connector -->
      <img
        src="/icons/node-link.svg"
        alt=""
        class="-my-3.5 scale-25 rotate-90 lg:-my-1.75 lg:scale-100"
        aria-hidden="true"
      />

      <NodeBadge :segments="row2" />
    </div>

    <!-- Subtitle -->
    <p
      class="text-primary-comfy-canvas mt-24 max-w-2xl text-center text-xl lg:text-sm"
    >
      {{ t('buildWhat.subtitle', locale) }}
    </p>
  </section>
</template>
