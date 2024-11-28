<template>
  <div
    id="comfy-user-selection"
    class="font-sans flex flex-col items-center h-screen m-0 text-neutral-300 bg-neutral-900 dark-theme pointer-events-auto"
  >
    <main
      class="mt-[5vh] 2xl:mt-[20vh] min-w-[365px] relative rounded-lg bg-[var(--comfy-menu-bg)] p-5 px-10 shadow-lg"
    >
      <h1 class="my-2.5 mb-7 font-normal">ComfyUI</h1>
      <form class="flex w-full flex-col items-center">
        <div class="flex w-full flex-col gap-2">
          <label for="new-user-input">{{ $t('userSelect.newUser') }}:</label>
          <InputText
            v-model="newUsername"
            :placeholder="$t('userSelect.enterUsername')"
          />
        </div>
        <Divider />
        <div class="flex w-full flex-col gap-2">
          <label for="existing-user-select"
            >{{ $t('userSelect.existingUser') }}:</label
          >
          <Select
            v-model="selectedUser"
            class="w-full"
            inputId="existing-user-select"
            :options="users"
            option-label="username"
            option-value="userId"
            :placeholder="$t('userSelect.selectUser')"
          />
        </div>
        <footer class="mt-5">
          <Button :label="$t('userSelect.next')" @click="login" />
        </footer>
      </form>
    </main>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Divider from 'primevue/divider'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { useUserStore } from '@/stores/userStore'
import { useRouter } from 'vue-router'
import { computed, onMounted, ref } from 'vue'

interface User {
  userId: string
  username: string
}

const userStore = useUserStore()
const router = useRouter()
const users = computed<User[]>(() =>
  Object.entries(userStore.users).map(([userId, username]) => ({
    userId,
    username
  }))
)
const selectedUser = ref<User | null>(null)
const newUsername = ref('')

const login = () => {
  userStore.login({ userId: 'default', username: 'test' })
  router.push('/')
}

onMounted(async () => {
  if (!userStore.initialized) {
    await userStore.initialize()
  }
})
</script>
