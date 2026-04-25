import { fileURLToPath } from 'node:url'
import path from 'node:path'

import type {
  GeneratedJobFixture,
  GeneratedOutputFixture,
  ImportedAssetFixture
} from '@e2e/fixtures/helpers/assetScenarioTypes'
import { getMimeType } from '@e2e/fixtures/helpers/mimeTypeUtil'

const helperDir = path.dirname(fileURLToPath(import.meta.url))

export type MockAssetFile = {
  filePath?: string
  contentType?: string
  textContent?: string
}

export type MockFileLocation = {
  filename: string
  type: string
  subfolder: string
}

function getFixturePath(relativePath: string): string {
  return path.resolve(helperDir, '../../assets', relativePath)
}

export function buildFileRequestKey({
  filename,
  type,
  subfolder
}: MockFileLocation): string {
  return new URLSearchParams({
    filename,
    type,
    subfolder
  }).toString()
}

export function defaultFileFor(filename: string): MockAssetFile {
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

function outputLocation(output: GeneratedOutputFixture): MockFileLocation {
  return {
    filename: output.filename,
    type: output.type ?? 'output',
    subfolder: output.subfolder ?? ''
  }
}

function importedAssetLocation(asset: ImportedAssetFixture): MockFileLocation {
  return {
    filename: asset.name,
    type: 'input',
    subfolder: ''
  }
}

export function buildMockAssetFiles({
  generated,
  imported
}: {
  generated: readonly GeneratedJobFixture[]
  imported: readonly ImportedAssetFixture[]
}): Map<string, MockAssetFile> {
  const mockFiles = new Map<string, MockAssetFile>()

  for (const job of generated) {
    for (const output of job.outputs) {
      const fallback = defaultFileFor(output.filename)

      mockFiles.set(buildFileRequestKey(outputLocation(output)), {
        filePath: output.filePath ?? fallback.filePath,
        contentType: output.contentType ?? fallback.contentType,
        textContent: fallback.textContent
      })
    }
  }

  for (const asset of imported) {
    const fallback = defaultFileFor(asset.name)

    mockFiles.set(buildFileRequestKey(importedAssetLocation(asset)), {
      filePath: asset.filePath ?? fallback.filePath,
      contentType: asset.contentType ?? fallback.contentType,
      textContent: fallback.textContent
    })
  }

  return mockFiles
}
