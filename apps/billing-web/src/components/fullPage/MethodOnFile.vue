<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { SavedPaymentMethod } from '@comfyorg/account-core/billing'

import SavedMethodSelect from '@/components/fullPage/SavedMethodSelect.vue'

const { methods } = defineProps<{
  methods: readonly SavedPaymentMethod[]
}>()

const { t } = useI18n()

/** The server charges a method on file to its default; no request can name another. */
const onFile = computed(() => methods.find((method) => method.is_default))
</script>

<template>
  <div v-if="onFile" class="flex flex-col gap-3">
    <h3 class="m-0 text-base font-normal text-base-foreground">
      {{ t('checkout.paymentMethod') }}
    </h3>
    <SavedMethodSelect :methods="[onFile]" :model-value="onFile.id" />
  </div>
</template>
