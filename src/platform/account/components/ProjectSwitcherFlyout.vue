<template>
  <div :class="cn('flex flex-col gap-1', showSearch && 'pt-1')">
    <div v-if="showSearch" class="flex flex-col gap-2">
      <input
        v-model="searchQuery"
        type="text"
        :placeholder="$t('projectSwitcher.searchPlaceholder')"
        :aria-label="$t('projectSwitcher.searchPlaceholder')"
        class="h-6 w-full border-none bg-transparent px-1 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        data-testid="project-switcher-search"
      />
      <div class="mx-1 mb-1 border-t" />
    </div>

    <div
      class="flex scrollbar-custom max-h-72 min-h-0 flex-col gap-2 overflow-y-auto py-1"
      data-testid="project-switcher-list"
    >
      <template v-if="isLoading">
        <div
          v-for="i in 2"
          :key="i"
          class="flex animate-pulse items-center gap-3 p-1"
        >
          <div class="size-8 rounded-md bg-secondary" />
          <div class="flex flex-col gap-1">
            <div class="h-3 w-24 rounded-sm bg-secondary" />
            <div class="h-2 w-14 rounded-sm bg-secondary" />
          </div>
        </div>
      </template>

      <div
        v-else-if="hasLoadError"
        class="flex flex-col gap-1 px-2 py-3 text-sm"
        data-testid="project-switcher-error"
      >
        <span class="text-muted-foreground">{{
          $t('projectSwitcher.loadFailed')
        }}</span>
        <Button
          variant="textonly"
          size="unset"
          class="self-start p-0 hover:bg-transparent"
          @click="retryLoad"
        >
          {{ $t('projectSwitcher.tryAgain') }}
        </Button>
      </div>

      <p
        v-else-if="noMatchQuery"
        class="m-0 px-2 py-3 text-sm text-muted-foreground"
        data-testid="project-switcher-no-results"
      >
        {{ $t('projectSwitcher.noResults', { query: noMatchQuery }) }}
      </p>

      <template v-else>
        <Button
          v-for="project in filteredProjects"
          :key="project.id"
          variant="textonly"
          size="unset"
          class="w-full justify-start gap-3 p-1 text-left font-normal"
          :aria-current="project.id === selectedId ? 'true' : undefined"
          data-testid="project-switcher-row"
          @click="handleSelect(project.id)"
        >
          <WorkspaceProfilePic
            class="size-8 shrink-0 text-sm"
            :workspace-name="project.name"
          />
          <span class="flex min-w-0 flex-1 flex-col">
            <span
              :title="project.name"
              class="truncate text-sm font-medium text-foreground"
            >
              {{ project.name }}
            </span>
            <span class="text-2xs text-muted-foreground">
              {{ $t(projectRoleLabelKey(project)) }}
            </span>
          </span>
          <i
            v-if="project.id === selectedId"
            class="icon-[lucide--check] text-foreground"
          />
        </Button>
      </template>
    </div>

    <div class="-mx-2 border-t" />
    <Button
      variant="muted-textonly"
      size="unset"
      :disabled="!canCreate"
      class="min-h-10 w-full justify-start rounded-lg px-2 py-1 text-left font-normal whitespace-normal"
      data-testid="project-switcher-create"
      @click="handleCreate"
    >
      <i class="icon-[lucide--plus]" />
      <span class="flex min-w-0 flex-1 flex-col gap-1">
        <span class="truncate text-sm">{{
          $t('projectSwitcher.createProject')
        }}</span>
        <span
          v-if="!canCreate"
          class="text-xs"
          data-testid="project-switcher-create-refusal"
        >
          {{ $t('projectSwitcher.cannotCreate') }}
        </span>
      </span>
    </Button>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import { cn } from '@comfyorg/tailwind-utils'
import WorkspaceProfilePic from '@/platform/workspace/components/WorkspaceProfilePic.vue'
import { projectRoleLabelKey } from '@/platform/workspace/projectPermissions'
import { useProjectStore } from '@/platform/workspace/stores/projectStore'

const SEARCH_THRESHOLD = 6

const emit = defineEmits<{
  select: []
  create: []
}>()

const projectStore = useProjectStore()
const { projects, selectedId, canCreate, isLoading, hasLoadError } =
  storeToRefs(projectStore)

const searchQuery = ref('')
const showSearch = computed(() => projects.value.length >= SEARCH_THRESHOLD)
const filteredProjects = computed(() => {
  const query = showSearch.value ? searchQuery.value.trim().toLowerCase() : ''
  if (!query) return projects.value
  return projects.value.filter((project) =>
    project.name.toLowerCase().includes(query)
  )
})
const noMatchQuery = computed(() =>
  filteredProjects.value.length === 0 && searchQuery.value.trim()
    ? searchQuery.value.trim()
    : ''
)

function handleSelect(projectId: string): void {
  projectStore.selectProject(projectId)
  emit('select')
}

function handleCreate(): void {
  if (canCreate.value) emit('create')
}

function retryLoad(): void {
  void projectStore.load()
}
</script>
