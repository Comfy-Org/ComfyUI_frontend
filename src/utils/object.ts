export function omitBy<T extends object>(obj: T, predicate: (value: any) => boolean): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_key, value]) => !predicate(value)),
  ) as Partial<T>
}
