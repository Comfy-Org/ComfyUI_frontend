<template>
  <Dialog
    v-model:visible="visible"
    :header="$t('userSettings.updatePassword')"
    :modal="true"
    class="w-[30rem]"
  >
    <Form
      v-slot="$form"
      class="flex flex-col gap-6"
      :resolver="zodResolver(signUpSchema)"
      @submit="onSubmit"
    >
      <!-- Password Field -->
      <div class="flex flex-col gap-2">
        <div class="flex justify-between items-center mb-2">
          <label
            class="opacity-80 text-base font-medium"
            for="comfy-org-update-password"
          >
            {{ $t('auth.signup.passwordLabel') }}
          </label>
        </div>
        <Password
          v-model="password"
          input-id="comfy-org-update-password"
          pt:pc-input-text:root:autocomplete="new-password"
          name="password"
          :feedback="false"
          toggle-mask
          :placeholder="t('auth.signup.passwordPlaceholder')"
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

      <!-- Confirm Password Field -->
      <div class="flex flex-col gap-2">
        <label
          class="opacity-80 text-base font-medium mb-2"
          for="comfy-org-update-confirm-password"
        >
          {{ $t('auth.login.confirmPasswordLabel') }}
        </label>
        <Password
          name="confirmPassword"
          input-id="comfy-org-update-confirm-password"
          pt:pc-input-text:root:autocomplete="new-password"
          :feedback="false"
          toggle-mask
          :placeholder="t('auth.login.confirmPasswordPlaceholder')"
          :class="{ 'p-invalid': $form.confirmPassword?.invalid }"
          fluid
          class="h-10"
        />
        <small v-if="$form.confirmPassword?.error" class="text-red-500">{{
          $form.confirmPassword.error.message
        }}</small>
      </div>

      <!-- Submit Button -->
      <Button
        type="submit"
        :label="$t('userSettings.updatePassword')"
        class="h-10 font-medium mt-4"
        :loading="loading"
      />
    </Form>
  </Dialog>
</template>

<script setup lang="ts">
import { Form, FormSubmitEvent } from '@primevue/forms'
import { zodResolver } from '@primevue/forms/resolvers/zod'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Password from 'primevue/password'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { signUpSchema } from '@/schemas/signInSchema'
import { useFirebaseAuthService } from '@/services/firebaseAuthService'

const { t } = useI18n()
const authService = useFirebaseAuthService()
const visible = ref(false)
const loading = ref(false)
const password = ref('')

const passwordChecks = computed(() => ({
  length: password.value.length >= 8 && password.value.length <= 32,
  uppercase: /[A-Z]/.test(password.value),
  lowercase: /[a-z]/.test(password.value),
  number: /\d/.test(password.value),
  special: /[^A-Za-z0-9]/.test(password.value)
}))

const emit = defineEmits<{
  success: []
}>()

const onSubmit = async (event: FormSubmitEvent) => {
  if (event.valid) {
    loading.value = true
    try {
      await authService.updatePassword(event.values.password)
      visible.value = false
      emit('success')
    } finally {
      loading.value = false
    }
  }
}

defineExpose({
  visible
})
</script>
