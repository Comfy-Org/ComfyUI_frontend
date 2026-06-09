import { useSettingStore } from '@/platform/settings/settingStore'

const DEFAULT_SHOW_DELAY = 300

const TOOLTIP_PT = {
  text: {
    class:
      'border-node-component-tooltip-border bg-node-component-tooltip-surface text-node-component-tooltip border rounded-md px-2 py-1 text-xs leading-none shadow-none'
  },
  arrow: {
    class: 'border-t-node-component-tooltip-border'
  }
}

/**
 * Build a tooltip configuration object compatible with v-tooltip.
 * Consumers pass the translated text value. Pass `useGlobalDelay` to honor the
 * `LiteGraph.Node.TooltipDelay` setting.
 */
export const buildTooltipConfig = (value: string, useGlobalDelay = false) => ({
  value,
  showDelay: useGlobalDelay
    ? useSettingStore().get('LiteGraph.Node.TooltipDelay')
    : DEFAULT_SHOW_DELAY,
  hideDelay: 0,
  pt: TOOLTIP_PT
})
