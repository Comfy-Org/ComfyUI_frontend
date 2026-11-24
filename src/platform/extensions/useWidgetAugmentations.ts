import { computed, shallowRef } from 'vue'

import { reportError } from '@comfyorg/telemetry/reportError'
import { useExtensionStore } from '@/platform/extensions/stores/extensionStore'
import type {
  WidgetAugmentation,
  WidgetAugmentationTarget
} from '@/platform/extensions/widgetAugmentation'

const reportedSelectors = new WeakSet<WidgetAugmentation>()

function matches(
  augmentation: WidgetAugmentation,
  widget: WidgetAugmentationTarget
): boolean {
  const { target } = augmentation
  if (typeof target !== 'function')
    return (
      target.nodeType === widget.nodeType &&
      target.widgetName === widget.widgetName
    )
  try {
    return target(widget)
  } catch (error) {
    if (!reportedSelectors.has(augmentation)) {
      reportedSelectors.add(augmentation)
      reportError(error, {
        errorType: 'error_evaluating_widget_augmentation',
        surface: 'platform',
        context: { augmentation: augmentation.id }
      })
    }
    return false
  }
}

interface Contribution {
  key: string
  extension: string
  augmentation: WidgetAugmentation
}

export function useWidgetAugmentations(
  target: () => WidgetAugmentationTarget | undefined
) {
  const extensions = useExtensionStore()
  const failed = shallowRef(new Set<WidgetAugmentation>())
  const nodeType = computed(() => target()?.nodeType)
  const widgetName = computed(() => target()?.widgetName)
  const widget = computed(() =>
    nodeType.value === undefined || widgetName.value === undefined
      ? undefined
      : { nodeType: nodeType.value, widgetName: widgetName.value }
  )
  const registrations = computed(() => {
    const current = widget.value
    if (!current) return []
    return extensions.extensions
      .filter((extension) => extensions.contributes(extension.name))
      .flatMap((extension) =>
        extensions
          .getWidgetAugmentations(extension)
          .filter((augmentation) => matches(augmentation, current))
          .map((augmentation) => ({
            key: `${extension.name}:${augmentation.id}`,
            extension: extension.name,
            augmentation
          }))
      )
  })
  const contributions = computed(() =>
    registrations.value.filter((item) => !failed.value.has(item.augmentation))
  )

  function evaluate<T>(
    contribution: Contribution,
    read: () => T
  ): T | undefined {
    if (
      !contributions.value.some(
        (item) =>
          item.extension === contribution.extension &&
          item.augmentation === contribution.augmentation
      )
    )
      return undefined
    try {
      return read()
    } catch (error) {
      failed.value = new Set([...failed.value, contribution.augmentation])
      reportError(error, {
        errorType: 'error_evaluating_widget_augmentation',
        surface: 'platform',
        context: {
          extension: contribution.extension,
          augmentation: contribution.augmentation.id
        }
      })
    }
  }

  return { widget, registrations, contributions, evaluate }
}
