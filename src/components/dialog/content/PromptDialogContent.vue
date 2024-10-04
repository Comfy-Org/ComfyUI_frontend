<template>
  <div class="prompt-dialog-content">
    <p>{{ message }}</p>
    <InputText v-model="inputValue" @keyup.enter="onConfirm" />
    <div class="button-container">
      <Button @click="onConfirm">{{ $t('confirm') }}</Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import { ref } from 'vue'
import { useDialogStore } from '@/stores/dialogStore'

const props = defineProps<{
  message: string
  defaultValue: string
  onConfirm: (value: string) => void
}>()

const inputValue = ref<string>(props.defaultValue)

const onConfirm = () => {
  props.onConfirm(inputValue.value)
  useDialogStore().closeDialog()
}
</script>
