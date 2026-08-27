// Command lines are verbatim from docs.comfy.org/agent-tools/cli and
// docs.comfy.org/comfy-cli/getting-started. Output lines are illustrative —
// they show the shape of a run, not captured terminal output.

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
      { kind: 'out', text: 'queued · flux-pro · 1024×1024' },
      { kind: 'ok', text: 'saved cat.png' }
    ]
  },
  {
    id: 'cloud-batch',
    lines: [
      {
        kind: 'cmd',
        text: 'comfy run --workflow packshots.json --where cloud --wait | comfy download'
      },
      { kind: 'out', text: 'routing to cloud · 24 queued' },
      { kind: 'ok', text: '24 outputs → ./outputs/' }
    ]
  },
  {
    id: 'jobs-loop',
    lines: [
      { kind: 'cmd', text: 'comfy --json run --workflow board.json' },
      { kind: 'out', text: '{ "ok": true, "data": { "prompt_id": "8f3a…" } }' },
      { kind: 'cmd', text: 'comfy jobs wait 8f3a…' },
      { kind: 'cmd', text: 'comfy download 8f3a…' },
      { kind: 'ok', text: '8 outputs → ./outputs/' }
    ]
  },
  {
    id: 'skills',
    lines: [
      { kind: 'cmd', text: 'comfy skills install' },
      {
        kind: 'out',
        text: 'comfy · comfy-fragments · comfy-debug · comfy-relay · comfy-director'
      },
      { kind: 'ok', text: 'your agent knows the CLI' }
    ]
  }
]
