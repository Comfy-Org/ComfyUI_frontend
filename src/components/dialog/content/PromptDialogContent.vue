<template>
  <SmallModalShell :title :title-id="titleId" class="prompt-dialog-content">
    <label class="flex flex-col gap-2 text-sm text-muted-foreground">
      <span :id="descriptionId">{{ message }}</span>
      <Input
        ref="inputRef"
        v-model="inputValue"
        type="text"
        :placeholder
        autofocus
        @keyup.enter="handleConfirm"
        @focus="inputRef?.selectAll()"
      />
    </label>

    <template #footer>
      <Button variant="muted-textonly" @click="onCancel">
        {{ $t('g.cancel') }}
      </Button>
      <Button variant="primary" size="lg" @click="handleConfirm">
        {{ $t('g.confirm') }}
      </Button>
    </template>
  </SmallModalShell>
</template>

<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'

import SmallModalShell from '@/components/dialog/SmallModalShell.vue'
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import { useDialogStore } from '@/stores/dialogStore'

const {
  message,
  defaultValue,
  onConfirm,
  placeholder,
  titleId,
  descriptionId
} = defineProps<{
  title: string
  message: string
  defaultValue: string
  onConfirm: (value: string) => void
  placeholder?: string
  titleId?: string
  descriptionId?: string
}>()

const inputValue = ref<string>(defaultValue)

const inputRef = useTemplateRef('inputRef')

const onCancel = () => useDialogStore().closeDialog()

function handleConfirm() {
  onConfirm(inputValue.value)
  useDialogStore().closeDialog()
}
</script>
