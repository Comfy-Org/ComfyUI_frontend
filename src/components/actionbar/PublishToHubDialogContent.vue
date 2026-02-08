<template>
  <div
    class="flex w-full max-w-lg flex-col rounded-2xl border border-border-default bg-base-background"
  >
    <!-- Header -->
    <div
      class="flex h-12 items-center justify-between border-b border-border-default px-4"
    >
      <h2 class="m-0 text-sm font-normal text-base-foreground">
        {{ $t('discover.share.publishToHubDialog.title') }}
      </h2>
      <button
        class="cursor-pointer rounded border-none bg-transparent p-0 text-muted-foreground transition-colors hover:text-base-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-secondary-foreground"
        :aria-label="$t('g.close')"
        @click="onCancel"
      >
        <i class="icon-[lucide--x] size-4" />
      </button>
    </div>

    <!-- Body -->
    <div class="flex flex-col gap-4 p-4">
      <!-- Thumbnail upload -->
      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium text-base-foreground">
          {{ $t('discover.share.publishToHubDialog.thumbnail') }}
        </label>
        <div
          class="relative flex aspect-video w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-border-default bg-secondary-background transition-colors hover:border-border-hover"
          @click="triggerThumbnailUpload"
        >
          <img
            v-if="thumbnailPreview"
            :src="thumbnailPreview"
            :alt="$t('discover.share.publishToHubDialog.thumbnailPreview')"
            class="size-full object-cover"
          />
          <div v-else class="flex flex-col items-center gap-2 text-center">
            <i class="icon-[lucide--image-plus] size-8 text-muted-foreground" />
            <span class="text-sm text-muted-foreground">
              {{ $t('discover.share.publishToHubDialog.uploadThumbnail') }}
            </span>
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
        <label class="text-sm font-medium text-base-foreground">
          {{ $t('g.title') }}
        </label>
        <input
          v-model="title"
          type="text"
          class="w-full rounded-lg border border-border-default bg-transparent px-3 py-2 text-sm text-base-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-secondary-foreground"
          :placeholder="
            $t('discover.share.publishToHubDialog.titlePlaceholder')
          "
        />
      </div>

      <!-- Description -->
      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium text-base-foreground">
          {{ $t('g.description') }}
        </label>
        <textarea
          v-model="description"
          rows="3"
          class="w-full resize-none rounded-lg border border-border-default bg-transparent px-3 py-2 text-sm text-base-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-secondary-foreground"
          :placeholder="
            $t('discover.share.publishToHubDialog.descriptionPlaceholder')
          "
        />
      </div>

      <!-- Tags -->
      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium text-base-foreground">
          {{ $t('discover.filters.tags') }}
        </label>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="tag in tags"
            :key="tag"
            class="flex items-center gap-1 rounded-full bg-secondary-background px-2.5 py-1 text-xs text-base-foreground"
          >
            {{ tag }}
            <button
              class="cursor-pointer border-none bg-transparent p-0 text-muted-foreground hover:text-base-foreground"
              @click="removeTag(tag)"
            >
              <i class="icon-[lucide--x] size-3" />
            </button>
          </span>
          <input
            v-model="newTag"
            type="text"
            class="min-w-24 flex-1 border-none bg-transparent text-sm text-base-foreground placeholder:text-muted-foreground focus:outline-none"
            :placeholder="$t('discover.share.publishToHubDialog.addTag')"
            @keydown.enter.prevent="addTag"
          />
        </div>
      </div>

      <!-- Open source toggle -->
      <div class="flex items-center justify-between">
        <div class="flex flex-col">
          <span class="text-sm font-medium text-base-foreground">
            {{ $t('discover.share.publishToHubDialog.openSource') }}
          </span>
          <span class="text-xs text-muted-foreground">
            {{ $t('discover.share.publishToHubDialog.openSourceDescription') }}
          </span>
        </div>
        <button
          :class="
            cn(
              'relative h-6 w-11 cursor-pointer rounded-full border-none transition-colors',
              isOpenSource ? 'bg-green-500' : 'bg-secondary-background'
            )
          "
          @click="isOpenSource = !isOpenSource"
        >
          <span
            :class="
              cn(
                'absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform',
                isOpenSource && 'translate-x-5'
              )
            "
          />
        </button>
      </div>
    </div>

    <!-- Footer -->
    <div
      class="flex items-center justify-end gap-3 border-t border-border-default px-4 py-3"
    >
      <Button variant="muted-textonly" @click="onCancel">
        {{ $t('g.cancel') }}
      </Button>
      <Button
        variant="primary"
        size="lg"
        :loading
        :disabled="!isValid"
        @click="onPublish"
      >
        {{ $t('discover.share.publishToHubDialog.publish') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useDialogStore } from '@/stores/dialogStore'
import { cn } from '@/utils/tailwindUtil'

const { workflow } = defineProps<{
  workflow: ComfyWorkflow
}>()

const { t } = useI18n()
const dialogStore = useDialogStore()
const toastStore = useToastStore()

const loading = ref(false)
const thumbnailInput = ref<HTMLInputElement>()
const thumbnailFile = ref<File | null>(null)
const thumbnailPreview = ref('')
const title = ref(workflow.filename ?? '')
const description = ref('')
const tags = ref<string[]>([])
const newTag = ref('')
const isOpenSource = ref(false)

const isValid = computed(
  () => title.value.trim().length > 0 && description.value.trim().length > 0
)

function triggerThumbnailUpload() {
  thumbnailInput.value?.click()
}

function handleThumbnailChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    thumbnailFile.value = file
    thumbnailPreview.value = URL.createObjectURL(file)
  }
}

function addTag() {
  const tag = newTag.value.trim()
  if (tag && !tags.value.includes(tag)) {
    tags.value.push(tag)
  }
  newTag.value = ''
}

function removeTag(tag: string) {
  tags.value = tags.value.filter((t) => t !== tag)
}

function onCancel() {
  dialogStore.closeDialog({ key: 'publish-to-hub' })
}

async function onPublish() {
  loading.value = true
  try {
    toastStore.add({
      severity: 'info',
      summary: t('g.comingSoon'),
      detail: t('discover.share.publishToHubDialog.notImplemented'),
      life: 3000
    })
    onCancel()
  } finally {
    loading.value = false
  }
}
</script>
