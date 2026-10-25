<template>
  <RovingFocusItem as-child :tab-stop-id="command.rowId">
    <TableRow
      :id="command.rowId"
      :data-state="selected ? 'selected' : undefined"
      :aria-expanded="command.expandable ? expanded : undefined"
      @click="emit('activate')"
      @dblclick="emit('rowDblclick')"
      @contextmenu="emit('rowContextmenu', $event)"
      @keydown.context-menu.self.prevent="dispatchKeyboardContextMenu"
      @keydown.enter.self.prevent="emit('activate')"
      @keydown.shift.f10.self.prevent="dispatchKeyboardContextMenu"
      @keydown.space.self.prevent="emit('activate')"
    >
      <TableCell class="p-1">
        <div
          :class="
            cn(
              'flex min-w-0 items-center gap-1 truncate',
              !command.expandable && 'pl-5'
            )
          "
          :title="command.id"
        >
          <i
            v-if="command.expandable"
            :class="
              cn(
                'icon-[lucide--chevron-right] shrink-0 text-muted-foreground transition-transform',
                expanded && 'rotate-90'
              )
            "
          />
          <Tooltip
            v-if="
              command.keybindings.some(
                (binding) => binding.combo.isBrowserReserved
              )
            "
          >
            <TooltipTrigger as-child>
              <i class="icon-[lucide--triangle-alert] shrink-0 text-warning" />
            </TooltipTrigger>
            <TooltipContent>{{
              $t('g.browserReservedKeybindingTooltip')
            }}</TooltipContent>
          </Tooltip>
          {{ command.label }}
        </div>
      </TableCell>
      <TableCell class="p-1">
        <KeybindingList
          :keybindings="command.keybindings"
          :is-modified="command.isModified"
        />
      </TableCell>
      <TableCell class="p-1">
        <span class="block truncate" :title="command.source">{{
          command.source || '-'
        }}</span>
      </TableCell>
      <TableCell class="p-1">
        <div class="flex justify-end" @click.stop @dblclick.stop>
          <Button
            v-if="command.keybindings.length === 1"
            :tooltip="$t('g.edit')"
            variant="textonly"
            size="icon"
            :aria-label="$t('g.edit')"
            @click="emit('edit', command.keybindings[0])"
          >
            <i class="icon-[lucide--pencil]" />
          </Button>
          <Button
            :tooltip="$t('g.addNewKeybinding')"
            variant="textonly"
            size="icon"
            :aria-label="$t('g.addNewKeybinding')"
            @click="emit('add')"
          >
            <i class="icon-[lucide--plus]" />
          </Button>
          <Button
            :tooltip="$t('g.reset')"
            variant="textonly"
            size="icon"
            :aria-label="$t('g.reset')"
            :disabled="!command.isModified"
            @click="emit('reset')"
          >
            <i class="icon-[lucide--rotate-ccw]" />
          </Button>
          <Button
            :tooltip="$t('g.delete')"
            variant="textonly"
            size="icon"
            :aria-label="$t('g.delete')"
            :disabled="command.keybindings.length === 0"
            @click="emit('remove')"
          >
            <i class="icon-[lucide--trash-2]" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  </RovingFocusItem>
  <TableRow v-if="expanded">
    <TableCell colspan="4" class="p-0">
      <div class="pl-4" data-testid="keybinding-expansion-content">
        <div
          v-for="(binding, index) in command.keybindings"
          :key="binding.combo.serialize()"
          data-testid="keybinding-expansion-binding"
          class="flex items-center justify-between border-b border-border/50 py-1.5 last:border-b-0"
        >
          <div class="flex items-center gap-4">
            <span class="text-muted-foreground">{{ command.label }}</span>
            <KeyComboDisplay
              :key-combo="binding.combo"
              :is-modified="command.isModified"
            />
          </div>
          <div class="flex">
            <Button
              :tooltip="$t('g.edit')"
              variant="textonly"
              size="icon"
              :aria-label="$t('g.edit')"
              @click="emit('edit', binding)"
            >
              <i class="icon-[lucide--pencil]" />
            </Button>
            <Button
              :tooltip="$t('g.removeKeybinding')"
              variant="textonly"
              size="icon"
              :aria-label="$t('g.removeKeybinding')"
              @click="emit('removeSingle', index)"
            >
              <i class="icon-[lucide--trash-2]" />
            </Button>
          </div>
        </div>
      </div>
    </TableCell>
  </TableRow>
</template>

<script setup lang="ts">
import { RovingFocusItem } from 'reka-ui'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@comfyorg/design-system/button/Button'
import TableCell from '@comfyorg/design-system/table/TableCell'
import TableRow from '@comfyorg/design-system/table/TableRow'
import Tooltip from '@comfyorg/design-system/tooltip/Tooltip'
import TooltipContent from '@comfyorg/design-system/tooltip/TooltipContent'
import TooltipTrigger from '@comfyorg/design-system/tooltip/TooltipTrigger'
import type { KeybindingImpl } from '@/platform/keybindings/keybinding'
import type { ComfyCommandImpl } from '@/stores/commandStore'

import KeybindingList from './KeybindingList.vue'
import KeyComboDisplay from './KeyComboDisplay.vue'

const { command, expanded, selected } = defineProps<{
  command: Pick<ComfyCommandImpl, 'id' | 'source'> & {
    expandable: boolean
    isModified: boolean
    keybindings: KeybindingImpl[]
    label: string
    rowId: string
  }
  expanded: boolean
  selected: boolean
}>()

const emit = defineEmits<{
  activate: []
  add: []
  edit: [binding: KeybindingImpl]
  remove: []
  removeSingle: [index: number]
  reset: []
  rowContextmenu: [event: Event]
  rowDblclick: []
}>()

function dispatchKeyboardContextMenu(event: KeyboardEvent) {
  if (!(event.currentTarget instanceof HTMLElement)) return
  const { left, bottom } = event.currentTarget.getBoundingClientRect()
  event.currentTarget.dispatchEvent(
    new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: left,
      clientY: bottom
    })
  )
}
</script>
