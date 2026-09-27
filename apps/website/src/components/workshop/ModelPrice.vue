<script setup lang="ts">
import { computed } from 'vue'

import InfoTooltip from '@/components/ui/tooltip/InfoTooltip.vue'
import { splitPriceLabel } from '../../lib/workshop/price-label'
import { t } from '../../i18n/translations'

const { estimate } = defineProps<{ estimate?: string }>()

const price = computed(() => splitPriceLabel(estimate ?? ''))
</script>

<template>
  <p
    class="flex items-baseline gap-2 text-lg text-primary-warm-white"
    data-testid="model-price"
  >
    <template v-if="estimate">
      <span class="flex items-baseline">
        <span class="font-semibold">{{ price.amount }}</span
        ><span v-if="price.per" class="text-sm text-primary-warm-gray">{{
          price.per
        }}</span>
      </span>
      <InfoTooltip
        :text="t('workshop.model.nodePriceDefaults')"
        :label="t('workshop.model.priceNoteLabel')"
      />
    </template>
    <template v-else>{{ t('workshop.model.variablePrice') }}</template>
  </p>
</template>
