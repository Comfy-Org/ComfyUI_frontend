<template>
  <!-- Case 1: Subgraph + Error (Dual Tabs) -->
  <template v-if="isSubgraph && hasAnyError && showErrorsTabEnabled">
    <Button
      variant="textonly"
      :class="
        cn(
          getTabStyles(false),
          errorTabWidth,
          '-z-5 bg-destructive-background hover:bg-destructive-background-hover text-white'
        )
      "
      @click.stop="$emit('openErrors')"
    >
      <div class="flex items-center justify-center gap-2 w-full h-full">
        <span class="truncate">{{ t('g.error') }}</span>
        <i class="icon-[lucide--info] size-4 shrink-0" />
      </div>
    </Button>

    <Button
      variant="textonly"
      data-testid="subgraph-enter-button"
      :class="
        cn(
          getTabStyles(true),
          enterTabFullWidth,
          '-z-10 bg-node-component-header-surface'
        )
      "
      :style="{ backgroundColor: headerColor }"
      @click.stop="$emit('enterSubgraph')"
    >
      <div class="flex items-center justify-center gap-2 w-1/2 ml-auto h-full">
        <span class="truncate">{{ t('g.enter') }}</span>
        <i class="icon-[comfy--workflow] size-4 shrink-0" />
      </div>
    </Button>
  </template>

  <!-- Case 2: Error Only (Full Width) -->
  <template v-else-if="hasAnyError && showErrorsTabEnabled">
    <Button
      variant="textonly"
      :class="
        cn(
          getTabStyles(false),
          enterTabFullWidth,
          '-z-5 bg-destructive-background hover:bg-destructive-background-hover text-white'
        )
      "
      @click.stop="$emit('openErrors')"
    >
      <div class="flex items-center justify-center gap-2 w-full h-full">
        <span class="truncate">{{ t('g.error') }}</span>
        <i class="icon-[lucide--info] size-4 shrink-0" />
      </div>
    </Button>
  </template>

  <!-- Case 3: Subgraph only (Full Width) -->
  <template v-else-if="isSubgraph">
    <Button
      variant="textonly"
      data-testid="subgraph-enter-button"
      :class="
        cn(
          getTabStyles(true),
          hasAnyError ? 'w-[calc(100%+8px)]' : 'w-full',
          '-z-10 bg-node-component-header-surface'
        )
      "
      :style="{ backgroundColor: headerColor }"
      @click.stop="$emit('enterSubgraph')"
    >
      <div class="flex items-center justify-center gap-2 w-full h-full">
        <span class="truncate">{{ t('g.enterSubgraph') }}</span>
        <i class="icon-[comfy--workflow] size-4 shrink-0" />
      </div>
    </Button>
  </template>

  <!-- Case 4: Advanced Footer (Regular Nodes) -->
  <div
    v-else-if="showAdvancedInputsButton || showAdvancedState"
    class="flex w-full h-7 rounded-b-2xl -z-1 text-xs rounded-t-none overflow-hidden divide-x divide-component-node-border relative -mt-5"
  >
    <Button
      variant="textonly"
      :class="
        cn('flex-1 rounded-none h-full', isCollapsed ? 'py-2' : 'pt-7 pb-2')
      "
      @click.stop="$emit('toggleAdvanced')"
    >
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
    </Button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from '@/components/ui/button/Button.vue'
import { RenderShape } from '@/lib/litegraph/src/litegraph'
import { cn } from '@/utils/tailwindUtil'

const { t } = useI18n()

interface Props {
  isSubgraph: boolean
  hasAnyError: boolean
  showErrorsTabEnabled: boolean
  isCollapsed: boolean
  showAdvancedInputsButton?: boolean
  showAdvancedState?: boolean
  headerColor?: string
  shape?: RenderShape
}

const props = defineProps<Props>()

defineEmits<{
  (e: 'enterSubgraph'): void
  (e: 'openErrors'): void
  (e: 'toggleAdvanced'): void
}>()

const footerRadiusClass = computed(() => {
  const isExpanded = props.hasAnyError

  switch (props.shape) {
    case RenderShape.BOX:
      return 'rounded-none'
    case RenderShape.CARD:
      return isExpanded
        ? 'rounded-bl-none rounded-br-[20px]'
        : 'rounded-bl-none rounded-br-2xl'
    default:
      return isExpanded ? 'rounded-b-[20px]' : 'rounded-b-2xl'
  }
})

/**
 * Returns shared size/position classes for footer tabs
 * @param isBackground If true, calculates styles for the background/right tab (Enter Subgraph)
 */
const getTabStyles = (isBackground = false) => {
  let sizeClasses = ''
  if (props.isCollapsed) {
    let pt = 'pt-10'
    if (isBackground) {
      pt = props.hasAnyError ? 'pt-10.5' : 'pt-9'
    }
    sizeClasses = cn('h-15 -mt-7.5', pt)
  } else {
    let pt = 'pt-12.5'
    if (isBackground) {
      pt = props.hasAnyError ? 'pt-12.5' : 'pt-11.5'
    }
    sizeClasses = cn('h-17.5 -mt-10', pt)
  }

  return cn(
    'absolute top-full left-0 text-xs',
    footerRadiusClass.value,
    sizeClasses,
    props.hasAnyError ? '-translate-x-1 translate-y-0.5' : 'translate-y-0.5'
  )
}

// Case 1 context: Split widths
const errorTabWidth = 'w-[calc(50%+4px)]'
const enterTabFullWidth = 'w-[calc(100%+8px)]'
</script>
