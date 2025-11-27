<template>
  <section class="w-full flex gap-2 justify-end px-2 pb-2">
    <TextButton
      :label="cancelTextX"
      type="transparent"
      autofocus
      @click="$emit('cancel')"
    />
    <TextButton
      :label="confirmTextX"
      type="transparent"
      :class="confirmClass"
      @click="$emit('confirm')"
    />
  </section>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import TextButton from '@/components/button/TextButton.vue'

const { t } = useI18n()

const { cancelText, confirmText, confirmClass } = defineProps<{
  cancelText?: string
  confirmText?: string
  confirmClass?: string
}>()

defineEmits<{
  cancel: []
  confirm: []
}>()

const confirmTextX = computed(() => confirmText || t('g.confirm'))
const cancelTextX = computed(() => cancelText || t('g.cancel'))
</script>
