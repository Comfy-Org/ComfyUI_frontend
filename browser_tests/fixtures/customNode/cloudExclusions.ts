import { SYNTH_PRODUCERS } from '@e2e/fixtures/customNode/autoRun'
import type {
  CloudManifestEntry,
  CoreManifestEntry
} from '@e2e/fixtures/customNode/manifest'

// Open item 2: whether a label-disabled node VANISHES from /object_info or
// registers and gets BLOCKED at execution is unanswered until the Phase-1
// probe. This switch is the single tier-application point. Under 'vanish'
// (the default reading) the gen-cloud-manifest generator already subtracted
// disabled nodes from expectedNodeCount and the live corpus never contains
// them, so the auto-run tier has nothing to exclude; 'register-but-block'
// stays a loud stub until the probe shows what a blocked execution looks
// like - flipping it without that calibration fails, never guesses.
type CloudDisabledSemantics = 'vanish' | 'register-but-block'

const CLOUD_DISABLED_SEMANTICS: CloudDisabledSemantics = 'vanish'

// Seeds the auto-run exclusion map (merged into the same map
// AUTO_RUN_EXCLUDE feeds, so one mechanism carries both) from the cloud
// manifest's disabledNodes; the yaml labels are the mechanism.
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

// coreDisabledNodes seeding: core's labeled nodes belong to no pack row, but
// the auto-run harness is BUILT from core nodes - a producer or the sink
// going label-disabled would silently reclassify every dependent node
// NEEDS_WIRES and shrink coverage while green, under either semantics.
// Surface it as a named red instead; the labels ride along as the mechanism.
export function disabledHarnessNodes(
  coreDisabledNodes: Record<string, string[]>
): string[] {
  return AUTO_RUN_HARNESS_NODES.filter(
    (nodeType) => nodeType in coreDisabledNodes
  ).map((nodeType) => `${nodeType} (${coreDisabledNodes[nodeType].join(', ')})`)
}
