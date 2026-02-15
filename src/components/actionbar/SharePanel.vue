<template>
  <div class="flex size-full flex-col bg-comfy-menu-bg">
    <!-- Panel Header -->
    <section
      class="sticky top-0 z-10 border-b border-border-default bg-comfy-menu-bg/95 pt-1 backdrop-blur"
    >
      <div class="flex items-center justify-between pl-4 pr-3">
        <h3 class="my-3.5 text-base font-semibold tracking-tight">
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
      <nav class="overflow-x-auto px-4 pb-3 pt-1">
        <div
          class="inline-flex rounded-full border border-border-default bg-secondary-background/70 p-1 shadow-sm"
        >
          <TabList v-model="activeTab" class="gap-1 pb-0">
            <Tab
              value="invite"
              class="rounded-full px-3 py-1.5 text-xs font-semibold tracking-wide transition-all active:scale-95"
            >
              <i class="icon-[lucide--users] mr-1.5 size-3.5" />
              {{ $t('discover.share.inviteTab.title') }}
            </Tab>
            <Tab
              value="publish"
              class="rounded-full px-3 py-1.5 text-xs font-semibold tracking-wide transition-all active:scale-95"
            >
              <i class="icon-[lucide--upload] mr-1.5 size-3.5" />
              {{ $t('discover.share.publishTab.title') }}
            </Tab>
          </TabList>
        </div>
      </nav>
    </section>

    <!-- Content -->
    <div class="scrollbar-thin flex-1 overflow-y-auto">
      <!-- Share Tab -->
      <div
        v-if="activeTab === 'invite'"
        class="mx-auto flex w-full max-w-sm flex-col gap-6 p-4"
      >
        <!-- People with access -->
        <div v-if="invitedUsers.length > 0" class="flex flex-col gap-2">
          <span
            class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {{ $t('discover.share.inviteByEmail.peopleWithAccess') }}
          </span>
          <div
            class="flex flex-col gap-2 rounded-xl border border-border-default bg-secondary-background/40 p-2"
          >
            <div
              v-for="user in invitedUsers"
              :key="user.email"
              class="flex items-center gap-3 rounded-lg border border-border-default/70 bg-comfy-menu-bg px-3 py-2.5 shadow-sm transition-colors hover:bg-secondary-background"
            >
              <div
                class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-500/20 text-sm font-medium text-primary-500 ring-1 ring-primary-500/30"
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
        <div v-if="invitedUsers.length > 0" class="h-px bg-border-default" />

        <!-- Email + role -->
        <div
          class="flex flex-col gap-2 rounded-xl border border-border-default bg-secondary-background/40 p-3"
        >
          <span
            class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {{ $t('discover.share.inviteByEmail.emailLabel') }}
          </span>
          <div class="flex flex-col gap-2 sm:flex-row">
            <input
              v-model="email"
              type="email"
              class="w-full rounded-lg border border-border-default bg-comfy-menu-bg px-3 py-2 text-sm text-base-foreground placeholder:text-muted-foreground transition-colors focus:outline-none focus:ring-1 focus:ring-secondary-foreground hover:border-border-hover"
              :placeholder="$t('discover.share.inviteByEmail.emailPlaceholder')"
            />
            <select
              v-model="selectedRole"
              class="w-full rounded-lg border border-border-default bg-comfy-menu-bg px-3 py-2 text-sm text-base-foreground transition-colors focus:outline-none focus:ring-1 focus:ring-secondary-foreground hover:border-border-hover sm:w-40"
              :aria-label="$t('discover.share.inviteByEmail.roleLabel')"
            >
              <option value="view">
                {{ $t('discover.share.inviteByEmail.roles.viewOnly') }}
              </option>
              <option value="edit">
                {{ $t('discover.share.inviteByEmail.roles.edit') }}
              </option>
            </select>
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
        <div
          class="rounded-xl border border-border-default bg-secondary-background/40 p-3"
        >
          <div class="flex flex-col gap-3">
            <div class="flex items-center gap-2">
              <i class="icon-[lucide--globe] size-4 text-muted-foreground" />
              <span class="text-sm font-semibold text-base-foreground">
                {{ $t('discover.share.publicUrl.title') }}
              </span>
            </div>

            <p class="text-sm leading-5 text-muted-foreground">
              {{ $t('discover.share.publicUrl.description') }}
            </p>

            <div class="flex flex-col gap-2">
              <Button
                variant="secondary"
                size="md"
                class="w-full justify-between rounded-lg border border-border-default bg-secondary-background/90 px-4 py-3 text-sm font-semibold shadow-sm transition-colors hover:bg-secondary-background-hover"
                :aria-label="$t('discover.share.publicUrl.copyLink')"
                @click="copyToClipboard(shareUrl)"
              >
                <span class="min-w-0 truncate">
                  {{ $t('discover.share.publicUrl.copyLink') }}
                </span>
                <i
                  :class="
                    cn(
                      'size-3.5',
                      copied ? 'icon-[lucide--check]' : 'icon-[lucide--copy]'
                    )
                  "
                />
              </Button>
              <Button
                variant="secondary"
                size="md"
                class="w-full justify-between rounded-lg border border-border-default bg-secondary-background/90 px-4 py-3 text-sm font-semibold shadow-sm transition-colors hover:bg-secondary-background-hover"
                :aria-label="$t('discover.share.publicUrl.copyLinkAppMode')"
                @click="copyToClipboard(appModeShareUrl)"
              >
                <span class="min-w-0 truncate">
                  {{ $t('discover.share.publicUrl.copyLinkAppMode') }}
                </span>
                <i class="icon-[lucide--copy] size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <!-- Publish to Comfy Hub Tab -->
      <div
        v-else-if="activeTab === 'publish'"
        class="mx-auto flex w-full max-w-sm flex-col gap-6 p-4"
      >
        <div
          v-if="publishSuccessUrl"
          class="flex flex-col gap-4 rounded-xl border border-border-default bg-secondary-background/40 p-4"
        >
          <div class="flex items-center gap-2 text-base font-semibold">
            <i class="icon-[lucide--check-circle] size-5 text-success" />
            {{ $t('discover.share.publishToHubDialog.successTitle') }}
          </div>
          <p class="text-sm text-muted-foreground">
            {{ $t('discover.share.publishToHubDialog.successDescription') }}
          </p>
          <div
            class="rounded-lg border border-border-default bg-comfy-menu-bg px-3 py-2 text-sm text-base-foreground"
          >
            {{ publishSuccessUrl }}
          </div>
          <div class="flex flex-col gap-2 sm:flex-row">
            <Button variant="primary" size="md" @click="openPublishedWorkflow">
              <i class="icon-[lucide--external-link] size-4" />
              {{ $t('discover.share.publishToHubDialog.successOpen') }}
            </Button>
            <Button
              variant="secondary"
              size="md"
              @click="copyToClipboard(publishSuccessUrl)"
            >
              <i class="icon-[lucide--copy] size-4" />
              {{ $t('discover.share.publishToHubDialog.successCopy') }}
            </Button>
          </div>
        </div>

        <template v-else>
          <p
            class="rounded-xl border border-border-default bg-secondary-background/40 p-3 text-sm leading-5 text-muted-foreground"
          >
            {{ $t('discover.share.publishTab.description') }}
          </p>

          <!-- Thumbnail upload -->
          <div
            class="flex flex-col gap-2 rounded-xl border border-border-default bg-secondary-background/40 p-3"
          >
            <span
              class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {{ $t('discover.share.publishToHubDialog.thumbnail') }}
            </span>
            <div
              class="relative flex size-24 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-border-default bg-comfy-menu-bg transition-colors hover:border-border-hover"
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
          <div
            class="flex flex-col gap-2 rounded-xl border border-border-default bg-secondary-background/40 p-3"
          >
            <span
              class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {{ $t('g.title') }}
            </span>
            <input
              v-model="publishTitle"
              type="text"
              class="w-full rounded-lg border border-border-default bg-comfy-menu-bg px-3 py-2 text-sm text-base-foreground placeholder:text-muted-foreground transition-colors focus:outline-none focus:ring-1 focus:ring-secondary-foreground hover:border-border-hover"
              :placeholder="
                $t('discover.share.publishToHubDialog.titlePlaceholder')
              "
            />
          </div>

          <!-- Description -->
          <div
            class="flex flex-col gap-2 rounded-xl border border-border-default bg-secondary-background/40 p-3"
          >
            <span
              class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {{ $t('g.description') }}
            </span>
            <textarea
              v-model="publishDescription"
              rows="3"
              class="w-full resize-none rounded-lg border border-border-default bg-comfy-menu-bg px-3 py-2 text-sm text-base-foreground placeholder:text-muted-foreground transition-colors focus:outline-none focus:ring-1 focus:ring-secondary-foreground hover:border-border-hover"
              :placeholder="
                $t('discover.share.publishToHubDialog.descriptionPlaceholder')
              "
            />
          </div>

          <!-- Tags -->
          <div
            class="flex flex-col gap-2 rounded-xl border border-border-default bg-secondary-background/40 p-3"
          >
            <span
              class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {{ $t('discover.filters.tags') }}
            </span>
            <div
              class="flex flex-wrap gap-2 rounded-lg border border-border-default bg-comfy-menu-bg px-3 py-2"
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
        </template>
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
const publishSuccessUrl = ref<string | null>(null)

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
  return new URL(`/app/${workflowId}`, baseUrl).toString()
})

const appModeShareUrl = computed(() => {
  const baseUrl = window.location.origin
  const workflow = workflowStore.activeWorkflow
  if (!workflow) return baseUrl
  const workflowId = workflow.key.replace(/\.json$/, '').replace(/\//g, '-')
  const url = new URL(`/app/${workflowId}`, baseUrl)
  url.searchParams.set('mode', 'linear')
  return url.toString()
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

async function copyToClipboard(url: string) {
  try {
    await navigator.clipboard.writeText(url)
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
    const title = publishTitle.value.trim()
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    const fakeId = slug ? `${slug}-preview` : 'workflow-preview'
    publishSuccessUrl.value = `https://comfy-hub.vercel.app/workflows/${fakeId}`
  } finally {
    publishing.value = false
  }
}

function openPublishedWorkflow() {
  if (!publishSuccessUrl.value) return
  window.open(publishSuccessUrl.value, '_blank')
}
</script>
