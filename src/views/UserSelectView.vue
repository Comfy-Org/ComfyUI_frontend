<template>
  <BaseViewTemplate dark>
    <main
      id="comfy-user-selection"
      class="relative min-w-84 rounded-lg bg-(--comfy-menu-bg) p-5 px-10 shadow-lg"
    >
      <h1 class="my-2.5 mb-7 font-normal">ComfyUI</h1>
      <div class="flex w-full flex-col items-center">
        <div class="flex w-full flex-col gap-2">
          <label for="new-user-input">{{ $t('userSelect.newUser') }}:</label>
          <Input
            id="new-user-input"
            v-model="newUsername"
            :placeholder="$t('userSelect.enterUsername')"
            @keyup.enter="login"
          />
        </div>
        <div class="my-4 w-full border-t border-interface-stroke" />
        <div class="flex w-full flex-col gap-2">
          <label for="existing-user-select"
            >{{ $t('userSelect.existingUser') }}:</label
          >
          <SingleSelect
            v-model="selectedUserId"
            id="existing-user-select"
            class="w-full"
            :options="userOptions"
            :label="$t('userSelect.selectUser')"
            :disabled="createNewUser"
          />
          <Message v-if="error" severity="error">
            {{ error }}
          </Message>
        </div>
        <footer class="mt-5">
          <Button @click="login">{{ $t('userSelect.next') }}</Button>
        </footer>
      </div>
    </main>
  </BaseViewTemplate>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import Message from '@/components/ui/message/Message.vue'
import SingleSelect from '@/components/ui/single-select/SingleSelect.vue'
import type { User } from '@/stores/userStore'
import { useUserStore } from '@/stores/userStore'
import BaseViewTemplate from '@/views/templates/BaseViewTemplate.vue'

const userStore = useUserStore()
const router = useRouter()

const selectedUserId = ref<string>()
const selectedUser = computed<User | undefined>(() =>
  userStore.users.find((user) => user.userId === selectedUserId.value)
)
const userOptions = computed(() =>
  userStore.users.map(({ userId, username }) => ({
    name: username,
    value: userId
  }))
)
const newUsername = ref('')
const loginError = ref('')

const createNewUser = computed(() => newUsername.value.trim() !== '')
const newUserExistsError = computed(() => {
  return userStore.users.find((user) => user.username === newUsername.value)
    ? `User "${newUsername.value}" already exists`
    : ''
})
const error = computed(() => newUserExistsError.value || loginError.value)

const login = async () => {
  try {
    const user = createNewUser.value
      ? await userStore.createUser(newUsername.value)
      : selectedUser.value

    if (!user) {
      console.error('No user selected')
      loginError.value = 'No user selected'
      return
    }

    await userStore.login(user)
    await router.push('/')
  } catch (err) {
    loginError.value = err instanceof Error ? err.message : JSON.stringify(err)
  }
}

onMounted(async () => {
  document.getElementById('splash-loader')?.remove()

  await userStore.initialize()
})
</script>
