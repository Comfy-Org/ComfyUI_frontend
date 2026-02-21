<template>
  <form class="flex flex-col gap-6" @submit="onSubmit">
    <!-- Email Field -->
    <FormField v-slot="{ componentField }" name="email">
      <FormItem class="flex flex-col gap-2">
        <FormLabel class="mb-2 text-base font-medium opacity-80">
          {{ t('auth.signup.emailLabel') }}
        </FormLabel>
        <FormControl>
          <InputText
            v-bind="componentField"
            autocomplete="email"
            class="h-10"
            type="text"
            :placeholder="t('auth.signup.emailPlaceholder')"
            :invalid="Boolean(errors.email)"
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>

    <PasswordFields />

    <!-- Submit Button -->
    <ProgressSpinner v-if="loading" class="mx-auto h-8 w-8" />
    <Button
      v-else
      type="submit"
      class="mt-4 h-10 font-medium"
      :disabled="!meta.valid"
    >
      {{ t('auth.signup.signUpButton') }}
    </Button>
  </form>
</template>

<script setup lang="ts">
import { useThrottleFn } from '@vueuse/core'
import InputText from 'primevue/inputtext'
import ProgressSpinner from 'primevue/progressspinner'
import { useForm } from 'vee-validate'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import FormControl from '@/components/ui/form/FormControl.vue'
import FormField from '@/components/ui/form/FormField.vue'
import FormItem from '@/components/ui/form/FormItem.vue'
import FormLabel from '@/components/ui/form/FormLabel.vue'
import FormMessage from '@/components/ui/form/FormMessage.vue'
import { signUpSchema } from '@/schemas/signInSchema'
import type { SignUpData } from '@/schemas/signInSchema'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'

import PasswordFields from './PasswordFields.vue'

const { t } = useI18n()
const authStore = useFirebaseAuthStore()
const loading = computed(() => authStore.loading)

const emit = defineEmits<{
  submit: [values: SignUpData]
}>()

const { errors, handleSubmit, meta } = useForm<SignUpData>({
  initialValues: {
    confirmPassword: '',
    email: '',
    password: ''
  },
  validateOnMount: true,
  validationSchema: signUpSchema
})

const onSubmit = useThrottleFn(
  handleSubmit((submittedValues) => {
    emit('submit', submittedValues)
  }),
  1_500
)
</script>
