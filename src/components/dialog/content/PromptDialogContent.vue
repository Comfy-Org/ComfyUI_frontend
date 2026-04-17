<template>
  <div class="prompt-dialog-content flex flex-col gap-2 pt-8">
    <div class="flex flex-col gap-1">
      <label class="text-sm text-muted-foreground">{{ message }}</label>
      <Input
        ref="inputRef"
        v-model="inputValue"
        :placeholder
        autofocus
        @keyup.enter="handleConfirm"
        @focus="selectAllText"
      />
    </div>
    <Button @click="handleConfirm">
      {{ $t('g.confirm') }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import { useDialogStore } from '@/stores/dialogStore'

const { message, defaultValue, onConfirm, placeholder } = defineProps<{
  message: string
  defaultValue: string
  onConfirm: (value: string) => void
  placeholder?: string
}>()

const inputValue = ref<string>(defaultValue)

function handleConfirm() {
  onConfirm(inputValue.value)
  useDialogStore().closeDialog()
}

const inputRef = ref<InstanceType<typeof Input>>()

function selectAllText() {
  inputRef.value?.setSelectionRange(0, inputValue.value.length)
}
</script>
