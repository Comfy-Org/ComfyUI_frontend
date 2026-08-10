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

export const AGENT_TOOLTIP_SHOW_DELAY = 300

export const AGENT_REKA_TOOLTIP_PROVIDER_PROPS = {
  delayDuration: AGENT_TOOLTIP_SHOW_DELAY,
  skipDelayDuration: 0,
  disableHoverableContent: true
} as const

export const AGENT_TOOLTIP_SURFACE_CLASS =
  'rounded-lg bg-[#171717] px-3 py-1.5 font-inter text-xs leading-4 text-[#fafafa] shadow-none ring-1 ring-inset ring-charcoal-200'

export const AGENT_REKA_TOOLTIP_CONTENT_CLASS =
  `z-1700 w-max whitespace-nowrap will-change-opacity ${AGENT_TOOLTIP_SURFACE_CLASS} ` +
  'data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:duration-[250ms] data-[state=delayed-open]:ease-linear ' +
  'data-[state=instant-open]:animate-in data-[state=instant-open]:fade-in-0 data-[state=instant-open]:duration-[250ms] data-[state=instant-open]:ease-linear'

export const buildAgentTooltipConfig = (value: string) => ({
  ...buildTooltipConfig(value),
  showDelay: AGENT_TOOLTIP_SHOW_DELAY,
  pt: {
    text: {
      class: AGENT_TOOLTIP_SURFACE_CLASS
    },
    arrow: {
      class: 'hidden'
    }
  }
})
