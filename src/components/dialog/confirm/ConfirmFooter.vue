<template>
  <section class="flex w-full flex-wrap items-center justify-end gap-4 p-4">
    <Button
      :disabled
      variant="muted-textonly"
      size="lg"
      autofocus
      @click="settle('cancel')"
    >
      {{ cancelTextX }}
    </Button>
    <Button
      :disabled
      :variant="confirmVariant ?? 'textonly'"
      size="lg"
      :class="confirmClass"
      @click="settle('confirm')"
    >
      {{ confirmTextX }}
    </Button>
  </section>
</template>
<script setup lang="ts">
import { computed, ref, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import type { ButtonVariants } from '@comfyorg/design-system/button.variants'

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

const emit = defineEmits<{
  cancel: []
  confirm: []
}>()

const settled = ref(false)

const confirmTextX = computed(() => confirmText || t('g.confirm'))
const cancelTextX = computed(() => cancelText || t('g.cancel'))
const disabled = computed(() => settled.value || toValue(optionsDisabled))

function settle(choice: 'cancel' | 'confirm') {
  if (settled.value) return
  settled.value = true
  if (choice === 'cancel') emit('cancel')
  else emit('confirm')
}
</script>
