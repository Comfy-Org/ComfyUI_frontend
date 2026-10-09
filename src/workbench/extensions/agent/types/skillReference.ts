import type { SkillPack } from '@/platform/skills/types'

/** Display metadata only; instruction bodies remain backend-owned. */
export type SkillReferenceMetadata = Pick<SkillPack, 'name' | 'description'>

export interface SkillReference extends SkillReferenceMetadata {
  /** UTF-16 offset in prompt text, excluding semantic reference tokens. */
  textOffset: number
  /** Workflow references preceding this skill, preserving order at equal offsets. */
  workflowIndex?: number
}
