<template>
  <section
    class="mx-2 mb-2 border-b border-border/50 pb-2"
    data-testid="workspace-library-section"
  >
    <div class="flex items-center gap-1">
      <Button
        variant="muted-textonly"
        size="sm"
        class="flex-1 justify-start"
        :aria-expanded="isOpen"
        :aria-controls="listId"
        @click="isOpen = !isOpen"
      >
        <i
          :class="
            cn(
              'icon-[lucide--chevron-right] transition-transform motion-reduce:transition-none',
              isOpen && 'rotate-90'
            )
          "
          aria-hidden="true"
        />
        {{ $t('sideToolbar.workspaceLibrary.title') }}
        <Badge
          v-if="modelCount > 0"
          variant="badge"
          severity="secondary"
          :aria-label="
            $t('sideToolbar.workspaceLibrary.modelCount', modelCount)
          "
          data-testid="workspace-library-count"
        >
          {{ modelCount }}
        </Badge>
      </Button>
      <Button
        variant="muted-textonly"
        size="icon-sm"
        :tooltip="$t('sideToolbar.workspaceLibrary.explainer')"
        tooltip-side="bottom"
        :aria-label="$t('sideToolbar.workspaceLibrary.explainer')"
      >
        <i class="icon-[lucide--info]" aria-hidden="true" />
      </Button>
    </div>
    <div v-if="isOpen" :id="listId" class="flex flex-col gap-2 px-2 pt-1">
      <p
        v-if="isLoading"
        role="status"
        class="m-0 text-xs text-muted-foreground"
      >
        {{ $t('g.loading') }}
      </p>
      <div v-else-if="failedFolders.length" class="flex items-center gap-2">
        <p class="m-0 flex-1 text-xs text-muted-foreground">
          {{ $t('sideToolbar.workspaceLibrary.loadFailed') }}
        </p>
        <Button variant="muted-textonly" size="sm" @click="retry">
          {{ $t('g.retry') }}
        </Button>
      </div>
      <p v-else-if="!shelves.length" class="m-0 text-xs text-muted-foreground">
        {{ $t(emptyMessageKey) }}
      </p>
      <div v-for="shelf in shelves" :key="shelf.folder">
        <h3 class="m-0 text-xs font-medium text-muted-foreground">
          {{ shelf.folder }}
        </h3>
        <ul class="m-0 list-none p-0">
          <li
            v-for="name in shelf.names"
            :key="name"
            class="flex items-center gap-1"
          >
            <Button
              variant="textonly"
              size="sm"
              class="min-w-0 flex-1 justify-start font-normal"
              :title="name"
              @click="place(shelf.folder, name)"
            >
              <span class="min-w-0 truncate">{{ name }}</span>
            </Button>
            <i
              role="img"
              :aria-label="$t('sideToolbar.workspaceLibrary.fromWorkspace')"
              :title="$t('sideToolbar.workspaceLibrary.fromWorkspace')"
              class="icon-[lucide--cloud] size-3.5 text-muted-foreground"
            />
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed, onScopeDispose, ref, useId, watch } from 'vue'

import Badge from '@comfyorg/design-system/badge/Badge'
import Button from '@comfyorg/design-system/button/Button'
import { startModelLoaderDrag } from '@/composables/node/startModelLoaderDrag'
import {
  WORKER_MODEL_FOLDERS,
  deploymentDownloads,
  useDeploymentLibraryModelsStore
} from '@/platform/workspace/stores/deploymentLibraryModelsStore'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'

const { searchQuery = '' } = defineProps<{ searchQuery?: string }>()

const modelToNodeStore = useModelToNodeStore()
const library = useDeploymentLibraryModelsStore()
const listId = useId()
const isOpen = ref(false)

const folders = computed(() =>
  [...WORKER_MODEL_FOLDERS].filter((folder) => deploymentDownloads(folder))
)

const libraryShelves = computed(() =>
  folders.value
    .map((folder) => ({ folder, names: library.namesIn(folder) }))
    .filter((shelf) => shelf.names.length > 0)
)

const shelves = computed(() => {
  const search = searchQuery.toLocaleLowerCase()
  if (!search) return libraryShelves.value
  return libraryShelves.value
    .map(({ folder, names }) => ({
      folder,
      names: names.filter((name) => name.toLocaleLowerCase().includes(search))
    }))
    .filter((shelf) => shelf.names.length > 0)
})

const emptyMessageKey = computed(() =>
  libraryShelves.value.length
    ? 'g.noResults'
    : 'sideToolbar.workspaceLibrary.empty'
)

const modelCount = computed(() =>
  folders.value.every((folder) => library.hasLoaded(folder))
    ? libraryShelves.value.reduce(
        (total, shelf) => total + shelf.names.length,
        0
      )
    : 0
)

const isLoading = computed(
  () =>
    !libraryShelves.value.length &&
    folders.value.some((folder) => library.statusOf(folder) === 'loading')
)

const failedFolders = computed(() =>
  folders.value.filter((folder) => library.statusOf(folder) === 'error')
)

function retry() {
  for (const folder of failedFolders.value) library.refresh(folder)
}

let stops: Array<() => void> = []

function stopWatching() {
  for (const stop of stops) stop()
  stops = []
}

watch(
  [isOpen, folders],
  ([open, watched]) => {
    stopWatching()
    if (!open) return
    stops = watched.map((folder) => library.watchFolder(folder, () => {}))
  },
  { immediate: true }
)

onScopeDispose(stopWatching)

function place(folder: string, name: string) {
  const provider = modelToNodeStore.getNodeProvider(folder)
  if (provider) startModelLoaderDrag(provider, name)
}
</script>
