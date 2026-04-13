import { describe, expect, it } from 'vitest'

import {
  buildSeededFileKey,
  buildSeededFiles
} from '@e2e/fixtures/helpers/seededAssetFiles'

describe('buildSeededFiles', () => {
  it('keys seeded files by filename, type, and subfolder', () => {
    const seededFiles = buildSeededFiles({
      generated: [
        {
          jobId: 'job-root',
          outputs: [
            {
              filename: 'shared-name.txt',
              type: 'output',
              subfolder: '',
              filePath: '/tmp/root-output.txt',
              contentType: 'text/plain'
            }
          ]
        },
        {
          jobId: 'job-nested',
          outputs: [
            {
              filename: 'shared-name.txt',
              type: 'output',
              subfolder: 'nested/folder',
              filePath: '/tmp/nested-output.txt',
              contentType: 'text/plain'
            }
          ]
        }
      ],
      imported: [
        {
          name: 'shared-name.txt',
          filePath: '/tmp/input-asset.txt',
          contentType: 'text/plain'
        }
      ]
    })

    expect(
      seededFiles.get(
        buildSeededFileKey({
          filename: 'shared-name.txt',
          type: 'output',
          subfolder: ''
        })
      )
    ).toMatchObject({
      filePath: '/tmp/root-output.txt',
      contentType: 'text/plain'
    })

    expect(
      seededFiles.get(
        buildSeededFileKey({
          filename: 'shared-name.txt',
          type: 'output',
          subfolder: 'nested/folder'
        })
      )
    ).toMatchObject({
      filePath: '/tmp/nested-output.txt',
      contentType: 'text/plain'
    })

    expect(
      seededFiles.get(
        buildSeededFileKey({
          filename: 'shared-name.txt',
          type: 'input',
          subfolder: ''
        })
      )
    ).toMatchObject({
      filePath: '/tmp/input-asset.txt',
      contentType: 'text/plain'
    })
  })
})
