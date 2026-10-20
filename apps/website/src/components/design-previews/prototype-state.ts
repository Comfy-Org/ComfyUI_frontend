import type { PrototypeField } from './PrototypeSwitcher.vue'

/** Each field's value from the URL, else the saved choice, else its default. */
export function resolvePrototypeState<K extends string>(
  fields: readonly PrototypeField<K>[],
  defaults: Readonly<Record<K, string>>,
  params: URLSearchParams,
  saved: Partial<Record<K, string>>
): Record<K, string> {
  const isOption = (field: PrototypeField<K>, value: string | undefined) =>
    value !== undefined &&
    field.options.some((option) => option.value === value)
  const pick = (field: PrototypeField<K>) =>
    [params.get(field.key) ?? undefined, saved[field.key]].find((value) =>
      isOption(field, value)
    ) ?? defaults[field.key]
  return Object.fromEntries(
    fields.map((field) => [field.key, pick(field)])
  ) as Record<K, string>
}
