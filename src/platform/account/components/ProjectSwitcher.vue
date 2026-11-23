<template>
  <PopoverRoot v-if="showSwitcher" v-slot="{ close }">
    <PopoverTrigger as-child>
      <Button
        variant="textonly"
        size="unset"
        :class="
          cn(profileMenuRowClass, 'justify-start data-[state=open]:bg-accent')
        "
        :title="selectedName"
        :aria-label="$t('projectSwitcher.switchProject')"
        data-testid="project-switcher-trigger"
      >
        <WorkspaceProfilePic
          class="size-8 shrink-0 text-sm"
          :workspace-name="selectedName"
        />
        <div class="flex min-w-0 flex-1 flex-col">
          <span class="truncate text-foreground">{{ selectedName }}</span>
          <span class="truncate text-2xs text-muted-foreground">{{
            selectedSubtitle
          }}</span>
        </div>
        <i class="icon-[lucide--arrow-left-right] text-muted-foreground" />
      </Button>
    </PopoverTrigger>
    <PopoverContent
      :side="flyoutSide"
      align="start"
      :side-offset="sideOffset"
      prioritize-position
      dismiss-on-viewport-change
      class="w-80 overflow-visible rounded-xl p-2"
      data-testid="project-switcher-panel"
    >
      <ProjectSwitcherFlyout @select="close" @create="close" />
    </PopoverContent>
  </PopoverRoot>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import PopoverContent from '@comfyorg/design-system/popover/PopoverContent'
import { cn } from '@comfyorg/tailwind-utils'
import { profileMenuRowClass } from '@/platform/account/components/profileMenuRow'
import ProjectSwitcherFlyout from '@/platform/account/components/ProjectSwitcherFlyout.vue'
import WorkspaceProfilePic from '@/platform/workspace/components/WorkspaceProfilePic.vue'
import { projectRoleLabelKey } from '@/platform/workspace/projectPermissions'
import { useProjectStore } from '@/platform/workspace/stores/projectStore'

const { flyoutSide = 'left', sideOffset = 16 } = defineProps<{
  flyoutSide?: 'left' | 'right'
  sideOffset?: number
}>()

const { t } = useI18n()
const projectStore = useProjectStore()
const { showSwitcher, selectedProject } = storeToRefs(projectStore)

const selectedName = computed(
  () => selectedProject.value?.name ?? t('projectSwitcher.switchProject')
)
const selectedSubtitle = computed(() => {
  const project = selectedProject.value
  return project ? t(projectRoleLabelKey(project)) : ''
})
</script>
