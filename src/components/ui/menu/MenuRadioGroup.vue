<script setup lang="ts" generic="T extends string">
import { createReusableTemplate } from '@vueuse/core'
import { DropdownMenuRadioGroup } from 'reka-ui'

import TextTooltip from '@/components/ui/tooltip/TextTooltip.vue'

import MenuItemContent from './MenuItemContent.vue'
import MenuRadioItem from './MenuRadioItem.vue'

interface Option {
  label: string
  value: T
  command?: () => unknown
  icon?: string
  tooltip?: string
}

defineProps<{
  options: Option[]
}>()

const selected = defineModel<T>({ required: true })
const emit = defineEmits<{ select: [event: Event] }>()

const [DefineItem, ReuseItem] = createReusableTemplate<{ option: Option }>({
  props: { option: { type: Object, required: true } }
})

function select(option: Option, event: Event) {
  selected.value = option.value
  option.command?.()
  emit('select', event)
}
</script>

<template>
  <DefineItem v-slot="{ option }">
    <MenuRadioItem :value="option.value" @select="select(option, $event)">
      <MenuItemContent
        :item="{
          label: option.label,
          icon: option.icon,
          checked: selected === option.value
        }"
        :has-submenu="false"
      />
    </MenuRadioItem>
  </DefineItem>
  <DropdownMenuRadioGroup :model-value="selected">
    <template v-for="option in options" :key="option.value">
      <TextTooltip v-if="option.tooltip" :text="option.tooltip" side="right">
        <ReuseItem :option />
      </TextTooltip>
      <ReuseItem v-else :option />
    </template>
  </DropdownMenuRadioGroup>
</template>
