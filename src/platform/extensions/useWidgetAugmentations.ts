import { computed, shallowRef } from 'vue'

import { reportError } from '@comfyorg/telemetry/reportError'
import { useExtensionStore } from '@/platform/extensions/stores/extensionStore'
import type {
  WidgetAugmentation,
  WidgetAugmentationTarget
} from '@/platform/extensions/widgetAugmentation'

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
  const registrations = computed(() =>
    extensions.extensions
      .filter((extension) => extensions.contributes(extension.name))
      .flatMap((extension) =>
        (extension.widgetAugmentations ?? [])
          .filter(
            (augmentation) =>
              augmentation.target.nodeType === nodeType.value &&
              augmentation.target.widgetName === widgetName.value
          )
          .map((augmentation) => ({
            key: `${extension.name}:${augmentation.id}`,
            extension: extension.name,
            augmentation
          }))
      )
  )
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

  return { registrations, contributions, evaluate }
}
