import { parseTags } from '../cli/flags'
import {
  customDistribution,
  normalizeBackendUrl,
  resolveDistribution
} from '../devserver/distributions'
import type { Distribution } from '../devserver/distributions'
import { parseFeatureFlagSpecs } from '../featureFlags'
import { TAG_REGISTRY } from '../tags'
import { useCaseById } from '../useCases'
import type { UseCase } from '../useCases'
import { toSlug } from '../cli/slug'

export interface RecordPrefill {
  distribution?: Distribution
  distributionSource?: string
  workflow?: string
  tags?: string[]
  featureFlags?: Record<string, unknown>
  useCase?: UseCase
  description?: string
  name?: string
  warnings: string[]
  pr?: string
}

export function resolveRecordPrefill(
  flags: Record<string, string | undefined>
): RecordPrefill {
  const warnings: string[] = []
  let distribution: Distribution | undefined
  let distributionSource: string | undefined

  if (flags.backend) {
    const normalized = normalizeBackendUrl(flags.backend)
    if (normalized.ok) {
      distribution = customDistribution(normalized.url)
      distributionSource = '--backend'
    } else {
      warnings.push(`Invalid --backend: ${normalized.reason}`)
    }
  } else if (flags.distribution !== undefined) {
    distribution = resolveDistribution(flags.distribution)
    if (distribution) distributionSource = '--distribution'
    else warnings.push(`Unknown --distribution "${flags.distribution}".`)
  }

  const useCase = flags['use-case'] ? useCaseById(flags['use-case']) : undefined
  if (flags['use-case'] && !useCase) {
    warnings.push(`Unknown --use-case "${flags['use-case']}".`)
  }

  const description = flags.description?.trim()
  if (flags.description !== undefined && !toSlug(description ?? '')) {
    warnings.push('Invalid --description: use some letters or numbers.')
  }
  const name = flags.name?.trim()
  if (flags.name !== undefined && !toSlug(name ?? '')) {
    warnings.push('Invalid --name: use some letters or numbers.')
  }

  const tags = parseTags(flags.tags)
  const knownTags = new Set(TAG_REGISTRY.map(({ tag }) => tag))
  const invalidTags = tags?.filter((tag) => !knownTags.has(tag)) ?? []
  if (invalidTags.length > 0) {
    warnings.push(`Unknown --tags: ${invalidTags.join(', ')}.`)
  }

  const pr = flags.pr?.trim()
  if (pr !== undefined && !/^\d+$/.test(pr)) {
    warnings.push(`Invalid --pr "${pr}": use a pull request number.`)
  }

  return {
    distribution,
    distributionSource,
    workflow: flags.workflow,
    tags: invalidTags.length === 0 ? tags : undefined,
    featureFlags: flags['feature-flags']
      ? parseFeatureFlagSpecs(flags['feature-flags'].split(','))
      : undefined,
    useCase,
    description: toSlug(description ?? '') ? description : undefined,
    name: toSlug(name ?? '') ? toSlug(name ?? '') : undefined,
    warnings,
    pr: pr && /^\d+$/.test(pr) ? pr : undefined
  }
}
