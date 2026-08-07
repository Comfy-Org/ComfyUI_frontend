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

// Ledgers are shared across environments; a pack's pin is not. A ledgered node
// can be absent from an env's registered keys without the entry having rotted:
// the env label-disables it (those vanish from /object_info under
// CLOUD_DISABLED_SEMANTICS), or the env's pin predates the node. Only the
// second needs declaring - the first is already in the manifest row - and both
// are skipped so the staleness guards do not force every ledger to fork per
// environment. Anything else absent still fires.
const PIN_SKEWED_LEDGER_NODES: Record<string, string> = {
  'ComfyUI-KJNodes.ContextWindowsVisualizerKJ':
    'added to KJNodes on 2026-06-17; the cloud deployRef 377ed49f predates it, while the core pin e27a505b ships it and still needs its mount-widget entry'
}

export function stalenessCheckedKeys(
  entry: CloudManifestEntry | CoreManifestEntry,
  ledger: Record<string, unknown>
): string[] {
  const disabled = 'disabledNodes' in entry ? entry.disabledNodes : {}
  return Object.keys(ledger).filter((key) => {
    const qualifiedKey = `${entry.pack}.${key}`
    const pinSkewed =
      'disabledNodes' in entry &&
      Object.keys(PIN_SKEWED_LEDGER_NODES).some(
        (node) => qualifiedKey === node || qualifiedKey.startsWith(`${node}.`)
      )
    return (
      !(key in disabled) &&
      !Object.keys(disabled).some((node) => key.startsWith(`${node}.`)) &&
      !pinSkewed
    )
  })
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
