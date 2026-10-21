<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import PasswordInput from '@/components/ui/input/PasswordInput.vue'

const modelValue = defineModel<string>()
const { t } = useI18n()
</script>

<template>
  <PasswordInput
    v-model="modelValue"
    :show-password-label="t('auth.showPassword')"
    :hide-password-label="t('auth.hidePassword')"
  />
</template>
