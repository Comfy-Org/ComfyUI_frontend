<template>
  <form class="flex flex-col gap-6" @submit="onSubmit">
    <!-- Email Field -->
    <div class="flex flex-col gap-2">
      <label class="mb-2 text-base font-medium opacity-80" :for="emailInputId">
        {{ t('auth.login.emailLabel') }}
      </label>
      <InputText
        :id="emailInputId"
        v-model="email"
        v-bind="emailAttrs"
        autocomplete="email"
        class="h-10"
        type="text"
        :placeholder="t('auth.login.emailPlaceholder')"
        :invalid="Boolean(errors.email)"
      />
      <small v-if="errors.email" class="text-red-500">{{ errors.email }}</small>
    </div>

    <!-- Password Field -->
    <div class="flex flex-col gap-2">
      <div class="mb-2 flex items-center justify-between">
        <label
          class="text-base font-medium opacity-80"
          for="cloud-sign-in-password"
        >
          {{ t('auth.login.passwordLabel') }}
        </label>
      </div>
      <Password
        v-model="password"
        v-bind="passwordAttrs"
        input-id="cloud-sign-in-password"
        pt:pc-input-text:root:autocomplete="current-password"
        :feedback="false"
        toggle-mask
        :placeholder="t('auth.login.passwordPlaceholder')"
        :class="{ 'p-invalid': Boolean(errors.password) }"
        fluid
        class="h-10"
      />
      <small v-if="errors.password" class="text-red-500">{{
        errors.password
      }}</small>

      <router-link
        :to="{ name: 'cloud-forgot-password' }"
        class="text-sm font-medium text-muted no-underline"
      >
        {{ t('auth.login.forgotPassword') }}
      </router-link>
    </div>

    <!-- Auth Error Message -->
    <Message v-if="authError" severity="error">
      {{ authError }}
    </Message>

    <!-- Submit Button -->
    <ProgressSpinner v-if="loading" class="h-8 w-8" />
    <Button
      v-else
      type="submit"
      class="mt-4 h-10 font-medium text-white"
      :disabled="!meta.valid"
    >
      {{ t('auth.login.loginButton') }}
    </Button>
  </form>
</template>

<script setup lang="ts">
import { toTypedSchema } from '@/utils/veeValidateZod'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Password from 'primevue/password'
import ProgressSpinner from 'primevue/progressspinner'
import { useForm } from 'vee-validate'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { signInSchema } from '@/schemas/signInSchema'
import type { SignInData } from '@/schemas/signInSchema'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'

const authStore = useFirebaseAuthStore()
const loading = computed(() => authStore.loading)

const { t } = useI18n()

defineProps<{
  authError?: string
}>()

const emit = defineEmits<{
  submit: [values: SignInData]
}>()

const emailInputId = 'cloud-sign-in-email'

const { defineField, errors, handleSubmit, meta } = useForm<SignInData>({
  initialValues: {
    email: '',
    password: ''
  },
  validateOnMount: true,
  validationSchema: toTypedSchema(signInSchema)
})

const [email, emailAttrs] = defineField('email')
const [password, passwordAttrs] = defineField('password')

const onSubmit = handleSubmit((submittedValues) => {
  emit('submit', submittedValues)
})
</script>
<style scoped>
:deep(.p-inputtext) {
  border: none !important;
  box-shadow: none !important;
  background: #2d2e32 !important;
}

:deep(.p-password input) {
  border: none !important;
  box-shadow: none !important;
}
:deep(.p-checkbox-checked .p-checkbox-box) {
  background-color: #f0ff41 !important;
  border-color: #f0ff41 !important;
}
</style>
