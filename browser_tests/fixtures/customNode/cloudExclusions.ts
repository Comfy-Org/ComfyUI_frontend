import { SYNTH_PRODUCERS } from '@e2e/fixtures/customNode/autoRun'
import type {
  CloudManifestEntry,
  CoreManifestEntry
} from '@e2e/fixtures/customNode/manifest'

type CloudDisabledSemantics = 'vanish' | 'register-but-block'

const CLOUD_DISABLED_SEMANTICS: CloudDisabledSemantics = 'vanish'

export function cloudAutoRunExclusions(
  entry: CloudManifestEntry | CoreManifestEntry,
  semantics: CloudDisabledSemantics = CLOUD_DISABLED_SEMANTICS
): Record<string, string> {
  if (!('disabledNodes' in entry)) return {}
  const disabledCount = Object.keys(entry.disabledNodes).length
  if (disabledCount === 0 || semantics === 'vanish') return {}
  throw new Error(
    `cloud disabled-node semantics 'register-but-block' are not calibrated ` +
      `yet: the Phase-1 probe must show ${entry.pack}'s ${disabledCount} ` +
      `label-disabled node(s) registering in /object_info and how the ` +
      `backend refuses their execution before they can seed expected ` +
      `failures instead of count subtraction`
  )
}

const AUTO_RUN_HARNESS_NODES = [
  ...new Set(
    Object.values(SYNTH_PRODUCERS).map((producer) => producer.nodeType)
  ),
  'PreviewAny'
]

export function disabledHarnessNodes(
  coreDisabledNodes: Record<string, string[]>
): string[] {
  return AUTO_RUN_HARNESS_NODES.filter(
    (nodeType) => nodeType in coreDisabledNodes
  ).map((nodeType) => `${nodeType} (${coreDisabledNodes[nodeType].join(', ')})`)
}
