<template>
  <div class="flex flex-col gap-1">
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

      <template v-else>
        <Button
          v-for="project in projects"
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
            <span
              class="text-2xs leading-none font-medium text-muted-foreground uppercase"
            >
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
      v-if="canCreate"
      variant="muted-textonly"
      size="unset"
      class="min-h-10 w-full justify-start rounded-lg px-2 py-1 text-left font-normal whitespace-normal"
      data-testid="project-switcher-create"
      @click="emit('create')"
    >
      <i class="icon-[lucide--plus]" />
      <span class="truncate text-sm">{{
        $t('projectSwitcher.createProject')
      }}</span>
    </Button>
    <p
      v-if="!canCreate && !isLoading && !hasLoadError"
      class="flex min-h-10 items-start gap-2 px-2 py-1 text-xs text-muted-foreground"
      data-testid="project-switcher-create-refusal"
    >
      <i class="icon-[lucide--info]" aria-hidden="true" />
      {{ $t('projectSwitcher.cannotCreate') }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'

import Button from '@comfyorg/design-system/button/Button'
import WorkspaceProfilePic from '@/platform/workspace/components/WorkspaceProfilePic.vue'
import { projectRoleLabelKey } from '@/platform/workspace/projectPermissions'
import { useProjectStore } from '@/platform/workspace/stores/projectStore'

const emit = defineEmits<{
  select: []
  create: []
}>()

const projectStore = useProjectStore()
const { projects, selectedId, canCreate, isLoading, hasLoadError } =
  storeToRefs(projectStore)

function handleSelect(projectId: string): void {
  projectStore.selectProject(projectId)
  emit('select')
}

function retryLoad(): void {
  void projectStore.load()
}
</script>
