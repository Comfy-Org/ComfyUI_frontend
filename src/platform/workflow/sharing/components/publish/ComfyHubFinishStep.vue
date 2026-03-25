<template>
  <div class="flex min-h-0 flex-1 flex-col gap-8 px-6 py-4">
    <section class="flex flex-col gap-4">
      <span class="text-sm text-base-foreground">
        {{ $t('comfyHubPublish.shareAs') }}
      </span>

      <div
        class="flex items-center gap-4 rounded-2xl bg-secondary-background px-6 py-4"
      >
        <div
          class="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-linear-to-b from-green-600/50 to-green-900"
        >
          <img
            v-if="profile.profilePictureUrl"
            :src="profile.profilePictureUrl"
            :alt="profile.username"
            class="size-full rounded-full object-cover"
          />
          <span v-else class="text-base text-white">
            {{ (profile.name ?? profile.username).charAt(0).toUpperCase() }}
          </span>
        </div>
        <div class="flex flex-1 flex-col gap-2">
          <span class="text-sm text-base-foreground">
            {{ profile.name ?? profile.username }}
          </span>
          <span class="text-sm text-muted-foreground">
            @{{ profile.username }}
          </span>
        </div>
      </div>
    </section>

    <section
      v-if="isLoadingAssets || hasPrivateAssets"
      class="flex flex-col gap-4"
    >
      <span class="text-sm text-base-foreground">
        {{ $t('comfyHubPublish.additionalInfo') }}
      </span>

      <p
        v-if="isLoadingAssets"
        class="m-0 text-sm text-muted-foreground italic"
      >
        {{ $t('shareWorkflow.checkingAssets') }}
      </p>
      <ShareAssetWarningBox
        v-else
        v-model:acknowledged="acknowledged"
        :items="privateAssets"
      />
    </section>
  </div>
</template>

<script setup lang="ts">
import { useAsyncState } from '@vueuse/core'
import { computed, watch } from 'vue'

import type { ComfyHubProfile } from '@/schemas/apiSchema'
import ShareAssetWarningBox from '@/platform/workflow/sharing/components/ShareAssetWarningBox.vue'
import { useWorkflowShareService } from '@/platform/workflow/sharing/services/workflowShareService'

const { profile } = defineProps<{
  profile: ComfyHubProfile
}>()

const acknowledged = defineModel<boolean>('acknowledged', { default: false })
const ready = defineModel<boolean>('ready', { default: false })

const shareService = useWorkflowShareService()

const {
  state: privateAssets,
  isLoading: isLoadingAssets,
  error: privateAssetsError
} = useAsyncState(() => shareService.getShareableAssets(), [])

const hasPrivateAssets = computed(() => privateAssets.value.length > 0)
const isReady = computed(
  () =>
    !isLoadingAssets.value &&
    !privateAssetsError.value &&
    (!hasPrivateAssets.value || acknowledged.value)
)

watch(
  isReady,
  (val) => {
    ready.value = val
  },
  { immediate: true }
)
</script>
