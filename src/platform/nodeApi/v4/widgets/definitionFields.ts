import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'

export function requiredName(member: string, name: unknown): string {
  if (typeof name !== 'string' || !name) {
    throw invalidArgument(member, 'a name', name)
  }
  return name
}

export function requiredFlag(member: string, value: unknown): boolean {
  if (typeof value !== 'boolean') {
    throw invalidArgument(member, 'true or false', value)
  }
  return value
}

export function optionalFlag(
  member: string,
  value: unknown
): boolean | undefined {
  return value === undefined ? value : requiredFlag(member, value)
}

export function requiredSize(member: string, value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw invalidArgument(member, 'a finite size of 0 or more', value)
  }
  return value
}

export function optionalSize(
  member: string,
  value: unknown
): number | undefined {
  return value === undefined ? value : requiredSize(member, value)
}
