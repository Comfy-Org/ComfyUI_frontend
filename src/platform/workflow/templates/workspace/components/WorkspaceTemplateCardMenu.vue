<template>
  <div v-if="template?.viewer_can_edit" @click.stop>
    <Menu
      v-model:open="isOpen"
      :items="menuItems"
      :modal="false"
      align="end"
      :side-offset="8"
      class="min-w-56"
    >
      <template #trigger>
        <Button
          variant="inverted"
          size="icon"
          :aria-label="$t('workspaceTemplates.templateActions')"
          :class="cn(!isOpen && 'not-group-hover/card:opacity-0')"
        >
          <i class="icon-[lucide--ellipsis]" />
        </Button>
      </template>
    </Menu>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import Menu from '@comfyorg/design-system/menu/Menu'
import type { MenuItem } from '@comfyorg/design-system/lib/menu/types'
import { cn } from '@comfyorg/tailwind-utils'

import { useWorkspaceTemplateDialogs } from '@/platform/workflow/templates/workspace/useWorkspaceTemplateDialogs'
import { useWorkspaceTemplatesStore } from '@/platform/workflow/templates/workspace/workspaceTemplatesStore'

const { templateId } = defineProps<{ templateId: string }>()

const { t } = useI18n()
const workspaceTemplatesStore = useWorkspaceTemplatesStore()
const { showEditDialog, confirmDelete } = useWorkspaceTemplateDialogs()

const isOpen = ref(false)
const template = computed(() =>
  workspaceTemplatesStore.findTemplate(templateId)
)

const menuItems = computed<MenuItem[]>(() => [
  {
    label: t('workspaceTemplates.editDetails'),
    icon: 'icon-[lucide--pencil]',
    command: () => showEditDialog(templateId)
  },
  { separator: true },
  {
    label: t('workspaceTemplates.deleteTemplate'),
    icon: 'icon-[lucide--trash-2]',
    visible: template.value?.viewer_can_delete,
    command: () => confirmDelete(templateId)
  }
])
</script>
