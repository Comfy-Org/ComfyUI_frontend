<script setup lang="ts">
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger
} from 'reka-ui'
import type { MenuItem } from '@/components/ui/menu/types'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import AppModeWidgetList from '@/components/builder/AppModeWidgetList.vue'
import UngroupConfirmDialog from '@/components/builder/UngroupConfirmDialog.vue'
import {
  vGroupDropTarget,
  vGroupItemDrag,
  vGroupItemReorder
} from '@/components/builder/useGroupDrop'
import {
  autoGroupName,
  groupedByPair,
  resolveGroupItems
} from '@/components/builder/useInputGroups'
import Menu from '@/components/ui/menu/Menu.vue'
import EditableText from '@/components/common/EditableText.vue'
import Button from '@/components/ui/button/Button.vue'
import type { InputGroup } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useInputGroupStore } from '@/stores/inputGroupStore'
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

const isOpen = ref(builderMode)
const isRenaming = ref(false)
const showUngroupDialog = ref(false)

const displayName = computed(
  () => group.name ?? autoGroupName(group, resolvedSelections.value)
)
const resolvedItems = computed(() =>
  resolveGroupItems(group, resolvedSelections.value)
)
const rows = computed(() => groupedByPair(resolvedItems.value))
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
  inputGroupStore.renameGroup(group.id, value.trim() || null)
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
        builderMode &&
          'rounded-lg border border-dashed border-primary-background/40',
        !builderMode && 'border-border-subtle/40',
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
          class="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-transparent bg-transparent px-3 py-2 text-left hover:bg-secondary-background focus-visible:ring-1 focus-visible:ring-border-default focus-visible:outline-none"
        >
          <span
            :title="displayName"
            class="flex-1 truncate text-sm font-bold text-base-foreground"
            @dblclick.stop="builderMode && (isRenaming = true)"
          >
            {{ displayName }}
          </span>
          <i
            :class="
              cn(
                'icon-[lucide--chevron-down] size-4 shrink-0 text-muted-foreground transition-transform',
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
          <Button
            variant="muted-textonly"
            size="icon"
            :aria-label="t('g.more')"
          >
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
      <div
        v-if="builderMode"
        v-group-drop-target="{ groupId: group.id }"
        :class="
          cn(
            'flex min-h-10 flex-col gap-3 px-2 pb-2',
            '[&.group-drag-over]:bg-primary-background/5'
          )
        "
      >
        <template
          v-for="row in rows"
          :key="row.type === 'single' ? row.item.key : row.items[0].key"
        >
          <div
            v-if="row.type === 'single'"
            v-group-item-drag="{ itemKey: row.item.key, groupId: group.id }"
            v-group-item-reorder="{
              itemKey: row.item.key,
              groupId: group.id
            }"
            class="overflow-hidden rounded-lg p-1.5 [&_.drag-handle]:cursor-grab [&.pair-indicator]:ring-2 [&.pair-indicator]:ring-primary-background [&.reorder-after]:border-b-2 [&.reorder-after]:border-b-primary-background [&.reorder-before]:border-t-2 [&.reorder-before]:border-t-primary-background"
          >
            <AppModeWidgetList
              :widget-ids="[row.item.key]"
              builder-mode
              :draggable="false"
              hide-actions
            />
          </div>
          <div v-else class="flex gap-2">
            <div
              v-for="item in row.items"
              :key="item.key"
              v-group-item-drag="{ itemKey: item.key, groupId: group.id }"
              v-group-item-reorder="{
                itemKey: item.key,
                groupId: group.id
              }"
              class="min-w-0 flex-1 overflow-hidden rounded-lg p-0.5 [&_.drag-handle]:cursor-grab [&.pair-indicator]:ring-2 [&.pair-indicator]:ring-primary-background [&.reorder-after]:border-b-2 [&.reorder-after]:border-b-primary-background [&.reorder-before]:border-t-2 [&.reorder-before]:border-t-primary-background"
            >
              <AppModeWidgetList
                :widget-ids="[item.key]"
                builder-mode
                :draggable="false"
                hide-actions
              />
            </div>
          </div>
        </template>
        <div
          v-if="rows.length === 0"
          class="flex items-center justify-center py-3 text-xs text-muted-foreground"
        >
          {{ t('linearMode.groups.emptyGroup') }}
        </div>
      </div>
      <div v-else class="flex flex-col gap-4 px-4 pt-2 pb-4">
        <template
          v-for="row in rows"
          :key="row.type === 'single' ? row.item.key : row.items[0].key"
        >
          <div v-if="row.type === 'single'">
            <AppModeWidgetList
              :widget-ids="[row.item.key]"
              :mobile
              hide-actions
            />
          </div>
          <div v-else class="flex gap-2">
            <div
              v-for="item in row.items"
              :key="item.key"
              class="min-w-0 flex-1 overflow-hidden"
            >
              <AppModeWidgetList
                :widget-ids="[item.key]"
                :mobile
                hide-actions
                class="w-full"
              />
            </div>
          </div>
        </template>
      </div>
    </CollapsibleContent>
  </CollapsibleRoot>
</template>
