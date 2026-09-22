import type { Distribution } from '@/platform/distribution/types'
import type {
  BuildInputs,
  NodePack
} from '@/platform/workflow/deploy/utils/buildInputs'

// The handoff is a technical brief for a coding agent driving `comfy-cli`, so
// it stays in English alongside the commands it explains and is not localized.

function isControlCharacter(character: string): boolean {
  const code = character.charCodeAt(0)
  return code < 0x20 || code === 0x7f
}

/**
 * Everything interpolated into the brief comes off a workflow file, which is
 * routinely shared, so a value must not be able to add a line to the document:
 * a newline in a node type would otherwise read as a new heading or command.
 */
function singleLine(value: string): string {
  return Array.from(value, (character) =>
    isControlCharacter(character) ? ' ' : character
  )
    .join('')
    .replace(/ {2,}/g, ' ')
    .trim()
}

function inlineCode(value: string): string {
  return `\`${singleLine(value).replaceAll('`', '')}\``
}

function quoteForShell(name: string): string {
  return singleLine(name).replace(/["\\$`]/g, '\\$&')
}

function bulletList(items: string[]): string {
  return items.map((item) => `- ${inlineCode(item)}`).join('\n')
}

function intro(inputs: BuildInputs): string {
  return `# Turn "${singleLine(inputs.workflowName)}" into a Comfy API Build

Create a **Build** on the Comfy developer platform from this ComfyUI workflow. A
Build is a definition of everything needed to run the workflow on a serverless
API: the ComfyUI version, the custom node packs and the models.

A Build is not a deployment. Deploying it is a separate step. Stop at a green
build and report back.`
}

function prerequisites(): string {
  return `## Before you start

Run \`comfy build --help\`. If it does not list \`init\` and \`push\`, upgrade the CLI:

\`\`\`bash
pip install -U comfy-cli
\`\`\`

Run \`comfy cloud login\` only when a command answers \`not signed in\`.`
}

function cloudSteps(inputs: BuildInputs): string {
  const name = quoteForShell(inputs.workflowName)
  return `## Steps

This workflow lives in Comfy Cloud, so you cannot scan the install. Build the
definition from the exported workflow file instead.

The browser downloaded the file as ${inlineCode(inputs.workflowFileName)}. Find
it — the download directory is the first place to look:

\`\`\`bash
ls -t ~/Downloads/*.json | head -5
\`\`\`

Build the definition from it, and keep the report:

\`\`\`bash
comfy --json build init . --name "${name}" --from-workflow <path-to-file> > build-report.json
\`\`\`

Read \`build-report.json\` before going further. \`--from-workflow\` carries no
models and pins every pack to the registry's newest published version, so three
things need settling by hand:

- Set the ComfyUI version: \`comfy build update . --comfy-version <ref>\`
- Resolve every model the report lists: \`comfy build refs resolve <filename>\`
- Pin any pack that arrived without a \`gitRef\` to the version listed below, or
  to a commit

Then validate, preview and push:

\`\`\`bash
comfy build validate .
comfy build push . --dry-run
comfy build push .
\`\`\``
}

function localhostSteps(inputs: BuildInputs): string {
  const name = quoteForShell(inputs.workflowName)
  return `## Steps

ComfyUI runs on this machine, so \`comfy-cli\` reads the install directly. No
workflow file is needed.

\`\`\`bash
comfy which
\`\`\`

Use the path it prints as \`<install>\`:

\`\`\`bash
comfy build init <install> --name "${name}" --python <install>/.venv/bin/python
comfy build validate <install>
comfy build push <install> --dry-run
comfy build push <install>
\`\`\`

\`init\` collects only \`.ckpt\`, \`.pt\`, \`.bin\`, \`.pth\` and \`.safetensors\` files
that sit in a folder under \`models/\`. Anything else is left out without a
word, so check the count it reports against the list below.`
}

function desktopSteps(inputs: BuildInputs): string {
  const name = quoteForShell(inputs.workflowName)
  return `## Steps

This is Comfy Desktop, so take the definition from its snapshot rather than
scanning the install. \`<install>\` is the ComfyUI base path Desktop was set up
with, \`~/Documents/ComfyUI\` unless the user chose another directory; ask when
it is not there. Use the newest snapshot:

\`\`\`bash
ls -t <install>/.launcher/snapshots/*.json | head -1
\`\`\`

\`\`\`bash
comfy build init . --name "${name}" --from-snapshot <newest-snapshot>.json
comfy build validate .
comfy build push . --dry-run
comfy build push .
\`\`\`

The snapshot import runs through the builder, so sign in first with
\`comfy cloud login\`. It cannot be combined with \`--models-dir\`,
\`--custom-nodes-dir\`, \`--python\` or \`--comfy-url\`, and it carries no models —
scan the install instead when private model files have to travel.`
}

const STEPS_BY_DISTRIBUTION: Record<
  Distribution,
  (inputs: BuildInputs) => string
> = {
  cloud: cloudSteps,
  localhost: localhostSteps,
  desktop: desktopSteps
}

function nodePackItem(pack: NodePack): string {
  return pack.version
    ? `${inlineCode(pack.id)} at ${inlineCode(pack.version)}`
    : inlineCode(pack.id)
}

function contents(inputs: BuildInputs): string {
  const nodeClasses = inputs.nodeClasses.length
    ? `Node classes (${inputs.nodeClasses.length}):

${bulletList(inputs.nodeClasses)}`
    : 'No node classes were read from the graph.'

  const nodePacks = inputs.nodePacks.length
    ? `Node packs the workflow records (${inputs.nodePacks.length}):

${inputs.nodePacks.map((pack) => `- ${nodePackItem(pack)}`).join('\n')}`
    : `The workflow records no node packs. Any class it uses is core ComfyUI, or
its pack was never written into the file.`

  const models = inputs.models.length
    ? `Models the graph loads (${inputs.models.length}):

${bulletList(inputs.models)}`
    : 'The graph loads no models.'

  return `## What the workflow contains

${nodeClasses}

${nodePacks}

${models}

Ask the registry which pack publishes a class you do not recognise:

\`\`\`bash
curl -s "https://api.comfy.org/comfy-nodes/<ClassName>/node"
\`\`\`

A 404 there means core or unknown, never missing — tell those two apart before
you report the build as complete.`
}

function closing(): string {
  return `## When you are done

Report the Build name and id. Cutting a release
(\`comfy build release create <dir> --target <os>/<gpu>\`) and deploying it are
separate decisions — do neither without being asked.`
}

/**
 * The whole handoff, as one markdown document the user copies to a coding
 * agent. Pure: the distribution is an argument, not a compile-time import, so
 * every branch is reachable from a test.
 */
export function buildAgentHandoffDocument({
  distribution,
  inputs
}: {
  distribution: Distribution
  inputs: BuildInputs
}): string {
  return [
    intro(inputs),
    prerequisites(),
    STEPS_BY_DISTRIBUTION[distribution](inputs),
    contents(inputs),
    closing()
  ].join('\n\n')
}
