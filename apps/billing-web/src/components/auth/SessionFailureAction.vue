<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { returnLink } = defineProps<{
  returnLink?: { href: string; label: string }
}>()
const emit = defineEmits<{ retry: [] }>()

const { t } = useI18n()
</script>

<template>
  <a v-if="returnLink" :href="returnLink.href">{{ returnLink.label }}</a>
  <button v-else type="button" @click="emit('retry')">
    {{ t('auth.signIn.retry') }}
  </button>
</template>
