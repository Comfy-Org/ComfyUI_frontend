<template>
  <div class="flex size-full flex-col bg-comfy-menu-bg">
    <!-- Panel Header -->
    <section class="pt-1">
      <div class="flex items-center justify-between pl-4 pr-3">
        <h3 class="my-3.5 text-sm font-semibold">
          {{ $t('discover.share.share') }}
        </h3>
        <Button
          variant="secondary"
          size="icon"
          :aria-label="$t('g.close')"
          @click="closePanel"
        >
          <i class="icon-[lucide--x] size-4" />
        </Button>
      </div>
      <nav class="overflow-x-auto px-4 pb-2 pt-1">
        <TabList v-model="activeTab">
          <Tab
            value="invite"
            class="px-2 py-1 text-sm font-inter transition-all active:scale-95"
          >
            <i class="icon-[lucide--users] mr-1.5 size-3.5" />
            {{ $t('discover.share.inviteTab.title') }}
          </Tab>
          <Tab
            value="publish"
            class="px-2 py-1 text-sm font-inter transition-all active:scale-95"
          >
            <i class="icon-[lucide--upload] mr-1.5 size-3.5" />
            {{ $t('discover.share.publishTab.title') }}
          </Tab>
        </TabList>
      </nav>
    </section>

    <!-- Content -->
    <div class="scrollbar-thin flex-1 overflow-y-auto">
      <!-- Share Tab -->
      <div
        v-if="activeTab === 'invite'"
        class="flex flex-col gap-4 p-4 max-w-sm"
      >
        <!-- People with access -->
        <div v-if="invitedUsers.length > 0" class="flex flex-col gap-2">
          <span class="text-sm text-muted-foreground">
            {{ $t('discover.share.inviteByEmail.peopleWithAccess') }}
          </span>
          <div class="flex flex-col gap-1.5">
            <div
              v-for="user in invitedUsers"
              :key="user.email"
              class="flex items-center gap-3 rounded-lg bg-secondary-background px-3 py-2.5"
            >
              <div
                class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-500/20 text-sm font-medium text-primary-500"
              >
                {{ user.email.charAt(0).toUpperCase() }}
              </div>
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm text-base-foreground">
                  {{ user.email }}
                </div>
                <div class="text-xs text-muted-foreground">
                  {{
                    user.role === 'edit'
                      ? $t('discover.share.inviteByEmail.roles.edit')
                      : $t('discover.share.inviteByEmail.roles.viewOnly')
                  }}
                </div>
              </div>
              <Button
                variant="muted-textonly"
                size="icon-sm"
                :aria-label="$t('g.delete')"
                @click="removeUser(user.email)"
              >
                <i class="icon-[lucide--x] size-4" />
              </Button>
            </div>
          </div>
        </div>

        <!-- Invite section header -->
        <div
          v-if="invitedUsers.length > 0"
          class="border-t border-border-default pt-4"
        />
        <p v-else class="text-sm text-muted-foreground">
          {{ $t('discover.share.inviteByEmail.description') }}
        </p>

        <!-- Email input -->
        <div class="flex flex-col gap-2">
          <span class="text-sm text-muted-foreground">
            {{ $t('discover.share.inviteByEmail.emailLabel') }}
          </span>
          <input
            v-model="email"
            type="email"
            class="w-full rounded-lg border border-border-default bg-transparent px-3 py-2 text-sm text-base-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-secondary-foreground"
            :placeholder="$t('discover.share.inviteByEmail.emailPlaceholder')"
          />
        </div>

        <!-- Role selection -->
        <div class="flex flex-col gap-2">
          <span class="text-sm text-muted-foreground">
            {{ $t('discover.share.inviteByEmail.roleLabel') }}
          </span>
          <div class="flex flex-col gap-1.5">
            <button
              v-for="role in roles"
              :key="role.value"
              :class="
                cn(
                  'flex w-full cursor-pointer items-start gap-3 rounded-lg border-2 px-3 py-2.5 text-left transition-colors',
                  selectedRole === role.value
                    ? 'border-primary-500 bg-primary-500/10'
                    : 'border-border-default bg-transparent hover:bg-secondary-background'
                )
              "
              @click="selectedRole = role.value"
            >
              <i
                :class="
                  cn(
                    'mt-0.5 size-4',
                    role.icon,
                    selectedRole === role.value
                      ? 'text-primary-500'
                      : 'text-muted-foreground'
                  )
                "
              />
              <div class="flex flex-col gap-0.5">
                <span class="text-sm font-medium text-base-foreground">
                  {{ role.label }}
                </span>
                <span class="text-xs text-muted-foreground">
                  {{ role.description }}
                </span>
              </div>
            </button>
          </div>
        </div>

        <Button
          variant="primary"
          size="md"
          class="w-full"
          :loading="sendingInvite"
          :disabled="!isEmailValid"
          @click="handleSendInvite"
        >
          <i class="icon-[lucide--send] size-4" />
          {{ $t('discover.share.inviteByEmail.sendInvite') }}
        </Button>

        <!-- Public URL Section -->
        <div class="border-t border-border-default pt-4">
          <div class="flex flex-col gap-3">
            <div class="flex items-center gap-2">
              <i class="icon-[lucide--globe] size-4 text-muted-foreground" />
              <span class="text-sm font-medium text-base-foreground">
                {{ $t('discover.share.publicUrl.title') }}
              </span>
            </div>

            <p class="text-sm text-muted-foreground">
              {{ $t('discover.share.publicUrl.description') }}
            </p>

            <div
              class="flex items-center gap-2 rounded-lg border border-border-default bg-secondary-background px-3 py-2.5"
            >
              <i
                class="icon-[lucide--link] size-4 shrink-0 text-muted-foreground"
              />
              <span class="flex-1 truncate text-sm text-base-foreground">
                {{ shareUrl }}
              </span>
              <Button
                variant="muted-textonly"
                size="icon-sm"
                :aria-label="$t('g.copyToClipboard')"
                @click="copyToClipboard"
              >
                <i
                  :class="
                    cn(
                      'size-4',
                      copied ? 'icon-[lucide--check]' : 'icon-[lucide--copy]'
                    )
                  "
                />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <!-- Publish to Comfy Hub Tab -->
      <div v-else-if="activeTab === 'publish'" class="flex flex-col gap-4 p-4">
        <p class="text-sm text-muted-foreground">
          {{ $t('discover.share.publishTab.description') }}
        </p>

        <!-- Thumbnail upload -->
        <div class="flex flex-col gap-2">
          <span class="text-sm text-muted-foreground">
            {{ $t('discover.share.publishToHubDialog.thumbnail') }}
          </span>
          <div
            class="relative flex size-24 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-border-default bg-secondary-background transition-colors hover:border-border-hover"
            @click="triggerThumbnailUpload"
          >
            <img
              v-if="thumbnailPreview"
              :src="thumbnailPreview"
              :alt="$t('discover.share.publishToHubDialog.thumbnailPreview')"
              class="size-full object-cover"
            />
            <div v-else class="flex flex-col items-center gap-1 text-center">
              <i
                class="icon-[lucide--image-plus] size-6 text-muted-foreground"
              />
            </div>
            <input
              ref="thumbnailInput"
              type="file"
              accept="image/*"
              class="hidden"
              @change="handleThumbnailChange"
            />
          </div>
        </div>

        <!-- Title -->
        <div class="flex flex-col gap-2">
          <span class="text-sm text-muted-foreground">
            {{ $t('g.title') }}
          </span>
          <input
            v-model="publishTitle"
            type="text"
            class="w-full rounded-lg border border-border-default bg-transparent px-3 py-2 text-sm text-base-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-secondary-foreground"
            :placeholder="
              $t('discover.share.publishToHubDialog.titlePlaceholder')
            "
          />
        </div>

        <!-- Description -->
        <div class="flex flex-col gap-2">
          <span class="text-sm text-muted-foreground">
            {{ $t('g.description') }}
          </span>
          <textarea
            v-model="publishDescription"
            rows="3"
            class="w-full resize-none rounded-lg border border-border-default bg-transparent px-3 py-2 text-sm text-base-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-secondary-foreground"
            :placeholder="
              $t('discover.share.publishToHubDialog.descriptionPlaceholder')
            "
          />
        </div>

        <!-- Tags -->
        <div class="flex flex-col gap-2">
          <span class="text-sm text-muted-foreground">
            {{ $t('discover.filters.tags') }}
          </span>
          <div
            class="flex flex-wrap gap-2 rounded-lg border border-border-default bg-transparent px-3 py-2"
          >
            <span
              v-for="tag in publishTags"
              :key="tag"
              class="flex items-center gap-1 rounded-full bg-secondary-background px-2 py-0.5 text-xs text-base-foreground"
            >
              {{ tag }}
              <button
                class="cursor-pointer border-none bg-transparent p-0 text-muted-foreground hover:text-base-foreground"
                :aria-label="$t('g.removeTag')"
                @click="removeTag(tag)"
              >
                <i class="icon-[lucide--x] size-3" />
              </button>
            </span>
            <input
              v-model="newTag"
              type="text"
              class="min-w-20 flex-1 border-none bg-transparent text-sm text-base-foreground placeholder:text-muted-foreground focus:outline-none"
              :placeholder="$t('discover.share.publishToHubDialog.addTag')"
              @keydown.enter.prevent="addTag"
            />
          </div>
        </div>

        <Button
          variant="primary"
          size="md"
          class="w-full"
          :loading="publishing"
          :disabled="!isPublishValid"
          @click="handlePublishToHub"
        >
          <i class="icon-[lucide--upload] size-4" />
          {{ $t('discover.share.publishToHubDialog.publish') }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Tab from '@/components/tab/Tab.vue'
import TabList from '@/components/tab/TabList.vue'
import Button from '@/components/ui/button/Button.vue'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useSharePanelStore } from '@/stores/workspace/sharePanelStore'
import { cn } from '@/utils/tailwindUtil'

