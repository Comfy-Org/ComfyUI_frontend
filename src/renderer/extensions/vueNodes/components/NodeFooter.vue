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
      @click.stop="$emit('openErrors')"
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
      @click.stop="$emit('enterSubgraph')"
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
      @click.stop="$emit('openErrors')"
    >
      <div class="flex size-full items-center justify-center gap-2">
        <span class="truncate">{{ t('g.error') }}</span>
        <i class="icon-[lucide--info] size-4 shrink-0" />
      </div>
    </Button>

    <Button
      variant="textonly"
      :class="
        cn(
          tabStyles,
          '-ml-5 box-border w-[calc(50%+20px)] rounded-none bg-node-component-header-surface pt-9 pb-4 pl-5',
          enterRadiusClass
        )
      "
      :style="headerColorStyle"
      @click.stop="$emit('toggleAdvanced')"
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
          'box-border w-full rounded-none bg-destructive-background pt-9 pb-4 text-white hover:bg-destructive-background-hover',
          footerRadiusClass
        )
      "
      @click.stop="$emit('openErrors')"
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
      @click.stop="$emit('enterSubgraph')"
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
      :class="
        cn(
          tabStyles,
          'box-border w-full rounded-none bg-node-component-header-surface',
          hasAnyError ? 'pt-9 pb-4' : 'pt-8 pb-4',
          footerRadiusClass
        )
      "
      :style="headerColorStyle"
      @click.stop="$emit('toggleAdvanced')"
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
import { cn } from '@/utils/tailwindUtil'

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

defineEmits<{
  enterSubgraph: []
  openErrors: []
  toggleAdvanced: []
}>()

const RADIUS_CLASS = {
  'rounded-b-17': 'rounded-b-[17px]',
  'rounded-b-20': 'rounded-b-[20px]',
  'rounded-br-17': 'rounded-br-[17px]',
  'rounded-br-20': 'rounded-br-[20px]'
} as const

function getBottomRadius(
  nodeShape: RenderShape | undefined,
  size: '17px' | '20px',
  corners: 'both' | 'right' = 'both'
): string {
  if (nodeShape === RenderShape.BOX) return ''
  const prefix =
    nodeShape === RenderShape.CARD || corners === 'right'
      ? 'rounded-br'
      : 'rounded-b'
  const key =
    `${prefix}-${size === '17px' ? '17' : '20'}` as keyof typeof RADIUS_CLASS
  return RADIUS_CLASS[key]
}

const footerRadiusClass = computed(() =>
  getBottomRadius(shape, hasAnyError ? '20px' : '17px')
)

const errorRadiusClass = computed(() => getBottomRadius(shape, '20px'))

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
