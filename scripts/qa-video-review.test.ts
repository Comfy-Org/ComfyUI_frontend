import { describe, expect, it } from 'vitest'

import {
  extractOutputText,
  extractPlatformFromArtifactDirName,
  pickLatestVideosByPlatform,
  selectVideoCandidateByFile
} from './qa-video-review'

describe('extractPlatformFromArtifactDirName', () => {
  it('extracts and normalizes known qa artifact directory names', () => {
    expect(
      extractPlatformFromArtifactDirName('qa-report-Windows-22818315023')
    ).toBe('windows')
    expect(
      extractPlatformFromArtifactDirName('qa-report-macOS-22818315023')
    ).toBe('macos')
    expect(
      extractPlatformFromArtifactDirName('qa-report-Linux-22818315023')
    ).toBe('linux')
  })

  it('falls back to slugifying unknown directory names', () => {
    expect(extractPlatformFromArtifactDirName('custom platform run')).toBe(
      'custom-platform-run'
    )
  })
})

describe('pickLatestVideosByPlatform', () => {
  it('keeps only the latest candidate per platform', () => {
    const selected = pickLatestVideosByPlatform([
      {
        platformName: 'windows',
        videoPath: '/tmp/windows-old.mp4',
        mtimeMs: 100
      },
      {
        platformName: 'windows',
        videoPath: '/tmp/windows-new.mp4',
        mtimeMs: 200
      },
      {
        platformName: 'linux',
        videoPath: '/tmp/linux.mp4',
        mtimeMs: 150
      }
    ])

    expect(selected).toEqual([
      {
        platformName: 'linux',
        videoPath: '/tmp/linux.mp4',
        mtimeMs: 150
      },
      {
        platformName: 'windows',
        videoPath: '/tmp/windows-new.mp4',
        mtimeMs: 200
      }
    ])
  })
})

describe('extractOutputText', () => {
  it('reads output_text when available', () => {
    expect(extractOutputText({ output_text: 'hello world' })).toBe(
      'hello world'
    )
  })

  it('reads nested output text chunks', () => {
    const responseBody = {
      output: [
        {
          content: [
            { type: 'output_text', text: 'first block' },
            { type: 'refusal', refusal: 'not relevant' }
          ]
        },
        {
          content: [{ type: 'output_text', text: 'second block' }]
        }
      ]
    }

    expect(extractOutputText(responseBody)).toBe('first block\n\nsecond block')
  })

  it('returns null when there is no usable text', () => {
    expect(
      extractOutputText({ output: [{ content: [{ type: 'tool_call' }] }] })
    ).toBeNull()
  })
})

describe('selectVideoCandidateByFile', () => {
  it('selects a single candidate by artifacts-relative path', () => {
    const selected = selectVideoCandidateByFile(
      [
        {
          platformName: 'windows',
          videoPath: '/tmp/qa-artifacts/qa-report-Windows-1/qa-session.mp4',
          mtimeMs: 100
        },
        {
          platformName: 'linux',
          videoPath: '/tmp/qa-artifacts/qa-report-Linux-1/qa-session.mp4',
          mtimeMs: 200
        }
      ],
      {
        artifactsDir: '/tmp/qa-artifacts',
        videoFile: 'qa-report-Linux-1/qa-session.mp4'
      }
    )

    expect(selected).toEqual({
      platformName: 'linux',
      videoPath: '/tmp/qa-artifacts/qa-report-Linux-1/qa-session.mp4',
      mtimeMs: 200
    })
  })

  it('throws when basename matches multiple videos', () => {
    expect(() =>
      selectVideoCandidateByFile(
        [
          {
            platformName: 'windows',
            videoPath: '/tmp/qa-artifacts/qa-report-Windows-1/qa-session.mp4',
            mtimeMs: 100
          },
          {
            platformName: 'linux',
            videoPath: '/tmp/qa-artifacts/qa-report-Linux-1/qa-session.mp4',
            mtimeMs: 200
          }
        ],
        {
          artifactsDir: '/tmp/qa-artifacts',
          videoFile: 'qa-session.mp4'
        }
      )
    ).toThrow('matched 2 videos')
  })

  it('throws when there is no matching video', () => {
    expect(() =>
      selectVideoCandidateByFile(
        [
          {
            platformName: 'windows',
            videoPath: '/tmp/qa-artifacts/qa-report-Windows-1/qa-session.mp4',
            mtimeMs: 100
          }
        ],
        {
          artifactsDir: '/tmp/qa-artifacts',
          videoFile: 'qa-report-macOS-1/qa-session.mp4'
        }
      )
    ).toThrow('No video matched')
  })

  it('throws when video file is missing', () => {
    expect(() =>
      selectVideoCandidateByFile(
        [
          {
            platformName: 'windows',
            videoPath: '/tmp/qa-artifacts/qa-report-Windows-1/qa-session.mp4',
            mtimeMs: 100
          }
        ],
        {
          artifactsDir: '/tmp/qa-artifacts',
          videoFile: '   '
        }
      )
    ).toThrow('--video-file is required')
  })
})