type ShareTab = 'invite' | 'publish'

const { t } = useI18n()
const workflowStore = useWorkflowStore()
const toastStore = useToastStore()
const sharePanelStore = useSharePanelStore()

interface InvitedUser {
  email: string
  role: 'view' | 'edit'
}

const activeTab = ref<ShareTab>('invite')
const email = ref('')
const selectedRole = ref<'view' | 'edit'>('view')
const sendingInvite = ref(false)
const publishing = ref(false)
const copied = ref(false)
const invitedUsers = ref<InvitedUser[]>([])

// Publish to Hub state
const thumbnailInput = ref<HTMLInputElement>()
const thumbnailPreview = ref('')
const publishTitle = ref('')
const publishDescription = ref('')
const publishTags = ref<string[]>([])
const newTag = ref('')

const roles = computed(() => [
  {
    value: 'view' as const,
    label: t('discover.share.inviteByEmail.roles.viewOnly'),
    description: t('discover.share.inviteByEmail.roles.viewOnlyDescription'),
    icon: 'icon-[lucide--eye]'
  },
  {
    value: 'edit' as const,
    label: t('discover.share.inviteByEmail.roles.edit'),
    description: t('discover.share.inviteByEmail.roles.editDescription'),
    icon: 'icon-[lucide--pencil]'
  }
])

