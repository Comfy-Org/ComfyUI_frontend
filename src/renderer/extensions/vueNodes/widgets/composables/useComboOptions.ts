import { countBy } from 'es-toolkit'
import { computed, ref, toRef } from 'vue'
import type { Ref } from 'vue'

import type { WidgetValue } from '@comfyorg/graph-model/widgetValue'
import type { IWidgetOptions } from '@comfyorg/graph-model/widgets'

interface ComboOption {
  kind: 'value'
  key: string
  label: string
  rawValue: NonNullable<WidgetValue>
  value: string
}

interface ComboFolder {
  kind: 'folder' | 'back'
  key: string
  label: string
  directory: string[]
}

export type ComboItem = ComboOption | ComboFolder

export function useComboOptions(
  getOptions: () => IWidgetOptions | undefined,
  value: Ref<WidgetValue>,
  config: {
    filenameSummary: () => boolean
    lockedDirectory: Ref<string[] | undefined>
  }
) {
  const options = toRef(getOptions)
  const searchQuery = ref('')
  const directory = ref<string[]>([])
  const revision = ref(0)
  const normalized = computed(() => {
    void revision.value
    return resolveOptions(options.value)
  })
  const dynamicOptions = computed(
    () => typeof options.value?.values === 'function'
  )
  const hasFolders = computed(
    () =>
      !options.value?.getOptionLabel &&
      normalized.value.some((option) => fileParts(option.value))
  )
  const isFilterable = computed(
    () =>
      hasFolders.value ||
      Boolean(config.lockedDirectory.value) ||
      normalized.value.length > 4
  )
  const selectedValue = computed(() =>
    value.value == null ? undefined : String(value.value)
  )
  const selectedOption = computed(() =>
    normalized.value.find((option) => option.value === selectedValue.value)
  )
  const selection = computed(() => {
    const option = selectedOption.value
    const invalid =
      options.value?.values !== undefined &&
      Boolean(selectedValue.value) &&
      !option
    const label = option ? option.label : invalid ? String(value.value) : ''
    return {
      option,
      invalid,
      summary:
        config.filenameSummary() && !options.value?.getOptionLabel
          ? label.split(/[/\\]/).at(-1)
          : label
    }
  })
  const longestLabel = computed(() =>
    normalized.value.reduce(
      (longest, { label }) => (label.length > longest.length ? label : longest),
      ''
    )
  )
  const scoped = computed(() => {
    const lock = config.lockedDirectory.value
    return lock
      ? normalized.value.filter((option) => isInDirectory(option.value, lock))
      : normalized.value
  })
  const adjacentOptions = computed(() => {
    const selected = selection.value.option
    const index = selected ? scoped.value.indexOf(selected) : -1
    return {
      [-1]: scoped.value[(index < 0 ? scoped.value.length : index) - 1],
      [1]: scoped.value[index + 1]
    }
  })
  const openingDirectory = computed(() => {
    const selected = selection.value.option?.value ?? ''
    const lock = config.lockedDirectory.value
    return lock && !isInDirectory(selected, lock)
      ? [...lock]
      : hasFolders.value
        ? (fileParts(selected)?.slice(0, -1) ?? [])
        : []
  })
  const browseOptions = computed(() => {
    const query = searchQuery.value.trim().toLocaleLowerCase()
    if (!hasFolders.value || query)
      return isFilterable.value && query
        ? scoped.value.filter(
            (option) =>
              option.value.toLocaleLowerCase().includes(query) ||
              option.label.toLocaleLowerCase().includes(query)
          )
        : scoped.value
    return getComboFolderRows(
      scoped.value,
      directory.value,
      config.lockedDirectory.value?.length ?? 0
    )
  })
  function refreshOptions() {
    revision.value++
  }
  return {
    searchQuery,
    directory,
    dynamicOptions,
    hasFolders,
    isFilterable,
    selection,
    longestLabel,
    adjacentOptions,
    openingDirectory,
    browseOptions,
    refreshOptions
  }
}

export function resolveComboValues(
  values: unknown
): NonNullable<WidgetValue>[] {
  try {
    const resolved = typeof values === 'function' ? values() : values
    return Array.isArray(resolved)
      ? resolved.filter((value) => value != null).map(toWidgetValue)
      : []
  } catch (error) {
    console.error('[WidgetSelectDefault] Failed to resolve options', error)
    return []
  }
}

function resolveOptions(options: IWidgetOptions | undefined): ComboOption[] {
  return resolveComboValues(options?.values).map((rawValue) => {
    const value = String(rawValue)
    return {
      kind: 'value',
      key: `value:${value}`,
      value,
      rawValue,
      label: getOptionLabel(value, options?.getOptionLabel)
    }
  })
}

function toWidgetValue(value: unknown): NonNullable<WidgetValue> {
  return typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    (typeof value === 'object' && value !== null)
    ? value
    : String(value)
}

function getOptionLabel(
  value: string,
  labeler: IWidgetOptions['getOptionLabel']
) {
  try {
    return labeler?.(value) || value
  } catch (error) {
    console.error('[WidgetSelectDefault] Failed to map option label', error)
    return value
  }
}

function fileParts(value: string) {
  return /[/\\][^/\\]+\.[a-z][a-z0-9]{0,15}$/i.test(value)
    ? value.split(/[/\\]/).filter(Boolean)
    : undefined
}

function isInDirectory(value: string, path: string[]) {
  const parts = fileParts(value)
  return (
    parts !== undefined &&
    path.length < parts.length &&
    path.every((part, index) => parts[index] === part)
  )
}

function getComboFolderRows(
  options: ComboOption[],
  directory: string[],
  rootDepth: number
): (ComboOption | ComboFolder)[] {
  const children = new Map<string, ComboFolder>()
  const files: ComboOption[] = []
  for (const option of options) {
    const parts = fileParts(option.value) ?? [option.value]
    if (!directory.every((part, index) => parts[index] === part)) continue
    const label = parts.at(directory.length)
    if (label === undefined) continue
    if (parts.length === directory.length + 1) {
      files.push({ ...option, label })
    } else if (!children.has(label)) {
      const path = [...directory, label]
      children.set(label, {
        kind: 'folder',
        key: `folder:${path.join('/')}`,
        label,
        directory: path
      })
    }
  }
  const labelCounts = countBy(files, (option) => option.label)
  return [
    ...(directory.length > rootDepth
      ? [
          {
            kind: 'back' as const,
            key: 'back',
            label: directory.join(' / '),
            directory: directory.slice(0, -1)
          }
        ]
      : []),
    ...children.values(),
    ...files.map((option) =>
      labelCounts[option.label] > 1
        ? { ...option, label: option.value }
        : option
    )
  ]
}
