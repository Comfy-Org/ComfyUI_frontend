import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { assetService } from '@/platform/assets/services/assetService'
import { isCloud } from '@/platform/distribution/types'
import {
  PROMPT_TAG,
  promptTemplateSchema
} from '@/platform/prompts/schemas/promptTypes'
import type {
  Prompt,
  PromptTemplate,
  PromptVersion
} from '@/platform/prompts/schemas/promptTypes'

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}

/** Coerces metadata the API may return as an object or a JSON string. */
function coerceObject(value: unknown): Record<string, unknown> {
  const parsed = typeof value === 'string' ? parseJson(value) : value
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {}
}

function coerceTemplate(value: unknown): PromptTemplate {
  const candidate = typeof value === 'string' ? parseJson(value) : value
  const parsed = promptTemplateSchema.safeParse(candidate)
  return parsed.success ? parsed.data : []
}

function stripTxt(name: string): string {
  return name.replace(/\.txt$/i, '')
}

function toFileName(name: string): string {
  return name.toLowerCase().endsWith('.txt') ? name : `${name}.txt`
}

/**
 * Per-prompt tag carrying the stable logical id. The asset list endpoint omits
 * user_metadata, so versions must group by a tag (which the list does return)
 * rather than by metadata.
 */
const PROMPT_ID_TAG_PREFIX = 'prompt-id:'

function promptIdTag(promptId: string): string {
  return `${PROMPT_ID_TAG_PREFIX}${promptId}`
}

/** Legacy prompts have no prompt-id tag; treat the asset id as a single-version id. */
function assetPromptId(asset: AssetItem): string {
  const tagged = asset.tags?.find((tag) => tag.startsWith(PROMPT_ID_TAG_PREFIX))
  if (tagged) return tagged.slice(PROMPT_ID_TAG_PREFIX.length)
  return readString(coerceObject(asset.user_metadata).prompt_id) ?? asset.id
}

function assetCreatedAt(asset: AssetItem): string {
  return asset.created_at ?? ''
}

function assetName(asset: AssetItem): string {
  const metadata = coerceObject(asset.user_metadata)
  return readString(metadata.name) ?? stripTxt(asset.display_name ?? asset.name)
}

function assetToPrompt(promptId: string, asset: AssetItem): Prompt {
  const metadata = coerceObject(asset.user_metadata)
  return {
    id: promptId,
    name: assetName(asset),
    template: coerceTemplate(metadata.template),
    description: readString(metadata.description),
    latestAssetId: asset.id
  }
}

/** Returns the current prompts: the newest asset per logical prompt id. */
export async function fetchPrompts(): Promise<Prompt[]> {
  const assets = await assetService.getAllAssetsByTag(PROMPT_TAG)
  const latest = new Map<string, AssetItem>()
  for (const asset of assets) {
    const promptId = assetPromptId(asset)
    const current = latest.get(promptId)
    if (!current || assetCreatedAt(asset) > assetCreatedAt(current)) {
      latest.set(promptId, asset)
    }
  }
  return [...latest].map(([promptId, asset]) => assetToPrompt(promptId, asset))
}

/** Lists every saved version of a prompt, newest first. */
export async function fetchPromptVersions(
  promptId: string
): Promise<PromptVersion[]> {
  const assets = await assetService.getAllAssetsByTag(PROMPT_TAG)
  return assets
    .filter((asset) => assetPromptId(asset) === promptId)
    .sort((a, b) => assetCreatedAt(b).localeCompare(assetCreatedAt(a)))
    .map((asset) => ({
      assetId: asset.id,
      name: assetName(asset),
      createdAt: assetCreatedAt(asset)
    }))
}

/**
 * Loads a prompt's template from its file content, the reliably-persisted
 * source of truth (some backends drop user_metadata for text assets). Falls
 * back to treating non-JSON content as plain text for legacy prompts.
 */
export async function fetchPromptTemplate(id: string): Promise<PromptTemplate> {
  const content = await assetService.getAssetContent(id)
  const parsed = parseJson(content)
  const raw =
    parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>).template
      : parsed
  const template = coerceTemplate(raw)
  if (template.length) return template
  return content ? [{ type: 'text', value: content }] : []
}

interface PromptInput {
  name: string
  template: PromptTemplate
  description?: string
}

/** Uploads one immutable version asset for a logical prompt id. */
async function uploadPromptVersion(
  promptId: string,
  input: PromptInput
): Promise<Prompt> {
  const content = JSON.stringify({
    name: input.name,
    template: input.template,
    ...(input.description ? { description: input.description } : {})
  })

  // Self-hosted asset APIs require the first tag to be a known category
  // (models/input/output); cloud accepts the bare prompt tag.
  const baseTags = isCloud ? [PROMPT_TAG] : ['input', PROMPT_TAG]
  const tags = [...baseTags, promptIdTag(promptId)]

  const uploaded = await assetService.uploadAssetFromBase64({
    data: `data:text/plain;charset=utf-8,${encodeURIComponent(content)}`,
    name: toFileName(input.name),
    tags,
    user_metadata: { name: input.name, prompt_id: promptId }
  })

  // The multipart upload does not reliably apply tags, and the asset list
  // endpoint omits user_metadata; ensure the prompt stays retrievable and
  // groupable by tag after a reload.
  const requiredTags = [PROMPT_TAG, promptIdTag(promptId)]
  const missingTags = requiredTags.filter(
    (tag) => !uploaded.tags?.includes(tag)
  )
  if (missingTags.length) {
    await assetService.addAssetTags(uploaded.id, missingTags)
  }

  return {
    id: promptId,
    name: input.name,
    template: input.template,
    description: input.description,
    latestAssetId: uploaded.id
  }
}

export async function createPrompt(input: PromptInput): Promise<Prompt> {
  return uploadPromptVersion(crypto.randomUUID(), input)
}

/** Saves a new version of an existing prompt under its stable id. */
export async function savePromptVersion(
  promptId: string,
  input: PromptInput
): Promise<Prompt> {
  return uploadPromptVersion(promptId, input)
}

/** Deletes a prompt and all of its saved versions. */
export async function deletePrompt(promptId: string): Promise<void> {
  const assets = await assetService.getAllAssetsByTag(PROMPT_TAG)
  const ids = assets
    .filter((asset) => assetPromptId(asset) === promptId)
    .map((asset) => asset.id)
  await Promise.all(ids.map((id) => assetService.deleteAsset(id)))
}

export async function renamePrompt(
  promptId: string,
  latestAssetId: string,
  name: string
): Promise<void> {
  await assetService.updateAsset(latestAssetId, {
    name: toFileName(name),
    user_metadata: { name, prompt_id: promptId }
  })
}
