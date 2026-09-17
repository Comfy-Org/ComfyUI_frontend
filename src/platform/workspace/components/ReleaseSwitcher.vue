<!-- Which developer-platform Release this browser runs on, and the list it
     may pick from (FE-2434). Sits under the workspace selector in the user
     popover; renders nothing while the account is outside the rollout. -->
<template>
  <div v-if="isVisible" class="relative" data-testid="release-switcher">
    <button
      ref="trigger"
      type="button"
      class="flex w-full cursor-pointer appearance-none items-center justify-between rounded-lg border-0 bg-transparent px-4 py-2 text-left hover:bg-secondary-background-hover disabled:cursor-wait"
      :aria-expanded="isOpen"
      aria-haspopup="menu"
      aria-controls="release-switcher-panel"
      :disabled="isSwitching"
      data-testid="release-switcher-trigger"
      @click="isOpen = !isOpen"
      @keydown.escape.stop="isOpen = false"
    >
      <div class="flex w-0 flex-1 items-center gap-2">
        <i
          class="icon-[lucide--package] size-4 shrink-0 text-muted-foreground"
        />
        <div class="flex min-w-0 flex-1 flex-col">
          <span class="text-xs text-muted-foreground">
            {{ $t('releaseSwitcher.runningOn') }}
          </span>
          <span
            class="truncate text-sm text-base-foreground"
            data-testid="release-switcher-current"
          >
            {{ currentLabel }}
          </span>
        </div>
      </div>
      <i class="pi pi-chevron-down shrink-0 text-sm text-muted-foreground" />
    </button>

    <div
      v-if="isOpen"
      id="release-switcher-panel"
      ref="panel"
      role="menu"
      class="absolute top-0 right-full z-10 mr-4 flex max-h-96 w-80 flex-col overflow-hidden rounded-lg border border-border-default bg-base-background shadow-[1px_1px_8px_0_rgba(0,0,0,0.4)]"
      data-testid="release-switcher-panel"
    >
      <div
        class="flex scrollbar-custom min-h-0 flex-1 flex-col overflow-y-auto"
      >
        <div
          v-if="state.phase === 'loading'"
          class="flex h-[54px] animate-pulse items-center gap-2 p-4"
          data-testid="release-switcher-loading"
        >
          <div class="h-4 w-32 rounded-sm bg-secondary-background" />
        </div>

        <p
          v-else-if="state.phase === 'unavailable'"
          class="m-0 px-4 py-3 text-sm text-muted-foreground"
          data-testid="release-switcher-unavailable"
        >
          {{ state.message }}
        </p>

        <template v-else>
          <button
            type="button"
            role="menuitemradio"
            :aria-checked="pickedReleaseId === null"
            :class="rowClass(pickedReleaseId === null)"
            data-testid="release-row-cloud"
            @click="choose(null)"
          >
            <div class="flex min-w-0 flex-1 flex-col items-start gap-0.5">
              <span class="truncate text-sm text-base-foreground">
                {{ $t('releaseSwitcher.comfyCloud') }}
              </span>
              <span class="text-xs text-muted-foreground">
                {{ $t('releaseSwitcher.comfyCloudCaption') }}
              </span>
            </div>
            <i
              v-if="pickedReleaseId === null"
              class="pi pi-check shrink-0 text-sm text-base-foreground"
            />
          </button>

          <button
            v-for="release in releases"
            :key="release.release_id"
            :title="
              release.deployed
                ? undefined
                : $t('releaseSwitcher.notDeployedTooltip')
            "
            type="button"
            role="menuitemradio"
            :aria-checked="release.release_id === pickedReleaseId"
            :disabled="!release.deployed"
            :class="rowClass(release.release_id === pickedReleaseId)"
            :data-testid="`release-row-${release.release_id}`"
            @click="choose(release.release_id)"
          >
            <div class="flex min-w-0 flex-1 flex-col items-start gap-0.5">
              <span class="truncate text-sm text-base-foreground">
                {{ releaseLabel(release) }}
              </span>
              <span class="text-xs text-muted-foreground">
                {{ deploymentLabel(release) }}
              </span>
            </div>
            <i
              v-if="release.release_id === pickedReleaseId"
              class="pi pi-check shrink-0 text-sm text-base-foreground"
            />
          </button>

          <p
            v-if="releases.length === 0"
            class="m-0 px-4 py-3 text-xs text-muted-foreground"
            data-testid="release-switcher-empty"
          >
            {{ $t('releaseSwitcher.noReleases') }}
          </p>
          <p
            v-if="!buildsVisible"
            class="m-0 px-4 py-2 text-xs text-muted-foreground"
          >
            {{ $t('releaseSwitcher.buildsHidden') }}
          </p>
        </template>
      </div>
      <div
        class="shrink-0 border-t border-border-default px-4 py-2 text-xs text-muted-foreground"
      >
        {{ $t('releaseSwitcher.reloadNote') }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import type { WorkspaceRelease } from '@/platform/workspace/api/workspaceApi'
import { useReleasePickStore } from '@/platform/workspace/stores/releasePickStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { cn } from '@comfyorg/tailwind-utils'

const { t } = useI18n()
const store = useReleasePickStore()
const {
  state,
  releases,
  pickedReleaseId,
  pickedRelease,
  buildsVisible,
  isVisible,
  isSwitching
} = storeToRefs(store)

const isOpen = ref(false)
const trigger = useTemplateRef('trigger')
const panel = useTemplateRef('panel')

onClickOutside(
  panel,
  () => {
    isOpen.value = false
  },
  { ignore: [trigger] }
)

onMounted(() => {
  void store.load()
})

function releaseLabel(release: WorkspaceRelease): string {
  if (release.build_name !== undefined && release.version !== undefined) {
    return t('releaseSwitcher.release', {
      build: release.build_name,
      version: release.version
    })
  }
  return t('releaseSwitcher.unnamedRelease', {
    id: release.release_id.slice(0, 8)
  })
}

function deploymentLabel(release: WorkspaceRelease): string {
  if (!release.deployed) return t('releaseSwitcher.notDeployed')
  return t('releaseSwitcher.deployedAs', {
    status: release.deployment_status ?? ''
  })
}

const currentLabel = computed(() => {
  if (pickedReleaseId.value === null) return t('releaseSwitcher.comfyCloud')
  if (pickedRelease.value) return releaseLabel(pickedRelease.value)
  return t('releaseSwitcher.unnamedRelease', {
    id: pickedReleaseId.value.slice(0, 8)
  })
})

function rowClass(current: boolean): string {
  return cn(
    'flex w-full cursor-pointer appearance-none items-center gap-2 border-0 border-b border-border-default bg-transparent px-4 py-3 text-left',
    'hover:bg-secondary-background-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent',
    current && 'bg-secondary-background'
  )
}

async function choose(releaseId: string | null) {
  const refusal = await store.pick(releaseId)
  if (refusal === null) return
  isOpen.value = false
  useToastStore().add({
    severity: 'error',
    summary: t('releaseSwitcher.failedToSwitch'),
    detail: refusal,
    life: 8000
  })
}
</script>
