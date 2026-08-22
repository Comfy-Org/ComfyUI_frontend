import { randomUUID } from 'node:crypto'

const TEST_RUN_ID = randomUUID().replaceAll('-', '').slice(0, 12)

export function createdUserId(value: unknown): string {
  if (typeof value !== 'string' || value === '')
    throw new Error('Failed to create user: response carried no user ID')
  return value
}

export function testUsername(prefix: string, parallelIndex: number): string {
  return `${prefix}-${TEST_RUN_ID}-${parallelIndex}`
}
