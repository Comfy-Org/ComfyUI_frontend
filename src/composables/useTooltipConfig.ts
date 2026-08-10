/**
 * Build a tooltip configuration object compatible with v-tooltip.
 * Consumers pass the translated text value.
 */
export const buildTooltipConfig = (value: string) => ({
  value,
  showDelay: 300,
  hideDelay: 0,
  pt: {
    text: {
      class:
        'border-node-component-tooltip-border bg-node-component-tooltip-surface text-node-component-tooltip border rounded-md px-2 py-1 text-xs leading-none shadow-none'
    },
    arrow: {
      class: 'border-t-node-component-tooltip-border'
    }
  }
})

export const buildAgentTooltipConfig = (value: string) => ({
  ...buildTooltipConfig(value),
  pt: {
    text: {
      class:
        'rounded-lg bg-[#171717] px-3 py-1.5 font-inter text-xs leading-4 text-[#fafafa] shadow-none ring-1 ring-inset ring-charcoal-200'
    },
    arrow: {
      class: 'hidden'
    }
  }
})
