<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'

const { active, label } = defineProps<{
  active: boolean
  label: string
}>()

defineEmits<{
  click: []
}>()
</script>

<template>
  <Button
    variant="textonly"
    size="icon"
    :aria-label="label"
    @click="$emit('click')"
  >
    <i
      :class="active ? 'icon-[lucide--volume-2]' : 'icon-[lucide--volume-x]'"
      class="size-4"
    />
  </Button>
</template>
