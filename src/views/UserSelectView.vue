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
          <InputText
            id="new-user-input"
            v-model="newUsername"
            :placeholder="$t('userSelect.enterUsername')"
            @keyup.enter="login"
          />
        </div>
        <Divider />
        <div class="flex w-full flex-col gap-2">
          <label for="existing-user-select"
            >{{ $t('userSelect.existingUser') }}:</label
          >
          <AutoCompletePlus
            v-model="selectedUser"
            class="w-full"
            input-id="existing-user-select"
            :suggestions="existingUserSuggestions"
            option-label="username"
            :placeholder="$t('userSelect.selectUser')"
            :disabled="createNewUser"
            :delay="0"
            keep-open-on-empty-input
            blur-on-option-select
            dropdown
            dropdown-mode="blank"
            force-selection
            auto-option-focus
            complete-on-focus
            @complete="onExistingUserComplete"
          />
          <Message v-if="error" severity="error">
            {{ error }}
          </Message>
        </div>
        <footer class="mt-5">
          <Button :label="$t('userSelect.next')" @click="login" />
        </footer>
      </div>
    </main>
  </BaseViewTemplate>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Divider from 'primevue/divider'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import AutoCompletePlus from '@/components/primevueOverride/AutoCompletePlus.vue'
import type { User } from '@/stores/userStore'
import { useUserStore } from '@/stores/userStore'
import { FuseSearch } from '@/utils/fuseUtil'
import BaseViewTemplate from '@/views/templates/BaseViewTemplate.vue'

const userStore = useUserStore()
const router = useRouter()

const selectedUser = ref<User | string | null>(null)
const newUsername = ref('')
const loginError = ref('')

const existingUserSuggestions = ref<User[]>([])

const createNewUser = computed(() => newUsername.value.trim() !== '')
const newUserExistsError = computed(() => {
  return userStore.users.find((user) => user.username === newUsername.value)
    ? `User "${newUsername.value}" already exists`
    : ''
})
const error = computed(() => newUserExistsError.value || loginError.value)

const isUser = (value: User | string | null): value is User =>
  typeof value === 'object' && value !== null

const selectedExistingUser = computed<User | null>(() =>
  isUser(selectedUser.value) ? selectedUser.value : null
)

const userFuseSearch = computed(
  () =>
    new FuseSearch(userStore.users, {
      fuseOptions: {
        keys: ['username'],
        includeScore: true,
        threshold: 0.3,
        shouldSort: false,
        useExtendedSearch: true
      },
      createIndex: true,
      advancedScoring: true
    })
)

const searchExistingUsers = (query: string) => {
  const trimmedQuery = query.trim()
  existingUserSuggestions.value = trimmedQuery
    ? userFuseSearch.value.search(trimmedQuery)
    : [...userStore.users]
}

const onExistingUserComplete = ({ query }: { query: string }) => {
  searchExistingUsers(query)
}

const login = async () => {
  try {
    const user = createNewUser.value
      ? await userStore.createUser(newUsername.value)
      : selectedExistingUser.value

    if (!user) {
      throw new Error('No user selected')
    }

    await userStore.login(user)
    await router.push('/')
  } catch (err) {
    loginError.value = err instanceof Error ? err.message : JSON.stringify(err)
  }
}

onMounted(async () => {
  if (!userStore.initialized) {
    await userStore.initialize()
  }
  searchExistingUsers('')
})
</script>
