<script setup lang="ts">
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger
} from 'reka-ui'
import type { MenuItem } from '@comfyorg/design-system/lib/menu/types'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import InputGroupContent from '@/components/builder/InputGroupContent.vue'
import UngroupConfirmDialog from '@/components/builder/UngroupConfirmDialog.vue'
import {
  autoGroupName,
  createInputLinkChecker,
  isRenderableAppInput,
  resolveGroupItems
} from '@/components/builder/useInputGroups'
import Menu from '@comfyorg/design-system/menu/Menu'
import EditableText from '@comfyorg/design-system/common/EditableText'
import Button from '@comfyorg/design-system/button/Button'
import type { InputGroup } from '@comfyorg/graph-model/workflowSchema'
import { useInputGroupStore } from '@/stores/inputGroupStore'
import { useLinkStore } from '@/stores/linkStore'
import { useResolvedSelectedInputs } from '@/components/builder/useResolvedSelectedInputs'
import { cn } from '@comfyorg/tailwind-utils'

const {
  group,
  builderMode = false,
  mobile = false,
  position = 'middle'
} = defineProps<{
  group: InputGroup
  builderMode?: boolean
  mobile?: boolean
  position?: 'first' | 'middle' | 'last' | 'only'
}>()

const { t } = useI18n()
const inputGroupStore = useInputGroupStore()
const resolvedSelections = useResolvedSelectedInputs()
const isInputLinked = createInputLinkChecker(useLinkStore())

const isOpen = ref(true)
const isRenaming = ref(false)
const showUngroupDialog = ref(false)

const displayName = computed(
  () => group.name ?? autoGroupName(group, resolvedSelections.value)
)
const resolvedItems = computed(() =>
  resolveGroupItems(
    group,
    resolvedSelections.value.filter((selection) =>
      isRenderableAppInput(selection, isInputLinked)
    )
  )
)
const groupMenuEntries = computed<MenuItem[]>(() => [
  {
    label: t('g.rename'),
    icon: 'icon-[lucide--pencil]',
    command: () => (isRenaming.value = true)
  },
  {
    label: t('linearMode.groups.ungroup'),
    icon: 'icon-[lucide--ungroup]',
    command: () => (showUngroupDialog.value = true)
  }
])

function confirmRename(value: string) {
  const trimmed = value.trim()
  const isUnchangedAutoName =
    group.name === null && trimmed === displayName.value
  if (!isUnchangedAutoName)
    inputGroupStore.renameGroup(group.id, trimmed || null)
  isRenaming.value = false
}

function handleDissolve() {
  inputGroupStore.deleteGroup(group.id)
}
</script>

<template>
  <CollapsibleRoot
    v-model:open="isOpen"
    data-testid="input-group"
    :data-group-id="group.id"
    :class="
      cn(
        'flex flex-col',
        builderMode && 'rounded-lg border border-dashed border-primary/40',
        !builderMode && 'border-border/40',
        !builderMode &&
          position !== 'first' &&
          position !== 'only' &&
          'border-t',
        !builderMode &&
          (position === 'last' || position === 'only') &&
          'border-b'
      )
    "
  >
    <div
      :class="
        cn(
          'flex items-center gap-1',
          builderMode ? 'py-1 pr-1.5 pl-1' : 'px-4 py-2'
        )
      "
    >
      <EditableText
        v-if="isRenaming"
        :model-value="displayName"
        :is-editing="isRenaming"
        :input-attrs="{ 'aria-label': t('g.rename') }"
        class="min-w-0 flex-1 px-3 py-2"
        @edit="confirmRename"
        @cancel="isRenaming = false"
      />
      <CollapsibleTrigger v-else as-child>
        <button
          type="button"
          class="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-transparent bg-transparent px-3 py-2 text-left hover:bg-secondary focus-visible:ring-1 focus-visible:ring-border focus-visible:outline-none"
        >
          <span
            :title="displayName"
            class="flex-1 truncate text-sm font-bold text-foreground"
            @dblclick.stop="builderMode && (isRenaming = true)"
          >
            {{ displayName }}
          </span>
          <i
            :class="
              cn(
                'icon-[lucide--chevron-down] text-muted-foreground transition-transform',
                isOpen && 'rotate-180'
              )
            "
          />
        </button>
      </CollapsibleTrigger>
      <Menu
        v-if="builderMode"
        class="-mr-2 shrink-0"
        :items="groupMenuEntries"
        @close-auto-focus="isRenaming && $event.preventDefault()"
      >
        <template #trigger>
          <Button variant="textonly" size="icon" :aria-label="t('g.more')">
            <i class="icon-[lucide--ellipsis]" />
          </Button>
        </template>
      </Menu>
      <UngroupConfirmDialog
        v-model:open="showUngroupDialog"
        @confirm="handleDissolve"
      />
    </div>

    <CollapsibleContent>
      <InputGroupContent
        :group-id="group.id"
        :items="resolvedItems"
        :builder-mode
        :mobile
      />
    </CollapsibleContent>
  </CollapsibleRoot>
</template>
