import {
  MAX_DESCRIPTION_CODE_POINTS,
  MAX_NAME_LENGTH,
  PACK_NAME_PATTERN,
  codePointLength
} from '@/platform/skills/types'

import type { SkillReferenceMetadata } from '../types/skillReference'
import type {
  PromptSnapshot,
  WorkflowReference
} from '../types/workflowReference'

// encodeURIComponent throws on an unpaired UTF-16 surrogate. The ES2023 lib
// has no String#toWellFormed, so this applies the same U+FFFD replacement.
const LONE_SURROGATE =
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g

export function serializeSkillReference(skill: SkillReferenceMetadata): string {
  const wellFormed = skill.description.replace(LONE_SURROGATE, '�')
  const description = encodeURIComponent(wellFormed)
    .replaceAll('(', '%28')
    .replaceAll(')', '%29')
  return `[Use the saved skill /${skill.name}](skill://${skill.name}?description=${description})`
}

export function parseSkillReferenceText(
  content: string,
  workflowReferences: WorkflowReference[] = []
): PromptSnapshot {
  for (const match of content.matchAll(
    // Tolerates a legacy `&id`; skills resolve by name.
    /(\[Use the saved skill \/([A-Za-z0-9._-]+)\]\(skill:\/\/\2\?description=([^\s)&]*))(?:&id=[A-Za-z0-9_-]{1,128})?\)/g
  )) {
    const [, canonical, name] = match
    if (name.length > MAX_NAME_LENGTH || !PACK_NAME_PATTERN.test(name)) continue
    let description: string
    try {
      description = decodeURIComponent(match[3])
    } catch {
      continue
    }
    if (codePointLength(description) > MAX_DESCRIPTION_CODE_POINTS) continue
    if (serializeSkillReference({ name, description }) !== `${canonical})`)
      continue
    const start = match.index
    const end = start + match[0].length
    return {
      text: content.slice(0, start) + content.slice(end),
      workflowReferences: workflowReferences.map((reference) => ({
        ...reference,
        textOffset:
          reference.textOffset <= start
            ? reference.textOffset
            : Math.max(start, reference.textOffset - match[0].length)
      })),
      skillReference: {
        name,
        description,
        textOffset: start,
        workflowIndex: workflowReferences.filter(
          (reference) => reference.textOffset <= start
        ).length
      }
    }
  }
  return { text: content, workflowReferences }
}
