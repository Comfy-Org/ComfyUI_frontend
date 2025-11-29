<script setup lang="ts">
import { ref, computed } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'

interface SharedUser {
  id: string
  name: string
  email: string
  avatar?: string
  initials: string
  role: 'owner' | 'editor' | 'viewer'
  color: string
}

const props = defineProps<{
  visible: boolean
  workflowName?: string
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})

const inviteEmail = ref('')
const inviteRole = ref<'editor' | 'viewer'>('editor')
const linkCopied = ref(false)
const linkAccess = ref<'restricted' | 'anyone'>('restricted')
const linkPermission = ref<'viewer' | 'editor'>('viewer')

const roleOptions = [
  { label: 'Can edit', value: 'editor' },
  { label: 'Can view', value: 'viewer' }
]

const linkAccessOptions = [
  { label: 'Restricted', value: 'restricted', description: 'Only people with access can open' },
  { label: 'Anyone with the link', value: 'anyone', description: 'Anyone on the internet with the link can view' }
]

const sharedUsers = ref<SharedUser[]>([
  { id: '1', name: 'John Doe', email: 'john@example.com', initials: 'JD', role: 'owner', color: 'bg-blue-600' },
  { id: '2', name: 'Sarah Wilson', email: 'sarah@example.com', initials: 'SW', role: 'editor', color: 'bg-purple-600' },
  { id: '3', name: 'Mike Chen', email: 'mike@example.com', initials: 'MC', role: 'viewer', color: 'bg-green-600' }
])

const shareLink = computed(() => {
  return `https://comfy.app/share/${props.workflowName?.toLowerCase().replace(/\s+/g, '-') || 'workflow'}`
})

function copyLink(): void {
  navigator.clipboard.writeText(shareLink.value)
  linkCopied.value = true
  setTimeout(() => {
    linkCopied.value = false
  }, 2000)
}

function inviteUser(): void {
  if (!inviteEmail.value) return

  const newUser: SharedUser = {
    id: Date.now().toString(),
    name: inviteEmail.value.split('@')[0] || 'User',
    email: inviteEmail.value,
    initials: inviteEmail.value.substring(0, 2).toUpperCase(),
    role: inviteRole.value,
    color: ['bg-pink-600', 'bg-amber-600', 'bg-cyan-600', 'bg-indigo-600'][Math.floor(Math.random() * 4)] || 'bg-zinc-600'
  }

  sharedUsers.value.push(newUser)
  inviteEmail.value = ''
}

function updateUserRole(userId: string, role: 'editor' | 'viewer'): void {
  const user = sharedUsers.value.find(u => u.id === userId)
  if (user && user.role !== 'owner') {
    user.role = role
  }
}

function removeUser(userId: string): void {
  const index = sharedUsers.value.findIndex(u => u.id === userId)
  if (index > -1 && sharedUsers.value[index]?.role !== 'owner') {
    sharedUsers.value.splice(index, 1)
  }
}

function getRoleLabel(role: string): string {
  switch (role) {
    case 'owner': return 'Owner'
    case 'editor': return 'Can edit'
    case 'viewer': return 'Can view'
    default: return role
  }
}
</script>