const isEmailValid = computed(() => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email.value)
})

const isPublishValid = computed(
  () =>
    publishTitle.value.trim().length > 0 &&
    publishDescription.value.trim().length > 0
)

const shareUrl = computed(() => {
  const baseUrl = window.location.origin
  const workflow = workflowStore.activeWorkflow
  if (!workflow) return baseUrl
  const workflowId = workflow.key.replace(/\.json$/, '').replace(/\//g, '-')
  return `${baseUrl}/app/${workflowId}`
})

function closePanel() {
  sharePanelStore.closePanel()
}

async function handleSendInvite() {
  sendingInvite.value = true
  try {
    await new Promise((resolve) => setTimeout(resolve, 1000))

    const existingUser = invitedUsers.value.find((u) => u.email === email.value)
    if (existingUser) {
      existingUser.role = selectedRole.value
    } else {
      invitedUsers.value.push({
        email: email.value,
        role: selectedRole.value
      })
    }

    toastStore.add({
      severity: 'success',
      summary: t('discover.share.inviteByEmail.inviteSent'),
      detail: t('discover.share.inviteByEmail.inviteSentDetail', {
        email: email.value
      }),
      life: 3000
    })
    email.value = ''
  } finally {
    sendingInvite.value = false
  }
}

function removeUser(emailToRemove: string) {
  invitedUsers.value = invitedUsers.value.filter(
    (u) => u.email !== emailToRemove
  )
}

async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    copied.value = true
    toastStore.add({
      severity: 'success',
      summary: t('g.copied'),
      life: 2000
    })
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    toastStore.addAlert(t('discover.share.copyFailed'))
  }
}

function triggerThumbnailUpload() {
  thumbnailInput.value?.click()
}

function handleThumbnailChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    thumbnailPreview.value = URL.createObjectURL(file)
  }
}

function addTag() {
  const tag = newTag.value.trim()
  if (tag && !publishTags.value.includes(tag)) {
    publishTags.value.push(tag)
  }
  newTag.value = ''
}

function removeTag(tag: string) {
  publishTags.value = publishTags.value.filter((t) => t !== tag)
}

async function handlePublishToHub() {
  publishing.value = true
  try {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    toastStore.add({
      severity: 'info',
      summary: t('g.comingSoon'),
      detail: t('discover.share.publishToHubDialog.notImplemented'),
      life: 3000
    })
  } finally {
    publishing.value = false
  }
}
</script>
