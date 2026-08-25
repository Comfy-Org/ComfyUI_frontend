export interface CheckResult {
  name: string
  ok: boolean
  version?: string
  optional?: boolean
  installInstructions?: string[]
}
