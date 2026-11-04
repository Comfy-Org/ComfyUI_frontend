<template>
  <section class="flex w-full flex-wrap items-center justify-end gap-4 p-4">
    <Button
      :disabled
      variant="muted-textonly"
      size="lg"
      autofocus
      @click="settle('cancel')"
    >
      {{ cancelText }}
    </Button>
    <Button
      :disabled
      :variant="confirmVariant ?? 'textonly'"
      size="lg"
      :class="confirmClass"
      @click="settle('confirm')"
    >
      {{ confirmText }}
    </Button>
  </section>
</template>
<script setup lang="ts">
import { computed, ref, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import type { ButtonVariants } from '@comfyorg/design-system/button.variants'

const {
  cancelText,
  confirmText,
  confirmClass,
  confirmVariant,
  optionsDisabled
} = defineProps<{
  cancelText: string
  confirmText: string
  confirmClass?: string
  confirmVariant?: ButtonVariants['variant']
  optionsDisabled?: MaybeRefOrGetter<boolean>
}>()

const emit = defineEmits<{
  cancel: []
  confirm: []
}>()

const settled = ref(false)

const disabled = computed(() => settled.value || toValue(optionsDisabled))

function settle(choice: 'cancel' | 'confirm') {
  if (settled.value) return
  settled.value = true
  if (choice === 'cancel') emit('cancel')
  else emit('confirm')
}
</script>
