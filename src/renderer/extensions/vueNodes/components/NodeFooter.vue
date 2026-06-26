<template>
  <!-- Case 1: Subgraph + Error (Dual Tabs) -->
  <div
    v-if="isSubgraph && hasAnyError && showErrorsTabEnabled"
    :class="errorWrapperStyles"
  >
    <Button
      variant="textonly"
      :class="
        cn(
          tabStyles,
          'z-10 box-border w-1/2 rounded-none bg-destructive-background pt-9 pb-4 text-white hover:bg-destructive-background-hover',
          errorRadiusClass
        )
      "
      @pointerup="snapshotDragOnPointerUp"
      @click.stop="emitIfNotDragged('openErrors')"
    >
      <div class="flex size-full items-center justify-center gap-2">
        <span class="truncate">{{ t('g.error') }}</span>
        <i class="icon-[lucide--info] size-4 shrink-0" />
      </div>
    </Button>

    <Button
      variant="textonly"
      data-testid="subgraph-enter-button"
      :class="
        cn(
          tabStyles,
          '-ml-5 box-border w-[calc(50%+20px)] rounded-none bg-node-component-header-surface pt-9 pb-4 pl-5',
          enterRadiusClass
        )
      "
      :style="headerColorStyle"
      @pointerup="snapshotDragOnPointerUp"
      @click.stop="emitIfNotDragged('enterSubgraph')"
    >
      <div class="flex size-full items-center justify-center gap-2">
        <span class="truncate">{{ t('g.enter') }}</span>
        <i class="icon-[comfy--workflow] size-4 shrink-0" />
      </div>
    </Button>
  </div>

  <!-- Case 1b: Advanced + Error (Dual Tabs, Regular Nodes) -->
  <div
    v-else-if="
      !isSubgraph &&
      hasAnyError &&
      showErrorsTabEnabled &&
      (showAdvancedInputsButton || showAdvancedState)
    "
    :class="errorWrapperStyles"
  >
    <Button
      variant="textonly"
      :class="
        cn(
          tabStyles,
          'z-10 box-border w-1/2 rounded-none bg-destructive-background pt-9 pb-4 text-white hover:bg-destructive-background-hover',
          errorRadiusClass
        )
      "
      @pointerup="snapshotDragOnPointerUp"
      @click.stop="emitIfNotDragged('openErrors')"
    >
      <div class="flex size-full items-center justify-center gap-2">
        <span class="truncate">{{ t('g.error') }}</span>
        <i class="icon-[lucide--info] size-4 shrink-0" />
      </div>
    </Button>

    <Button
      as="div"
      variant="textonly"
      data-testid="advanced-inputs-button"
      :class="
        cn(
          tabStyles,
          'relative z-0 -ml-5 box-border w-[calc(50%+20px)] rounded-none bg-node-component-header-surface pt-9 pb-4 pl-5',
          'has-[[data-testid=advanced-settings-button]:hover]:hover:bg-node-component-header-surface',
          enterRadiusClass
        )
      "
      :style="headerColorStyle"
      @pointerup="snapshotDragOnPointerUp"
      @click.stop="emitIfNotDragged('toggleAdvanced')"
    >
      <div
        class="flex size-full items-center justify-center gap-2"
        :class="{ 'px-8': showAdvancedState }"
      >
        <span class="min-w-0 truncate">{{
          showAdvancedState
            ? t('rightSidePanel.hideAdvancedShort')
            : t('rightSidePanel.showAdvancedShort')
        }}</span>
        <i
          v-if="!showAdvancedState"
          class="icon-[lucide--settings-2] size-4 shrink-0"
        />
      </div>

      <NodeFooterAdvancedSettingsButton
        v-if="showAdvancedState"
        class="border-interface-stroke-muted/20 absolute inset-y-0 right-0 flex aspect-square h-full w-8 shrink-0 items-center justify-center rounded-none border-l bg-node-component-header-surface pt-9 pr-1 pb-4"
        :class="cn(tabStyles, enterRadiusClass)"
        :style="headerColorStyle"
      />
    </Button>
  </div>

  <!-- Case 2: Error Only (Full Width) -->
  <div
    v-else-if="hasAnyError && showErrorsTabEnabled"
    :class="errorWrapperStyles"
  >
    <Button
      variant="textonly"
      :class="
        cn(
          tabStyles,
          'box-border w-full rounded-none bg-destructive-background pt-9 pb-4 text-white hover:bg-destructive-background-hover',
          footerRadiusClass
        )
      "
      @pointerup="snapshotDragOnPointerUp"
      @click.stop="emitIfNotDragged('openErrors')"
    >
      <div class="flex size-full items-center justify-center gap-2">
        <span class="truncate">{{ t('g.error') }}</span>
        <i class="icon-[lucide--info] size-4 shrink-0" />
      </div>
    </Button>
  </div>

  <!-- Case 3: Subgraph only (Full Width) -->
  <div
    v-else-if="isSubgraph"
    :class="
      cn(
        footerWrapperBase,
        hasAnyError ? '-mx-1 -mb-2 w-[calc(100%+8px)] pb-1' : 'w-full'
      )
    "
  >
    <Button
      variant="textonly"
      data-testid="subgraph-enter-button"
      :class="
        cn(
          tabStyles,
          'box-border w-full rounded-none bg-node-component-header-surface',
          hasAnyError ? 'pt-9 pb-4' : 'pt-8 pb-4',
          footerRadiusClass
        )
      "
      :style="headerColorStyle"
      @pointerup="snapshotDragOnPointerUp"
      @click.stop="emitIfNotDragged('enterSubgraph')"
    >
      <div class="flex size-full items-center justify-center gap-2">
        <span class="truncate">{{ t('g.enterSubgraph') }}</span>
        <i class="icon-[comfy--workflow] size-4 shrink-0" />
      </div>
    </Button>
  </div>

  <!-- Case 4: Advanced Footer (Regular Nodes) -->
  <div
    v-else-if="showAdvancedInputsButton || showAdvancedState"
    :class="
      cn(
        footerWrapperBase,
        hasAnyError ? '-mx-1 -mb-2 w-[calc(100%+8px)] pb-1' : 'w-full',
        'relative flex items-center'
      )
    "
  >
    <Button
      variant="textonly"
      data-testid="advanced-inputs-button"
      :class="
        cn(
          tabStyles,
          'box-border w-full rounded-none bg-node-component-header-surface',
          hasAnyError ? 'pt-9 pb-4' : 'pt-8 pb-4',
          footerRadiusClass
        )
      "
      :style="headerColorStyle"
      @pointerup="snapshotDragOnPointerUp"
      @click.stop="emitIfNotDragged('toggleAdvanced')"
    >
      <div
        class="flex size-full items-center justify-center gap-2"
        :class="{ 'px-10': showAdvancedState }"
      >
        <template v-if="showAdvancedState">
          <span class="truncate">{{
            t('rightSidePanel.hideAdvancedInputsButton')
          }}</span>
        </template>
        <template v-else>
          <span class="truncate">{{
            t('rightSidePanel.showAdvancedInputsButton')
          }}</span>
          <i class="icon-[lucide--settings-2] size-4 shrink-0" />
        </template>
      </div>
    </Button>

    <NodeFooterAdvancedSettingsButton
      v-if="showAdvancedState"
      class="border-interface-stroke-muted/20 absolute inset-y-0 right-0 flex aspect-square h-full w-10 shrink-0 items-center justify-center rounded-none border-l bg-node-component-header-surface"
      :class="
        cn(
          tabStyles,
          footerRadiusRightClass,
          hasAnyError ? 'pt-9 pb-4' : 'pt-8 pb-4'
        )
      "
      :style="headerColorStyle"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from '@/components/ui/button/Button.vue'
