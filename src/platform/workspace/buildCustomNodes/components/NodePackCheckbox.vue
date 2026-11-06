<template>
  <Checkbox
    v-model="checked"
    :disabled
    class="size-5 border-muted-foreground data-[state=checked]:border-foreground data-[state=checked]:bg-foreground"
  >
    <i class="icon-[lucide--check] size-3.5" aria-hidden="true" />
  </Checkbox>
</template>

<script setup lang="ts">
import Checkbox from '@comfyorg/design-system/checkbox/Checkbox'

const { disabled = false } = defineProps<{
  disabled?: boolean
}>()

const checked = defineModel<boolean>({ required: true })
</script>
