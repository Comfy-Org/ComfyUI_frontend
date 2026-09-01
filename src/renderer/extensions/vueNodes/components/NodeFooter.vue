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
          'z-10 box-border w-1/2 rounded-none bg-destructive-background pt-9 pb-3 text-white hover:bg-destructive-background-hover',
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
          '-ml-5 box-border w-[calc(50%+20px)] rounded-none bg-node-component-header-surface pt-9 pb-3 pl-5 text-node-component-slot-text',
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
          'z-10 box-border w-1/2 rounded-none bg-destructive-background pt-9 pb-3 text-white hover:bg-destructive-background-hover',
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
      data-testid="advanced-inputs-button"
      :class="
        cn(
          tabStyles,
          '-ml-5 box-border w-[calc(50%+20px)] rounded-none bg-node-component-header-surface pt-9 pb-3 pl-5 text-node-component-slot-text',
          enterRadiusClass
        )
      "
      :style="headerColorStyle"
      @pointerup="snapshotDragOnPointerUp"
      @click.stop="emitIfNotDragged('toggleAdvanced')"
    >
      <div class="flex size-full items-center justify-center gap-2">
        <span class="truncate">{{
          showAdvancedState
            ? t('rightSidePanel.hideAdvancedShort')
            : t('rightSidePanel.showAdvancedShort')
        }}</span>
        <i
          :class="
            showAdvancedState
              ? 'icon-[lucide--chevron-up] size-4 shrink-0'
              : 'icon-[lucide--settings-2] size-4 shrink-0'
          "
        />
      </div>
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
          'box-border w-full rounded-none bg-destructive-background pt-9 pb-3 text-white hover:bg-destructive-background-hover',
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
          'box-border w-full rounded-none bg-node-component-header-surface text-node-component-slot-text',
          hasAnyError ? 'pt-9 pb-3' : 'pt-8 pb-3',
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
        hasAnyError ? '-mx-1 -mb-2 w-[calc(100%+8px)] pb-1' : 'w-full'
      )
    "
  >
    <Button
      variant="textonly"
      data-testid="advanced-inputs-button"
      :class="
        cn(
          tabStyles,
          'box-border w-full rounded-none bg-node-component-header-surface text-node-component-slot-text',
          hasAnyError ? 'pt-9 pb-3' : 'pt-8 pb-3',
          footerRadiusClass
        )
      "
      :style="headerColorStyle"
      @pointerup="snapshotDragOnPointerUp"
      @click.stop="emitIfNotDragged('toggleAdvanced')"
    >
      <div class="flex size-full items-center justify-center gap-2">
        <template v-if="showAdvancedState">
          <span class="truncate">{{
            t('rightSidePanel.hideAdvancedInputsButton')
          }}</span>
          <i class="icon-[lucide--chevron-up] size-4 shrink-0" />
        </template>
        <template v-else>
          <span class="truncate">{{
            t('rightSidePanel.showAdvancedInputsButton')
          }}</span>
          <i class="icon-[lucide--settings-2] size-4 shrink-0" />
        </template>
      </div>
    </Button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from '@/components/ui/button/Button.vue'
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

function getBottomRadius(
  nodeShape: RenderShape | undefined,
  corners: 'both' | 'right' = 'both'
): string {
  if (nodeShape === RenderShape.BOX) return ''
  return nodeShape === RenderShape.CARD || corners === 'right'
    ? 'rounded-br-xl'
    : 'rounded-b-xl'
}

const footerRadiusClass = computed(() => getBottomRadius(shape))

const errorRadiusClass = computed(() => getBottomRadius(shape))

const enterRadiusClass = computed(() => getBottomRadius(shape, 'right'))

const tabStyles = 'pointer-events-auto h-11 text-xs font-normal'
const footerWrapperBase = 'isolate -z-1 -mt-5 box-border flex'
const errorWrapperStyles = cn(
  footerWrapperBase,
  '-mx-1 -mb-2 w-[calc(100%+8px)] pb-1'
)

const headerColorStyle = computed(() =>
  headerColor ? { backgroundColor: headerColor } : undefined
)
</script>
