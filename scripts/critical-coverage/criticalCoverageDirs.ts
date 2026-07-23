export const CRITICAL_COVERAGE_DIRS = [
  'src/base',
  'src/composables',
  'src/core',
  'src/lib/litegraph/src/node',
  'src/lib/litegraph/src/subgraph',
  'src/lib/litegraph/src/utils',
  'src/platform/assets/composables',
  'src/platform/assets/mappings',
  'src/platform/assets/schemas',
  'src/platform/assets/services',
  'src/platform/assets/utils',
  'src/platform/errorCatalog',
  'src/platform/keybindings',
  'src/platform/missingMedia',
  'src/platform/missingModel',
  'src/platform/navigation',
  'src/platform/nodeReplacement',
  'src/platform/remote',
  'src/platform/remoteConfig',
  'src/platform/secrets',
  'src/platform/settings',
  'src/platform/workflow',
  'src/platform/workspace/api',
  'src/platform/workspace/auth',
  'src/platform/workspace/composables',
  'src/platform/workspace/stores',
  'src/platform/workspace/utils',
  'src/schemas',
  'src/scripts',
  'src/services',
  'src/stores',
  'src/utils',
  'src/workbench/extensions/manager/composables',
  'src/workbench/extensions/manager/services',
  'src/workbench/extensions/manager/stores',
  'src/workbench/extensions/manager/utils',
  'src/workbench/utils'
] as const

export function isCriticalCoveragePath(filePath: string): boolean {
  return CRITICAL_COVERAGE_DIRS.some(
    (dir) => filePath === dir || filePath.startsWith(`${dir}/`)
  )
}
