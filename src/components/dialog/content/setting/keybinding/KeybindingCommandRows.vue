<template>
  <TableRow
    tabindex="0"
    :data-state="selected ? 'selected' : undefined"
    @click="emit('rowClick', $event)"
    @dblclick="emit('rowDblclick')"
    @contextmenu="emit('rowContextmenu')"
    @keydown="emit('rowKeydown', $event)"
  >
    <TableCell class="p-1">
      <div
        class="flex min-w-0 items-center gap-1 truncate"
        :class="command.keybindings.length < 2 && 'pl-5'"
        :title="command.id"
      >
        <i
          v-if="command.keybindings.length >= 2"
          class="icon-[lucide--chevron-right] size-4 shrink-0 text-muted-foreground transition-transform"
          :class="expanded && 'rotate-90'"
        />
        <Tooltip
          v-if="
            command.keybindings.some(
              (binding) => binding.combo.isBrowserReserved
            )
          "
          :config="$t('g.browserReservedKeybindingTooltip')"
          side="right"
        >
          <i
            class="icon-[lucide--triangle-alert] shrink-0 text-warning-background"
          />
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
    <TableCell class="p-1 whitespace-nowrap">
      <div class="actions flex flex-row justify-end whitespace-nowrap">
        <Tooltip
          v-if="command.keybindings.length === 1"
          :config="$t('g.edit')"
          side="right"
        >
          <Button
            variant="textonly"
            size="icon"
            :aria-label="$t('g.edit')"
            @click="emit('edit', command.keybindings[0])"
          >
            <i class="icon-[lucide--pencil]" />
          </Button>
        </Tooltip>
        <Tooltip :config="$t('g.addNewKeybinding')" side="right">
          <Button
            variant="textonly"
            size="icon"
            :aria-label="$t('g.addNewKeybinding')"
            @click="emit('add')"
          >
            <i class="icon-[lucide--plus]" />
          </Button>
        </Tooltip>
        <Tooltip :config="$t('g.reset')" side="right">
          <Button
            variant="textonly"
            size="icon"
            :aria-label="$t('g.reset')"
            :disabled="!command.isModified"
            @click="emit('reset')"
          >
            <i class="icon-[lucide--rotate-ccw]" />
          </Button>
        </Tooltip>
        <Tooltip :config="$t('g.delete')" side="right">
          <Button
            variant="textonly"
            size="icon"
            :aria-label="$t('g.delete')"
            :disabled="command.keybindings.length === 0"
            @click="emit('remove')"
          >
            <i class="icon-[lucide--trash-2]" />
          </Button>
        </Tooltip>
      </div>
    </TableCell>
  </TableRow>
  <TableRow v-if="expanded">
    <TableCell colspan="4" class="p-0">
      <div class="pl-4" data-testid="keybinding-expansion-content">
        <div
          v-for="(binding, index) in command.keybindings"
          :key="binding.combo.serialize()"
          data-testid="keybinding-expansion-binding"
          class="flex items-center justify-between border-b border-border-subtle py-1.5 last:border-b-0"
        >
          <div class="flex items-center gap-4">
            <span class="text-muted-foreground">{{ command.label }}</span>
            <KeyComboDisplay
              :key-combo="binding.combo"
              :is-modified="command.isModified"
            />
          </div>
          <div class="flex flex-row">
            <Tooltip :config="$t('g.edit')" side="right">
              <Button
                variant="textonly"
                size="icon"
                :aria-label="$t('g.edit')"
                @click="emit('edit', binding)"
              >
                <i class="icon-[lucide--pencil]" />
              </Button>
            </Tooltip>
            <Tooltip :config="$t('g.removeKeybinding')" side="right">
              <Button
                variant="textonly"
                size="icon"
                :aria-label="$t('g.removeKeybinding')"
                @click="emit('removeSingle', index)"
              >
                <i class="icon-[lucide--trash-2]" />
              </Button>
            </Tooltip>
          </div>
        </div>
      </div>
    </TableCell>
  </TableRow>
</template>

<script setup lang="ts">
import type { KeybindingImpl } from '@/platform/keybindings/keybinding'

import Button from '@/components/ui/button/Button.vue'
import TableCell from '@/components/ui/table/TableCell.vue'
import TableRow from '@/components/ui/table/TableRow.vue'
import Tooltip from '@/components/ui/tooltip/Tooltip.vue'

import KeybindingList from './KeybindingList.vue'
import type { KeybindingCommand } from './keybindingCommandTypes'
import KeyComboDisplay from './KeyComboDisplay.vue'

const { command, expanded, selected } = defineProps<{
  command: KeybindingCommand
  expanded: boolean
  selected: boolean
}>()

const emit = defineEmits<{
  rowClick: [event: MouseEvent]
  rowDblclick: []
  rowContextmenu: []
  rowKeydown: [event: KeyboardEvent]
  edit: [binding: KeybindingImpl]
  add: []
  reset: []
  remove: []
  removeSingle: [index: number]
}>()
</script>
