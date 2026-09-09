// Command lines are verbatim from docs.comfy.org/agent-tools/cli and
// docs.comfy.org/comfy-cli/getting-started. Output lines are condensed from
// a real recorded session (comfy-cli 1.11.1 against Comfy Cloud, 2026-08-27):
// job ids, filenames, timings, and envelope fields are all real.

export type TerminalLine =
  | { kind: 'cmd'; text: string }
  | { kind: 'out'; text: string }
  | { kind: 'ok'; text: string }

export interface TerminalSequence {
  id: string
  lines: TerminalLine[]
}

export const cliTerminalSequences: readonly TerminalSequence[] = [
  {
    id: 'generate',
    lines: [
      {
        kind: 'cmd',
        text: 'comfy generate flux-pro --prompt "a cat on the moon, cinematic lighting" --width 1024 --height 1024 --download cat.png'
      },
      { kind: 'out', text: 'Generating with flux-pro (job 45c0f4c3…) 0:00:03' },
      { kind: 'out', text: 'Request: 45c0f4c3-2a53-4948-8eae-1986a184526b' },
      { kind: 'ok', text: 'Saved: cat.png' }
    ]
  },
  {
    id: 'cloud-pipe',
    lines: [
      {
        kind: 'cmd',
        text: 'comfy run --workflow zimage.json --where cloud --wait | comfy download'
      },
      {
        kind: 'out',
        text: '{ "ok": true, "prompt_id": "f5308bc5…", "files": [ … ] }'
      },
      { kind: 'ok', text: 'outputs/f5308bc5_000.png · 951 KB' }
    ]
  },
  {
    id: 'jobs-loop',
    lines: [
      { kind: 'cmd', text: 'comfy --json run --workflow zimage.json' },
      {
        kind: 'out',
        text: '{ "ok": true, "data": { "status": "queued", "prompt_id": "b65079fa…" } }'
      },
      { kind: 'cmd', text: 'comfy jobs wait b65079fa' },
      { kind: 'out', text: 'completed 1/1 · 5.9s' },
      { kind: 'cmd', text: 'comfy download b65079fa' },
      { kind: 'ok', text: 'outputs/b65079fa_000.png' }
    ]
  },
  {
    id: 'skills',
    lines: [
      { kind: 'cmd', text: 'comfy skills list' },
      {
        kind: 'out',
        text: 'comfy · comfy-fragments · comfy-debug · comfy-relay · comfy-director'
      },
      { kind: 'ok', text: '5 bundled skills' }
    ]
  }
]
