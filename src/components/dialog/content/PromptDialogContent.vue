<template>
  <div class="prompt-dialog-content flex flex-col gap-2 pt-8">
    <label class="flex flex-col gap-1 text-sm text-muted-foreground">
      {{ message }}
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
</script>
