<template>
  <Popover
    ref="popoverRef"
    :auto-z-index="true"
    :base-z-index="1100"
    :dismissable="true"
    :close-on-escape="true"
    unstyled
    :pt="{
      root: {
        class: 'absolute z-60'
      },
      content: {
        class: [
          'text-base-foreground rounded-lg',
          'shadow-lg border border-base-background',
          'bg-interface-panel-surface'
        ]
      }
    }"
  >
    <div
      v-if="isCompactColorPanel"
      class="w-[15.5rem] rounded-2xl border border-border-default bg-interface-panel-surface p-2.5 shadow-lg"
    >
      <div class="mb-2 flex items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {{ option.label }}
          </p>
          <p class="mt-0.5 truncate text-sm font-medium text-base-foreground">
            {{ pickerOption?.label ?? 'Custom' }}
          </p>
        </div>
        <div
          class="rounded-md border border-border-default bg-secondary-background px-2 py-1 font-mono text-[10px] text-muted-foreground"
        >
          {{ selectedPickerColor }}
        </div>
      </div>

      <ColorPicker
        v-if="pickerOption"
        data-testid="color-picker-inline"
        :model-value="pickerOption.pickerValue"
        inline
        format="hex"
        :aria-label="pickerOption.label"
        class="w-full"
        :pt="{
          root: { class: '!w-full' },
          content: {
            class: '!border-none !bg-transparent !p-0 !shadow-none'
          },
          colorSelector: {
            class: '!h-32 !w-full overflow-hidden !rounded-xl'
          },
          colorBackground: {
            class: '!rounded-xl'
          },
          colorHandle: {
            class:
              '!h-3.5 !w-3.5 !rounded-full !border-2 !border-black/70 !shadow-sm'
          },
          hue: {
            class:
              '!mt-2 !h-3 !overflow-hidden !rounded-full !border !border-border-default'
          },
          hueHandle: {
            class:
              '!h-3.5 !w-3.5 !-translate-x-1/2 !rounded-full !border-2 !border-white !shadow-sm'
          }
        }"
        @update:model-value="handleColorPickerUpdate(pickerOption, $event)"
      />

      <div
        v-if="swatchOptions.length"
        class="mt-2 rounded-xl border border-border-default bg-secondary-background p-2"
      >
        <div class="-mx-0.5 flex gap-1.5 overflow-x-auto px-0.5 pb-0.5">
          <button
            v-for="subOption in swatchOptions"
            :key="subOption.label"
            type="button"
            class="flex size-8 shrink-0 items-center justify-center rounded-xl border border-transparent transition-transform hover:scale-[1.04] hover:border-border-default hover:bg-secondary-background-hover"
            :title="subOption.label"
            @click="handleSubmenuClick(subOption)"
          >
            <div
              :class="
                cn(
                  'size-5 rounded-full border transition-shadow',
                  isSelectedSwatch(subOption)
                    ? 'border-white shadow-[0_0_0_2px_rgba(255,255,255,0.18)]'
                    : 'border-border-default'
                )
              "
              :style="{ backgroundColor: subOption.color }"
            />
          </button>
        </div>
      </div>
    </div>

    <div
      v-else
      :class="
        isColorSubmenu
          ? 'flex flex-col gap-1 p-2'
          : 'flex min-w-40 flex-col p-2'
      "
    >
      <template v-for="subOption in option.submenu" :key="subOption.label">
        <div
          :class="
            cn(
              'cursor-pointer rounded-sm hover:bg-secondary-background-hover',
              isColorSubmenu
                ? 'flex size-7 items-center justify-center'
                : 'flex items-center gap-2 px-3 py-1.5 text-sm',
              subOption.disabled
                ? 'pointer-events-none cursor-not-allowed text-node-icon-disabled'
                : 'hover:bg-secondary-background-hover'
            )
          "
          :title="subOption.label"
          @click="handleSubmenuClick(subOption)"
        >
          <div
            v-if="subOption.color"
            class="size-5 rounded-full border border-border-default"
            :style="{ backgroundColor: subOption.color }"
          />
          <template v-else-if="!subOption.color">
            <i
              v-if="isShapeSelected(subOption)"
              class="icon-[lucide--check] size-4 shrink-0"
            />
            <div v-else class="w-4 shrink-0" />
            <span>{{ subOption.label }}</span>
          </template>
        </div>
      </template>
    </div>
  </Popover>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import ColorPicker from 'primevue/colorpicker'
import Popover from 'primevue/popover'
import { computed, ref } from 'vue'

import type {
  MenuOption,
  SubMenuOption
} from '@/composables/graph/useMoreOptionsMenu'
import { useNodeCustomization } from '@/composables/graph/useNodeCustomization'

interface Props {
  option: MenuOption
}

interface Emits {
  (e: 'submenu-click', subOption: SubMenuOption): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { getCurrentShape } = useNodeCustomization()

const popoverRef = ref<InstanceType<typeof Popover>>()

const toggle = (event: Event, target?: HTMLElement) => {
  popoverRef.value?.toggle(event, target)
}
defineExpose({
  toggle
})

const handleSubmenuClick = (subOption: SubMenuOption) => {
  if (subOption.disabled) {
    return
  }
  emit('submenu-click', subOption)
  popoverRef.value?.hide()
}

const isPickerOption = (subOption: SubMenuOption): boolean =>
  typeof subOption.pickerValue === 'string' &&
  typeof subOption.onColorPick === 'function'

const pickerOption = computed(
  () => props.option.submenu?.find(isPickerOption) ?? null
)

const swatchOptions = computed(() =>
  (props.option.submenu ?? []).filter(
    (subOption) => Boolean(subOption.color) && !isPickerOption(subOption)
  )
)

const selectedPickerColor = computed(() =>
  pickerOption.value?.pickerValue
    ? `#${pickerOption.value.pickerValue.toUpperCase()}`
    : '#000000'
)

const isCompactColorPanel = computed(() => Boolean(pickerOption.value))

async function handleColorPickerUpdate(
  subOption: SubMenuOption,
  value: string
) {
  if (!isPickerOption(subOption) || !value) return

  await subOption.onColorPick?.(`#${value}`)
}

function isSelectedSwatch(subOption: SubMenuOption): boolean {
  return (
    subOption.color?.toLowerCase() === selectedPickerColor.value.toLowerCase()
  )
}

const isShapeSelected = (subOption: SubMenuOption): boolean => {
  if (subOption.color) return false

  const currentShape = getCurrentShape()
  if (!currentShape) return false

  return currentShape.localizedName === subOption.label
}

const isColorSubmenu = computed(() => {
  return (
    props.option.submenu &&
    props.option.submenu.length > 0 &&
    props.option.submenu.every((item) => item.color && !item.icon)
  )
})
</script>
