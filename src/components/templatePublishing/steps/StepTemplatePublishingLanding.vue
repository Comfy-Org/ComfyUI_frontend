<template>
  <div class="flex flex-col gap-6 p-6">
    <p class="text-muted-foreground">
      {{ t('templatePublishing.steps.landing.description') }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const emit = defineEmits<{
  'update:valid': [valid: boolean]
}>()

onMounted(() => {
  emit('update:valid', true)
})
</script>
