export interface DeprecationEntry {
  /** Category/origin shown in the console tag and docs, e.g. 'widgetInputs'. */
  source: string
  /** Static description of what is deprecated. */
  message: string
  /** What to do instead. */
  suggestion?: string
  /** Version the deprecation was introduced, e.g. '1.40'. */
  since?: string
  /** Version the deprecated API is expected to be removed, e.g. '2.0'. */
  removeBy?: string
  /** Link to a migration guide or docs page for this deprecation. */
  docsUrl?: string
}

/**
 * Single source of truth for every known frontend deprecation, used both at
 * runtime (call sites reference entries by id via `warnDeprecated`) and
 * statically (the docs generator in `scripts/generate-deprecations-doc.ts`).
 */
export const DEPRECATIONS = {
  'nodeDef.defaultInputRequired': {
    source: 'nodeDef',
    message: 'Use of defaultInput on a required input.',
    suggestion:
      'Drop the defaultInput option — required sockets are always present.'
  },
  'nodeDef.defaultInputOptional': {
    source: 'nodeDef',
    message: 'Use of defaultInput on an optional input.',
    suggestion: 'Replace with forceInput.'
  },
  'litegraphService.setSizeForImage': {
    source: 'litegraphService',
    message: 'node.setSizeForImage is deprecated and has no effect.',
    suggestion: 'Remove the call.'
  },
  'maskEditor.openMaskEditor': {
    source: 'MaskEditor',
    message: 'ComfyApp.open_maskeditor is deprecated.',
    suggestion:
      'Migrate to the command system or direct node context menu integration.'
  },
  'widgetInputs.convertToInput': {
    source: 'widgetInputs',
    message: 'convertToInput is no longer necessary.',
    suggestion:
      'Remove the call — widgets and sockets now co-exist on each input.'
  },
  'widgetInputs.convertWidgetToInput': {
    source: 'widgetInputs',
    message: 'convertWidgetToInput is no longer necessary.',
    suggestion:
      'Remove the call — widgets and sockets now co-exist on each input.'
  },
  'changeTracker.checkState': {
    source: 'ChangeTracker',
    message: 'ChangeTracker.checkState() is deprecated.',
    suggestion: 'Call captureCanvasState() instead.'
  },
  'comfyUI.legacyQueueMenu': {
    source: 'ComfyUI',
    message: 'The legacy queue/history menu is deprecated and unsupported.',
    suggestion:
      'Switch to the new menu: Settings → search "Use new menu" → change from "Disabled" to "Top".'
  },
  'comfySettings.getSettingValueDefault': {
    source: 'ComfySettingsDialog',
    message: 'getSettingValue() defaultValue parameter is deprecated.',
    suggestion:
      'Drop the argument — the default value in the setting definition will be used.'
  },
  'widget.inputEl': {
    source: 'widget',
    message: 'widget.inputEl is deprecated.',
    suggestion: 'Use widget.element instead (renamed in PR #8594).'
  },
  'litegraph.comboValuesFunction': {
    source: 'litegraph',
    message: 'Using a function for combo values is deprecated.',
    suggestion: 'Use an array of unique values instead.'
  },
  'litegraph.captureInput': {
    source: 'litegraph',
    message: 'captureInput will be removed in a future version.',
    suggestion: 'Use LGraphCanvas.pointer (CanvasPointer) instead.'
  },
  'litegraph.contextMenuMonkeyPatch': {
    source: 'litegraph',
    message: 'Monkey-patching context menu methods is deprecated.',
    suggestion: 'Use the new context menu API instead.',
    docsUrl: 'https://docs.comfy.org/custom-nodes/js/context-menu-migration'
  },
  'litegraph.onDeprecationWarning': {
    source: 'litegraph',
    message:
      'LiteGraph.onDeprecationWarning is no longer used and has no effect.',
    suggestion:
      'Remove the listener — there is no programmatic replacement; deprecation warnings now appear in the Dev Mode "Deprecation Warnings" sidebar panel.'
  }
} satisfies Record<string, DeprecationEntry>

export type DeprecationId = keyof typeof DEPRECATIONS

/**
 * Builds the styled `console.warn` arguments shared by every deprecation
 * warning: a bold `[DEPRECATED:<source>]` tag and message, followed by labelled
 * lines for whichever fields are present, in a uniform order. Returns the args
 * tuple to spread into `console.warn`.
 */
export function formatDeprecationConsole(input: {
  source?: string
  message: string
  suggestion?: string
  extension?: string
  detail?: string
  docsUrl?: string
}): [string, string, string] {
  const tag = input.source ? `[DEPRECATED:${input.source}]` : '[DEPRECATED]'
  const lines = [`%c${tag}%c ${input.message}`]
  if (input.extension) lines.push(`  extension: ${input.extension}`)
  if (input.detail) lines.push(`  detail: ${input.detail}`)
  if (input.suggestion) lines.push(`  fix: ${input.suggestion}`)
  if (input.docsUrl) lines.push(`  docs: ${input.docsUrl}`)
  return [
    lines.join('\n'),
    'color: orange; font-weight: bold',
    'color: inherit'
  ]
}
