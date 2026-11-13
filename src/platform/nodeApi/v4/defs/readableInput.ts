import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'

/** Checks a value a pack passed; one whose own reads throw, as a hostile Proxy's do, is refused as unusable. */
export function checkedReadable<T>(
  member: string,
  needed: string,
  value: unknown,
  check: (value: unknown) => T
): T {
  try {
    return check(value)
  } catch (error) {
    if (error instanceof TypeError) throw error
    throw invalidArgument(member, needed, value)
  }
}
