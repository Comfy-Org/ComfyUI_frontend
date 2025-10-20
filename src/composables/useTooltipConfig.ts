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
        'border bg-[var(--color-charcoal-800)] border-[var(--color-slate-300)] rounded-md px-2 py-1 text-xs leading-none shadow-none'
    },
    arrow: {
      class: 'border-t-[var(--color-slate-300)]'
    }
  }
})
