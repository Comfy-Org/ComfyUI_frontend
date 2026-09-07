import { homedir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export interface Options {
  agentPort: number
  airBin: string
  catalog: string
  cloudRepo: string
  comfyUrl: string
  docHostPort: number
  engine: string
  frontendPort: number
  healthPort: number
  help: boolean
  pgExec: string
  record: boolean
  temporalPort: number
  temporalUiPort: number
}

export const PROJECT_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..'
)
// The cloud's own dev server pairs the gRPC port with a UI port 1000 above it.
const TEMPORAL_UI_OFFSET = 1000
export const USAGE = `Usage: pnpm tsx scripts/dev-agent-integration.ts [options]

Options:
  --cloud-repo PATH     Comfy-Org/cloud checkout (default: ../cloud)
  --comfy-url URL       Local ComfyUI URL (default: http://127.0.0.1:8188)
  --frontend-port PORT  Vite port (default: 6207)
  --agent-port PORT     Standalone agent port (default: 6286)
  --air-bin PATH        Air executable (default: $AIR_BIN or ~/go/bin/air)
  --record              Record mode: the cloud stack's agent plus the doc host
  --catalog PATH        Conversation fixture whose workflow.catalog the agent loads
  --doc-host-port PORT  Doc host port in record mode (default: 8096)
  --pg-exec CMD         Command taking one SQL string, ending in -c; quote
                        an argument that contains a space
  --engine NAME         Record mode engine: inline or temporal (default: inline)
  --temporal-port PORT  Temporal gRPC port for --engine temporal (default: 7234)
  --help                Show this help
`

function optionValue(args: string[], index: number, option: string): string {
  const value = args.at(index + 1)
  if (value === undefined) throw new Error(`${option} requires a value`)
  return value
}

// Whitespace separates words, quotes group, a backslash keeps the next character.
export function splitCommandLine(value: string): string[] {
  const words: string[] = []
  let word: string | null = null
  let quote: string | null = null
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    if (quote !== null) {
      if (char === quote) quote = null
      else word = `${word ?? ''}${char}`
    } else if (char === '"' || char === "'") {
      quote = char
      word ??= ''
    } else if (char === '\\' && index + 1 < value.length) {
      index += 1
      word = `${word ?? ''}${value[index]}`
    } else if (/\s/.test(char)) {
      if (word !== null) words.push(word)
      word = null
    } else {
      word = `${word ?? ''}${char}`
    }
  }
  if (quote !== null)
    throw new Error(`Unterminated ${quote} quote in ${JSON.stringify(value)}`)
  if (word !== null) words.push(word)
  return words
}

function port(value: string, option: string): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`${option} must be an integer from 1 to 65535`)
  }
  return parsed
}

export function parseOptions(args: string[]): Options {
  const options: Options = {
    agentPort: 6286,
    airBin: process.env.AIR_BIN ?? resolve(homedir(), 'go/bin/air'),
    catalog: '',
    cloudRepo: resolve(PROJECT_ROOT, '../cloud'),
    comfyUrl: 'http://127.0.0.1:8188',
    // Beside the cloud stack's own doc host (8095) and Temporal (7233).
    docHostPort: 8096,
    engine: 'inline',
    frontendPort: 6207,
    healthPort: 0,
    help: false,
    pgExec: '',
    record: false,
    temporalPort: 7234,
    temporalUiPort: 0
  }
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]
    switch (arg) {
      case '--agent-port':
        options.agentPort = port(optionValue(args, index, arg), arg)
        index++
        break
      case '--air-bin':
        options.airBin = resolve(optionValue(args, index, arg))
        index++
        break
      case '--catalog':
        options.catalog = resolve(optionValue(args, index, arg))
        index++
        break
      case '--doc-host-port':
        options.docHostPort = port(optionValue(args, index, arg), arg)
        index++
        break
      case '--engine':
        options.engine = optionValue(args, index, arg)
        index++
        break
      case '--temporal-port':
        options.temporalPort = port(optionValue(args, index, arg), arg)
        index++
        break
      case '--pg-exec':
        options.pgExec = optionValue(args, index, arg)
        index++
        break
      case '--record':
        options.record = true
        break
      case '--cloud-repo':
        options.cloudRepo = resolve(optionValue(args, index, arg))
        index++
        break
      case '--comfy-url':
        options.comfyUrl = optionValue(args, index, arg)
        index++
        break
      case '--frontend-port':
        options.frontendPort = port(optionValue(args, index, arg), arg)
        index++
        break
      case '--help':
        options.help = true
        break
      default:
        throw new Error(`Unknown option: ${arg}`)
    }
  }
  if (options.agentPort === options.frontendPort) {
    throw new Error('Agent and frontend ports must be different')
  }
  if (options.record && !options.catalog) {
    throw new Error('--record requires --catalog <conversation fixture>')
  }
  if (options.engine !== 'inline' && options.engine !== 'temporal') {
    throw new Error('--engine must be inline or temporal')
  }
  if (options.engine === 'temporal' && !options.record) {
    throw new Error('--engine temporal applies to --record only')
  }
  options.temporalUiPort = options.temporalPort + TEMPORAL_UI_OFFSET
  if (options.temporalUiPort > 65535) {
    throw new Error(
      `--temporal-port must leave room for the Temporal UI port (port + ${TEMPORAL_UI_OFFSET})`
    )
  }
  options.healthPort = options.agentPort + 1
  if (options.healthPort > 65535) {
    throw new Error(
      '--agent-port must leave room for the agent health port (agent port + 1)'
    )
  }
  if (options.healthPort === options.frontendPort) {
    throw new Error(
      `Agent health port ${options.healthPort} (agent port + 1) collides with the frontend port`
    )
  }
  if (options.record && options.docHostPort === options.agentPort) {
    throw new Error(
      `--doc-host-port ${options.docHostPort} collides with the agent port`
    )
  }
  if (options.record && options.docHostPort === options.healthPort) {
    throw new Error(
      `--doc-host-port ${options.docHostPort} collides with the agent health port (agent port + 1)`
    )
  }
  if (options.engine === 'temporal') {
    const taken: Array<[string, number]> = [
      ['agent', options.agentPort],
      ['agent health', options.healthPort],
      ['frontend', options.frontendPort],
      ['doc host', options.docHostPort]
    ]
    for (const [label, portNumber] of taken) {
      if (
        options.temporalPort === portNumber ||
        options.temporalUiPort === portNumber
      ) {
        throw new Error(
          `--temporal-port ${options.temporalPort} (UI port ${options.temporalUiPort}) collides with the ${label} port ${portNumber}`
        )
      }
    }
  }
  return options
}
