import { fileURLToPath } from 'node:url'
import path from 'node:path'

import type {
  GeneratedJobFixture,
  GeneratedOutputFixture,
  ImportedAssetFixture
} from './assetScenarioTypes'
import { getMimeType } from './mimeTypeUtil'

const helperDir = path.dirname(fileURLToPath(import.meta.url))

export type SeededAssetFile = {
  filePath?: string
  contentType?: string
  textContent?: string
}

export type SeededFileLocation = {
  filename: string
  type: string
  subfolder: string
}

function getFixturePath(relativePath: string): string {
  return path.resolve(helperDir, '../../assets', relativePath)
}

export function buildSeededFileKey({
  filename,
  type,
  subfolder
}: SeededFileLocation): string {
  return new URLSearchParams({
    filename,
    type,
    subfolder
  }).toString()
}

export function defaultFileFor(filename: string): SeededAssetFile {
  const normalized = filename.toLowerCase()

  if (normalized.endsWith('.png')) {
    return {
      filePath: getFixturePath('workflowInMedia/workflow_itxt.png'),
      contentType: 'image/png'
    }
  }

  if (normalized.endsWith('.webp')) {
    return {
      filePath: getFixturePath('example.webp'),
      contentType: 'image/webp'
    }
  }

  if (normalized.endsWith('.webm')) {
    return {
      filePath: getFixturePath('workflowInMedia/workflow.webm'),
      contentType: 'video/webm'
    }
  }

  if (normalized.endsWith('.mp4')) {
    return {
      filePath: getFixturePath('workflowInMedia/workflow.mp4'),
      contentType: 'video/mp4'
    }
  }

  if (normalized.endsWith('.glb')) {
    return {
      filePath: getFixturePath('workflowInMedia/workflow.glb'),
      contentType: 'model/gltf-binary'
    }
  }

  if (normalized.endsWith('.json')) {
    return {
      textContent: JSON.stringify({ mocked: true }, null, 2),
      contentType: 'application/json'
    }
  }

  return {
    textContent: 'mocked asset content',
    contentType: getMimeType(filename)
  }
}

function outputLocation(output: GeneratedOutputFixture): SeededFileLocation {
  return {
    filename: output.filename,
    type: output.type ?? 'output',
    subfolder: output.subfolder ?? ''
  }
}

function importedAssetLocation(
  asset: ImportedAssetFixture
): SeededFileLocation {
  return {
    filename: asset.name,
    type: 'input',
    subfolder: ''
  }
}

export function buildSeededFiles({
  generated,
  imported
}: {
  generated: readonly GeneratedJobFixture[]
  imported: readonly ImportedAssetFixture[]
}): Map<string, SeededAssetFile> {
  const seededFiles = new Map<string, SeededAssetFile>()

  for (const job of generated) {
    for (const output of job.outputs) {
      const fallback = defaultFileFor(output.filename)

      seededFiles.set(buildSeededFileKey(outputLocation(output)), {
        filePath: output.filePath ?? fallback.filePath,
        contentType: output.contentType ?? fallback.contentType,
        textContent: fallback.textContent
      })
    }
  }

  for (const asset of imported) {
    const fallback = defaultFileFor(asset.name)

    seededFiles.set(buildSeededFileKey(importedAssetLocation(asset)), {
      filePath: asset.filePath ?? fallback.filePath,
      contentType: asset.contentType ?? fallback.contentType,
      textContent: fallback.textContent
    })
  }

  return seededFiles
}
