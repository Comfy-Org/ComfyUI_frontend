import { useTelemetry } from '@comfyorg/telemetry'
import type { AgentStarterPromptPersonalizationMetadata } from '@comfyorg/telemetry/types'

import type { StarterPromptSelection } from '@/workbench/extensions/agent/experiments/starterPromptPersonalization'
import type { StarterPromptStrategyResolution } from '@/workbench/extensions/agent/experiments/starterPromptPersonalizationFlag'

/**
 * One `app:agent_starter_prompt_personalization` payload per rendered set.
 *
 * Keeps no `$feature/` property: this experiment is inactive, so every
 * resolution is either the unassigned baseline or an employee QA override, and
 * tagging either as an assignment would enrol the baseline into the arm.
 */
export function starterPromptPersonalizationEvent(input: {
  resolution: StarterPromptStrategyResolution
  selection: StarterPromptSelection
}): AgentStarterPromptPersonalizationMetadata {
  const { resolution, selection } = input
  return {
    strategy: selection.strategy,
    assignment_source: resolution.source,
    personalization_applied: selection.personalizationApplied,
    profile_source: selection.profileSource,
    canvas_presence: selection.canvasPresence,
    catalog_version: selection.catalogVersion,
    prompt_count: selection.prompts.length,
    locale: selection.locale
  }
}

function signatureOf(
  metadata: AgentStarterPromptPersonalizationMetadata
): string {
  return [
    metadata.strategy,
    metadata.assignment_source,
    metadata.personalization_applied,
    metadata.profile_source,
    metadata.canvas_presence,
    metadata.catalog_version,
    metadata.prompt_count,
    metadata.locale
  ].join('|')
}

/**
 * Reports a rendered starter-prompt set, collapsing repeats.
 *
 * The empty state re-renders whenever the panel reopens or the targeted
 * workflow changes, and an unconditional send would make the denominator a
 * render count rather than a per-session read. A changed signal — a survey that
 * became readable, a canvas that gained nodes, a QA override — is a new payload
 * and does report.
 */
export function createStarterPromptPersonalizationReporter() {
  const reported = new Set<string>()

  return {
    report(input: {
      resolution: StarterPromptStrategyResolution
      selection: StarterPromptSelection
    }): AgentStarterPromptPersonalizationMetadata | null {
      const metadata = starterPromptPersonalizationEvent(input)
      const signature = signatureOf(metadata)
      if (reported.has(signature)) return null

      const telemetry = useTelemetry()
      if (!telemetry) return null

      reported.add(signature)
      telemetry.trackAgentStarterPromptPersonalization(metadata)
      return metadata
    }
  }
}
