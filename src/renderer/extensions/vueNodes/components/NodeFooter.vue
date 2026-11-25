<template>
  <div
    v-if="isSubgraph && hasAnyError && showErrorsTabEnabled"
    data-part="node-footer"
    :class="errorWrapperStyles"
  >
    <Button
      variant="textonly"
      :class="
        cn(
          tabStyles,
          'z-10 box-border w-1/2 rounded-none pt-9 pb-3',
          errorColorClass,
          errorRadiusClass
        )
      "
      @pointerup="snapshotDragOnPointerUp"
      @click.stop="emitIfNotDragged('openErrors')"
    >
      <span class="truncate">{{ errorLabel }}</span>
      <i class="icon-[lucide--info]" />
    </Button>

    <Button
      variant="textonly"
      data-testid="subgraph-enter-button"
      :class="
        cn(
          tabStyles,
          '-ml-5 box-border w-[calc(50%+20px)] rounded-none bg-node-header pt-9 pb-3 pl-5 text-inherit',
          enterRadiusClass
        )
      "
      :style="headerColorStyle"
      @pointerup="snapshotDragOnPointerUp"
      @click.stop="emitIfNotDragged('enterSubgraph')"
    >
      <span class="truncate">{{ t('g.enter') }}</span>
      <i class="icon-[comfy--workflow]" />
    </Button>
  </div>

  <div
    v-else-if="
      !isSubgraph &&
      hasAnyError &&
      showErrorsTabEnabled &&
      (showAdvancedInputsButton || showAdvancedState)
    "
    data-part="node-footer"
    :class="errorWrapperStyles"
  >
    <Button
      variant="textonly"
      :class="
        cn(
          tabStyles,
          'z-10 box-border w-1/2 rounded-none pt-9 pb-3',
          errorColorClass,
          errorRadiusClass
        )
      "
      @pointerup="snapshotDragOnPointerUp"
      @click.stop="emitIfNotDragged('openErrors')"
    >
      <span class="truncate">{{ errorLabel }}</span>
      <i class="icon-[lucide--info]" />
    </Button>

    <Button
      variant="textonly"
      data-testid="advanced-inputs-button"
      :class="
        cn(
          tabStyles,
          '-ml-5 box-border w-[calc(50%+20px)] rounded-none bg-node-header pt-9 pb-3 pl-5 text-inherit',
          enterRadiusClass
        )
      "
      :style="headerColorStyle"
      @pointerup="snapshotDragOnPointerUp"
      @click.stop="emitIfNotDragged('toggleAdvanced')"
    >
      <span class="truncate">{{
        showAdvancedState
          ? t('rightSidePanel.hideAdvancedShort')
          : t('rightSidePanel.showAdvancedShort')
      }}</span>
      <i
        :class="
          showAdvancedState
            ? 'icon-[lucide--chevron-up]'
            : 'icon-[lucide--settings-2]'
        "
      />
    </Button>
  </div>

  <div
    v-else-if="hasAnyError && showErrorsTabEnabled"
    data-part="node-footer"
    :class="errorWrapperStyles"
  >
    <Button
      variant="textonly"
      :class="
        cn(
          tabStyles,
          'box-border w-full rounded-none pt-9 pb-3',
          errorColorClass,
          footerRadiusClass
        )
      "
      @pointerup="snapshotDragOnPointerUp"
      @click.stop="emitIfNotDragged('openErrors')"
    >
      <span class="truncate">{{ errorLabel }}</span>
      <i class="icon-[lucide--info]" />
    </Button>
  </div>

  <Button
    v-else-if="isSubgraph"
    variant="textonly"
    data-testid="subgraph-enter-button"
    data-part="node-footer"
    :class="
      cn(
        footerWrapperBase,
        tabStyles,
        'box-border w-full rounded-none bg-node-header text-inherit',
        hasAnyError && '-mx-1 -mb-1 w-[calc(100%+8px)]',
        hasAnyError ? 'pt-9 pb-3' : 'pt-8 pb-3',
        footerRadiusClass
      )
    "
    :style="headerColorStyle"
    @pointerup="snapshotDragOnPointerUp"
    @click.stop="emitIfNotDragged('enterSubgraph')"
  >
    <span class="truncate">{{ t('g.enterSubgraph') }}</span>
    <i class="icon-[comfy--workflow]" />
  </Button>

  <Button
    v-else-if="showAdvancedInputsButton || showAdvancedState"
    variant="textonly"
    data-testid="advanced-inputs-button"
    data-part="node-footer"
    :class="
      cn(
        footerWrapperBase,
        tabStyles,
        'box-border w-full rounded-none bg-node-header text-inherit',
        hasAnyError && '-mx-1 -mb-1 w-[calc(100%+8px)]',
        hasAnyError ? 'pt-9 pb-3' : 'pt-8 pb-3',
        footerRadiusClass
      )
    "
    :style="headerColorStyle"
    @pointerup="snapshotDragOnPointerUp"
    @click.stop="emitIfNotDragged('toggleAdvanced')"
  >
    <template v-if="showAdvancedState">
      <span class="truncate">{{
        t('rightSidePanel.hideAdvancedInputsButton')
      }}</span>
      <i class="icon-[lucide--chevron-up]" />
    </template>
    <template v-else>
      <span class="truncate">{{
        t('rightSidePanel.showAdvancedInputsButton')
      }}</span>
      <i class="icon-[lucide--settings-2]" />
    </template>
  </Button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from '@comfyorg/design-system/button/Button'
import { RenderShape } from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { cn } from '@comfyorg/tailwind-utils'

const { t } = useI18n()

interface Props {
  isSubgraph: boolean
  errorSeverity: 'none' | 'missing' | 'error'
  showErrorsTabEnabled: boolean
  showAdvancedInputsButton?: boolean
  showAdvancedState?: boolean
  headerColor?: string
  shape?: RenderShape
}

const {
  isSubgraph,
  errorSeverity,
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

const hasAnyError = computed(() => errorSeverity !== 'none')
const errorLabel = computed(() =>
  t(errorSeverity === 'missing' ? 'rightSidePanel.errors' : 'g.error')
)
const errorColorClass = computed(() =>
  errorSeverity === 'missing'
    ? 'bg-warning text-warning-foreground hover:bg-warning/90'
    : 'bg-destructive text-white hover:bg-destructive/90'
)

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
    ? 'rounded-br-(--node-radius)'
    : 'rounded-b-(--node-radius)'
}

const footerRadiusClass = computed(() => getBottomRadius(shape))

const errorRadiusClass = computed(() => getBottomRadius(shape))

const enterRadiusClass = computed(() => getBottomRadius(shape, 'right'))

const tabStyles = 'pointer-events-auto h-11 font-normal'
const footerWrapperBase = 'isolate -z-1 -mt-5 box-border flex'
const errorWrapperStyles = cn(
  footerWrapperBase,
  '-mx-1 -mb-2 w-[calc(100%+8px)] pb-1'
)

const headerColorStyle = computed(() =>
  headerColor ? { backgroundColor: headerColor } : undefined
)
</script>
