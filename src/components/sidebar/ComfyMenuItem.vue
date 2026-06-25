<script setup lang="ts">
import type { MenuItem } from 'primevue/menuitem'
import Tag from 'primevue/tag'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import DropdownMenuItem from '@/components/ui/dropdown-menu/DropdownMenuItem.vue'
import DropdownMenuSeparator from '@/components/ui/dropdown-menu/DropdownMenuSeparator.vue'
import DropdownMenuShortcut from '@/components/ui/dropdown-menu/DropdownMenuShortcut.vue'
import DropdownMenuSub from '@/components/ui/dropdown-menu/DropdownMenuSub.vue'
import DropdownMenuSubContent from '@/components/ui/dropdown-menu/DropdownMenuSubContent.vue'
import DropdownMenuSubTrigger from '@/components/ui/dropdown-menu/DropdownMenuSubTrigger.vue'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useTelemetry } from '@/platform/telemetry'
import { useCommandStore } from '@/stores/commandStore'
import { whileMouseDown } from '@/utils/mouseDownUtil'

defineOptions({ name: 'ComfyMenuItem' })

const { item } = defineProps<{ item: MenuItem }>()

const { t } = useI18n()
const commandStore = useCommandStore()
const settingStore = useSettingStore()
const telemetry = useTelemetry()

const isZoomCommand = computed(
  () =>
    item.comfyCommand?.id === 'Comfy.Canvas.ZoomIn' ||
    item.comfyCommand?.id === 'Comfy.Canvas.ZoomOut'
)

const hasActivePredicate = computed(
  () => typeof item.comfyCommand?.active === 'function'
)

const isActive = computed(() => Boolean(item.comfyCommand?.active?.()))

const nodes2Enabled = computed(() =>
  Boolean(settingStore.get('Comfy.VueNodes.Enabled') ?? false)
)

async function onNodes2ToggleChange(value: boolean) {
  await settingStore.set('Comfy.VueNodes.Enabled', value)
  telemetry?.trackUiButtonClicked({
    button_id: `menu_nodes_2.0_toggle_${value ? 'enabled' : 'disabled'}`,
    element_group: 'sidebar'
  })
}

function onSelect(event: Event) {
  if (isZoomCommand.value) {
    event.preventDefault()
    return
  }
  if (hasActivePredicate.value) {
    event.preventDefault()
    item.command?.({ item, originalEvent: event })
    return
  }
  item.command?.({ item, originalEvent: event })
}

function onMouseDown(event: MouseEvent) {
  if (!isZoomCommand.value || !item.comfyCommand) return
  whileMouseDown(
    event,
    async () => {
      await commandStore.execute(item.comfyCommand!.id)
    },
    50
  )
}
</script>

<template>
  <DropdownMenuSeparator v-if="item.separator" />

  <DropdownMenuItem
    v-else-if="item.key === 'nodes-2.0-toggle'"
    @select="(event: Event) => event.preventDefault()"
  >
    <span class="flex-1">{{ item.label }}</span>
    <Tag severity="info" class="text-xs">{{ t('g.beta') }}</Tag>
    <ToggleSwitch
      :model-value="nodes2Enabled"
      :aria-label="item.label as string"
      :pt="{
        root: { style: { width: '38px', height: '20px' } },
        handle: { style: { width: '16px', height: '16px' } }
      }"
      @click.stop
      @update:model-value="onNodes2ToggleChange"
    />
  </DropdownMenuItem>

  <DropdownMenuSub v-else-if="item.items?.length">
    <DropdownMenuSubTrigger>
      <template v-if="item.icon" #icon><i :class="item.icon" /></template>
      {{ item.label }}
    </DropdownMenuSubTrigger>
    <DropdownMenuSubContent>
      <ComfyMenuItem
        v-for="(child, idx) in item.items"
        :key="(child.key as string | undefined) ?? idx"
        :item="child"
      />
    </DropdownMenuSubContent>
  </DropdownMenuSub>

  <DropdownMenuItem
    v-else
    :checkable="hasActivePredicate"
    :checked="hasActivePredicate ? isActive : undefined"
    @select="onSelect"
    @mousedown="onMouseDown"
  >
    <template v-if="item.icon" #icon>
      <i :class="item.icon" />
    </template>
    {{ item.label }}
    <DropdownMenuShortcut v-if="item.comfyCommand?.keybinding">
      {{ item.comfyCommand.keybinding.combo.toString() }}
    </DropdownMenuShortcut>
  </DropdownMenuItem>
</template>
