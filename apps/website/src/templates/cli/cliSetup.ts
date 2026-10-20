import { externalLinks } from '@/config/routes'
import { translationsFor } from '@/i18n/translations'
import type { Locale } from '@/i18n/translations'
import type { CliClientId } from '@/scripts/posthog'

export type ConnectionId = 'cloud' | 'local'

export const INSTALL_COMMAND = 'pip install comfy-cli'

interface ShellCard {
  title: string
  step: Record<ConnectionId, string>
  commands: Record<ConnectionId, string[]>
  showKeyLink: boolean
}

type CliClient = { name: string } & (
  | { kind: 'agent'; shell?: never }
  | { kind: 'shell'; shell: ShellCard }
)

export function cliSetupFor(locale: Locale) {
  const { t } = translationsFor(locale)
  const clients: Record<CliClientId, CliClient> = {
    'claude-code': { name: 'Claude Code', kind: 'agent' },
    codex: { name: 'Codex', kind: 'agent' },
    cursor: { name: 'Cursor', kind: 'agent' },
    'gemini-cli': { name: 'Gemini CLI', kind: 'agent' },
    openclaw: { name: 'OpenClaw', kind: 'agent' },
    hermes: { name: 'Hermes', kind: 'agent' },
    terminal: {
      name: t('cli.setup.clients.terminal.name'),
      kind: 'shell',
      shell: {
        title: t('cli.setup.shell.terminal.title'),
        step: {
          cloud: t('cli.setup.shell.terminal.stepCloud'),
          local: t('cli.setup.shell.terminal.stepLocal')
        },
        commands: {
          cloud: [
            'comfy setup --where cloud',
            'comfy generate nano-banana --prompt "a watercolor of a sleeping fox" --download fox.png'
          ],
          local: ['comfy setup --where local', 'comfy launch']
        },
        showKeyLink: false
      }
    },
    ci: {
      name: t('cli.setup.clients.ci.name'),
      kind: 'shell',
      shell: {
        title: t('cli.setup.shell.ci.title'),
        step: {
          cloud: t('cli.setup.shell.ci.stepCloud'),
          local: t('cli.setup.shell.ci.stepLocal')
        },
        commands: {
          cloud: [
            'comfy setup --where cloud --api-key comfyui-... --non-interactive',
            'comfy run --workflow my_workflow.json --wait | comfy download'
          ],
          local: ['comfy setup --where local --non-interactive']
        },
        showKeyLink: true
      }
    }
  }

  interface CliConnection {
    name: string
    tagline: string
    installDescription: string
    manualCommand: string
    agentCommand: string
  }

  const connections: Record<ConnectionId, CliConnection> = {
    cloud: {
      name: t('cli.setup.connections.cloud.name'),
      tagline: t('cli.setup.connections.cloud.tagline'),
      installDescription: t('cli.setup.install.cloudDescription'),
      manualCommand: 'comfy setup --where cloud\ncomfy skills install',
      agentCommand: t('cli.setup.agent.commandCloud', {
        url: externalLinks.docsCliMd
      })
    },
    local: {
      name: t('cli.setup.connections.local.name'),
      tagline: t('cli.setup.connections.local.tagline'),
      installDescription: t('cli.setup.install.localDescription'),
      manualCommand: 'comfy setup --where local\ncomfy skills install',
      agentCommand: t('cli.setup.agent.commandLocal', {
        url: externalLinks.docsCliMd
      })
    }
  }

  return { clients, connections }
}
