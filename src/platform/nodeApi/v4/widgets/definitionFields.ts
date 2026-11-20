import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import { checkedBoolean } from '@/platform/nodeApi/v4/edit/checkedArguments'

export function requiredName(
  member: string,
  field: string,
  name: unknown
): string {
  if (typeof name !== 'string' || !name) {
    throw invalidArgument(member, `${field} as a non-empty string`, name)
  }
  return name
}

export function optionalFlag(
  member: string,
  field: string,
  value: unknown
): boolean | undefined {
  return value === undefined ? value : checkedBoolean(member, field, value)
}

export function requiredSize(
  member: string,
  field: string,
  value: unknown
): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw invalidArgument(
      member,
      `${field} as a finite size of 0 or more`,
      value
    )
  }
  return value
}

export function optionalSize(
  member: string,
  field: string,
  value: unknown
): number | undefined {
  return value === undefined ? value : requiredSize(member, field, value)
}
