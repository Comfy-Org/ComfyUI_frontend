<template>
  <div class="w-96 p-2">
    <!-- Header -->
    <div class="flex flex-col gap-4 mb-8">
      <h1 class="text-white text-2xl font-medium leading-normal my-0">
        {{ t('auth.login.title') }}
      </h1>
      <p class="text-base my-0">
        <span class="text-muted">{{ t('auth.login.newUser') }}</span>
        <span class="ml-1 cursor-pointer text-blue-500">{{
          t('auth.login.signUp')
        }}</span>
      </p>
    </div>

    <!-- Form -->
    <Form
      v-slot="$form"
      class="flex flex-col gap-6"
      :resolver="zodResolver(schema)"
      @submit="onSubmit"
    >
      <!-- Email Field -->
      <div class="flex flex-col gap-2">
        <label class="opacity-80 text-base font-medium mb-2" for="email">
          {{ t('auth.login.emailLabel') }}
        </label>
        <InputText
          class="h-10"
          name="email"
          type="text"
          :placeholder="t('auth.login.emailPlaceholder')"
          :invalid="$form.email?.invalid"
        />
        <small v-if="$form.email?.invalid" class="text-red-500">{{
          $form.email.error.message
        }}</small>
      </div>

      <!-- Password Field -->
      <div class="flex flex-col gap-2">
        <div class="flex justify-between items-center mb-2">
          <label class="opacity-80 text-base font-medium" for="password">
            {{ t('auth.login.passwordLabel') }}
          </label>
          <span class="text-muted text-base font-medium cursor-pointer">
            {{ t('auth.login.forgotPassword') }}
          </span>
        </div>
        <Password
          v-model="password"
          name="password"
          :feedback="false"
          toggle-mask
          :placeholder="t('auth.login.passwordPlaceholder')"
          :class="{ 'p-invalid': $form.password?.invalid }"
          fluid
          class="h-10"
        />
        <div class="flex flex-col gap-1">
          <small
            v-if="$form.password?.dirty || $form.password?.invalid"
            class="text-sm"
          >
            {{ t('validation.password.requirements') }}:
            <ul class="mt-1 space-y-1">
              <li
                :class="{
                  'text-red-500': !passwordChecks.length
                }"
              >
                {{ t('validation.password.minLength') }}
              </li>
              <li
                :class="{
                  'text-red-500': !passwordChecks.uppercase
                }"
              >
                {{ t('validation.password.uppercase') }}
              </li>
              <li
                :class="{
                  'text-red-500': !passwordChecks.lowercase
                }"
              >
                {{ t('validation.password.lowercase') }}
              </li>
              <li
                :class="{
                  'text-red-500': !passwordChecks.number
                }"
              >
                {{ t('validation.password.number') }}
              </li>
              <li
                :class="{
                  'text-red-500': !passwordChecks.special
                }"
              >
                {{ t('validation.password.special') }}
              </li>
            </ul>
          </small>
        </div>
      </div>

      <!-- Submit Button -->
      <Button
        type="submit"
        :label="t('auth.login.loginButton')"
        class="h-10 font-medium mt-4"
      />

      <!-- Divider -->
      <Divider align="center" layout="horizontal">
        <span class="text-muted">{{ t('auth.login.orContinueWith') }}</span>
      </Divider>

      <!-- Social Login Buttons -->
      <Button
        type="button"
        class="h-10"
        severity="secondary"
        outlined
        @click="loginWithGoogle"
      >
        <i class="pi pi-google mr-2"></i>
        {{ t('auth.login.loginWithGoogle') }}
      </Button>

      <Button
        type="button"
        class="h-10"
        severity="secondary"
        outlined
        @click="loginWithGithub"
      >
        <i class="pi pi-github mr-2"></i>
        {{ t('auth.login.loginWithGithub') }}
      </Button>

      <!-- Terms -->
      <p class="text-xs text-muted">
        {{ t('auth.login.termsText') }}
        <span class="text-blue-500 cursor-pointer">{{
          t('auth.login.termsLink')
        }}</span>
        {{ t('auth.login.andText') }}
        <span class="text-blue-500 cursor-pointer">{{
          t('auth.login.privacyLink')
        }}</span
        >.
      </p>
    </Form>
  </div>
</template>

<script setup lang="ts">
import { Form } from '@primevue/forms'
import { zodResolver } from '@primevue/forms/resolvers/zod'
import Button from 'primevue/button'
import Divider from 'primevue/divider'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { z } from 'zod'

const { t } = useI18n()
const toast = useToast()
const password = ref('')

const passwordChecks = computed(() => ({
  length: password.value.length >= 8 && password.value.length <= 32,
  uppercase: /[A-Z]/.test(password.value),
  lowercase: /[a-z]/.test(password.value),
  number: /\d/.test(password.value),
  special: /[^A-Za-z0-9]/.test(password.value)
}))

const schema = z.object({
  email: z
    .string()
    .email(t('validation.invalidEmail'))
    .min(1, t('validation.required')),
  password: z
    .string()
    .min(8, t('validation.minLength', { length: 8 }))
    .max(32, t('validation.maxLength', { length: 32 }))
    .regex(/[A-Z]/, t('validation.password.uppercase'))
    .regex(/[a-z]/, t('validation.password.lowercase'))
    .regex(/[0-9]/, t('validation.password.number'))
    .regex(/[^A-Za-z0-9]/, t('validation.password.special'))
})

const onSubmit = async (event: any) => {
  if (event.valid) {
    try {
      // Handle login logic here
      console.log('Form submitted:', event.values)
      toast.add({
        severity: 'success',
        summary: t('g.success'),
        detail: t('auth.login.success'),
        life: 3000
      })
    } catch (error) {
      toast.add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('auth.login.failed'),
        life: 3000
      })
    }
  }
}

const loginWithGoogle = () => {
  // Implement Google login
  console.log('Google login clicked')
}

const loginWithGithub = () => {
  // Implement Github login
  console.log('Github login clicked')
}
</script>
