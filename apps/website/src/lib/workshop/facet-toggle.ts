export function toggleIn<T>(selected: readonly T[], value: T): T[] {
  return selected.includes(value)
    ? selected.filter((item) => item !== value)
    : [...selected, value]
}

export function toggleOption<T extends string>(
  options: readonly { readonly value: T }[] | undefined,
  selected: T[],
  value: string
): T[] {
  const option = options?.find((item) => item.value === value)
  return option ? toggleIn(selected, option.value) : selected
}