import NodeFooterAdvancedSettingsButton from './NodeFooterAdvancedSettingsButton.vue'
import { RenderShape } from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { cn } from '@comfyorg/tailwind-utils'

const { t } = useI18n()

interface Props {
  isSubgraph: boolean
  hasAnyError: boolean
  showErrorsTabEnabled: boolean
  showAdvancedInputsButton?: boolean
  showAdvancedState?: boolean
  headerColor?: string
  shape?: RenderShape
}

const {
  isSubgraph,
  hasAnyError,
  showErrorsTabEnabled,
  showAdvancedInputsButton,
  showAdvancedState,
  headerColor,
  shape
} = defineProps<Props>()

const emit = defineEmits<{
  enterSubgraph: []
  openErrors: []
  toggleAdvanced: []
}>()

let suppressNextClick = false

function snapshotDragOnPointerUp() {
  suppressNextClick = layoutStore.isDraggingVueNodes.value
}

function emitIfNotDragged(
  name: 'enterSubgraph' | 'openErrors' | 'toggleAdvanced'
) {
  const wasDrag = suppressNextClick
  suppressNextClick = false
  if (wasDrag) return
  if (name === 'enterSubgraph') emit('enterSubgraph')
  else if (name === 'openErrors') emit('openErrors')
  else emit('toggleAdvanced')
}

const RADIUS_CLASS = {
  'rounded-b-17': 'rounded-b-[17px]',
  'rounded-b-20': 'rounded-b-[20px]',
  'rounded-br-17': 'rounded-br-[17px]',
  'rounded-br-20': 'rounded-br-[20px]',
  'rounded-bl-17': 'rounded-bl-[17px]',
  'rounded-bl-20': 'rounded-bl-[20px]'
} as const

const SHAPE_CORNER_PREFIX_MAP: Record<
  string | number,
  Record<'both' | 'right' | 'left', string>
> = {
  [RenderShape.BOX]: { both: '', right: '', left: '' },
  [RenderShape.CARD]: { both: 'rounded-br', right: 'rounded-br', left: '' },
  default: { both: 'rounded-b', right: 'rounded-br', left: 'rounded-bl' }
}

function getBottomRadius(
  nodeShape: RenderShape | undefined,
  size: '17px' | '20px',
  corners: 'both' | 'right' | 'left' = 'both'
): string {
  const map =
    SHAPE_CORNER_PREFIX_MAP[nodeShape ?? 'default'] ??
    SHAPE_CORNER_PREFIX_MAP.default
  const prefix = map[corners]
  if (!prefix) return ''
  const key =
    `${prefix}-${size === '17px' ? '17' : '20'}` as keyof typeof RADIUS_CLASS
  return RADIUS_CLASS[key]
}

const footerRadiusClass = computed(() =>
  getBottomRadius(shape, hasAnyError ? '20px' : '17px')
)

const footerRadiusRightClass = computed(() =>
  getBottomRadius(shape, hasAnyError ? '20px' : '17px', 'right')
)

const errorRadiusClass = computed(() => getBottomRadius(shape, '20px', 'left'))

const enterRadiusClass = computed(() => getBottomRadius(shape, '20px', 'right'))

const tabStyles = 'pointer-events-auto h-9 text-xs'
const footerWrapperBase = 'isolate -z-1 -mt-5 box-border flex'
const errorWrapperStyles = cn(
  footerWrapperBase,
  '-mx-1 -mb-2 w-[calc(100%+8px)] pb-1'
)

const headerColorStyle = computed(() =>
  headerColor ? { backgroundColor: headerColor } : undefined
)
</script>
