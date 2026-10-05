import { cn } from '@comfyorg/tailwind-utils'

export const TOOLTIP_TEXT_CLASS =
  'border-node-component-tooltip-border bg-node-component-tooltip-surface text-node-component-tooltip border rounded-md px-2 py-1 text-xs leading-none shadow-none'

export const TOOLTIP_ARROW_PT = ({
  context: { top, right, bottom, left }
}: {
  context: Partial<Record<'top' | 'right' | 'bottom' | 'left', boolean>>
}) => ({
  class: cn(
    top && 'border-t-node-component-tooltip-border',
    bottom && 'border-b-node-component-tooltip-border',
    left && 'border-l-node-component-tooltip-border',
    (right || !(top || bottom || left)) &&
      'border-r-node-component-tooltip-border'
  )
})

/**
 * Build a tooltip configuration object compatible with v-tooltip.
 * Consumers pass the translated text value.
 */
export const buildTooltipConfig = (value: string) => ({
  value,
  showDelay: 300,
  hideDelay: 0,
  pt: {
    text: { class: TOOLTIP_TEXT_CLASS },
    arrow: TOOLTIP_ARROW_PT
  }
})
