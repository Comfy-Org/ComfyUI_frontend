<template>
  <section class="flex w-full flex-wrap justify-end gap-2 px-2 pb-2">
    <Button :disabled variant="textonly" autofocus @click="$emit('cancel')">
      {{ cancelTextX }}
    </Button>
    <Button
      :disabled
      :variant="confirmVariant ?? 'textonly'"
      :class="confirmClass"
      @click="$emit('confirm')"
    >
      {{ confirmTextX }}
    </Button>
  </section>
</template>
<script setup lang="ts">
import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import type { ButtonVariants } from '@/components/ui/button/button.variants'

const { t } = useI18n()

const {
  cancelText,
  confirmText,
  confirmClass,
  confirmVariant,
  optionsDisabled
} = defineProps<{
  cancelText?: string
  confirmText?: string
  confirmClass?: string
  confirmVariant?: ButtonVariants['variant']
  optionsDisabled?: MaybeRefOrGetter<boolean>
}>()

defineEmits<{
  cancel: []
  confirm: []
}>()

const confirmTextX = computed(() => confirmText || t('g.confirm'))
const cancelTextX = computed(() => cancelText || t('g.cancel'))
const disabled = computed(() => toValue(optionsDisabled))
</script>