<template>
  <Dialog
    v-model:visible="dialogVisible"
    modal
    :draggable="false"
    :closable="true"
    :pt="{
      root: { class: 'bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-[480px]' },
      header: { class: 'p-0' },
      content: { class: 'p-0' },
      mask: { class: 'backdrop-blur-sm bg-black/50' }
    }"
  >
    <template #header>
      <div class="flex w-full items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <div>
          <h2 class="text-base font-semibold text-zinc-900 dark:text-zinc-100">Share "{{ workflowName || 'Workflow' }}"</h2>
          <p class="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">Invite others to collaborate</p>
        </div>
      </div>
    </template>

    <div class="p-5">
      <!-- Invite Section -->
      <div class="mb-5">
        <label class="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Invite people
        </label>
        <div class="flex gap-2">
          <div class="relative flex-1">
            <i class="pi pi-envelope absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400" />
            <InputText
              v-model="inviteEmail"
              placeholder="Enter email address"
              class="w-full rounded-lg border border-zinc-300 bg-white py-2.5 pl-9 pr-3 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
              @keyup.enter="inviteUser"
            />
          </div>
          <Select
            v-model="inviteRole"
            :options="roleOptions"
            option-label="label"
            option-value="value"
            class="w-32"
            :pt="{
              root: { class: 'border border-zinc-300 dark:border-zinc-700 rounded-lg' },
              label: { class: 'text-sm py-2.5 px-3' }
            }"
          />
          <button
            class="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
            :disabled="!inviteEmail"
            @click="inviteUser"
          >
            Invite
          </button>
        </div>
      </div>

      <!-- People with access -->
      <div class="mb-5">
        <label class="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          People with access
        </label>
        <div class="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <div
            v-for="user in sharedUsers"
            :key="user.id"
            class="group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
          >
            <!-- Avatar -->
            <div
              :class="[
                'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white',
                user.color
              ]"
            >
              {{ user.initials }}
            </div>

            <!-- User info -->
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {{ user.name }}
                <span v-if="user.role === 'owner'" class="ml-1 text-xs text-zinc-400">(you)</span>
              </p>
              <p class="truncate text-xs text-zinc-500 dark:text-zinc-400">{{ user.email }}</p>
            </div>

            <!-- Role selector / Remove -->
            <div class="flex items-center gap-1">
              <Select
                v-if="user.role !== 'owner'"
                :model-value="user.role"
                :options="roleOptions"
                option-label="label"
                option-value="value"
                class="w-28"
                :pt="{
                  root: { class: 'border-0 bg-transparent' },
                  label: { class: 'text-xs py-1 px-2 text-zinc-500 dark:text-zinc-400' },
                  trigger: { class: 'w-4' }
                }"
                @update:model-value="updateUserRole(user.id, $event)"
              />
              <span v-else class="px-2 text-xs text-zinc-400">{{ getRoleLabel(user.role) }}</span>

              <button
                v-if="user.role !== 'owner'"
                class="rounded p-1 text-zinc-400 opacity-0 transition-all hover:bg-zinc-200 hover:text-zinc-600 group-hover:opacity-100 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                @click="removeUser(user.id)"
              >
                <i class="pi pi-times text-xs" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Link sharing section -->
      <div class="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/50">
        <div class="mb-3 flex items-start gap-3">
          <div class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-zinc-200 dark:bg-zinc-700">
            <i class="pi pi-link text-zinc-600 dark:text-zinc-400" />
          </div>
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <Select
                v-model="linkAccess"
                :options="linkAccessOptions"
                option-label="label"
                option-value="value"
                class="flex-1"
                :pt="{
                  root: { class: 'border-0 bg-transparent' },
                  label: { class: 'text-sm font-medium py-0 px-0 text-zinc-900 dark:text-zinc-100' },
                  trigger: { class: 'w-4' }
                }"
              />
            </div>
            <p class="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {{ linkAccess === 'restricted' ? 'Only people with access can open' : 'Anyone on the internet with the link' }}
            </p>
          </div>
          <Select
            v-if="linkAccess === 'anyone'"
            v-model="linkPermission"
            :options="roleOptions"
            option-label="label"
            option-value="value"
            class="w-28"
            :pt="{
              root: { class: 'border border-zinc-300 dark:border-zinc-700 rounded-lg' },
              label: { class: 'text-xs py-1.5 px-2' }
            }"
          />
        </div>

        <!-- Copy link -->
        <div class="flex gap-2">
          <div class="flex-1 truncate rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
            {{ shareLink }}
          </div>
          <button
            :class="[
              'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              linkCopied
                ? 'bg-green-600 text-white'
                : 'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200'
            ]"
            @click="copyLink"
          >
            <i :class="['text-xs', linkCopied ? 'pi pi-check' : 'pi pi-copy']" />
            {{ linkCopied ? 'Copied!' : 'Copy link' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="flex items-center justify-between border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
      <button class="flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200">
        <i class="pi pi-cog text-xs" />
        Advanced settings
      </button>
      <button
        class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
        @click="dialogVisible = false"
      >
        Done
      </button>
    </div>
  </Dialog>
</template>
