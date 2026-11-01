/** The section of a Build brief that sends an agent to the build recipe. */
export const BUILD_RECIPE_SECTION = `## Before you start

Read the build recipe, and follow it:

\`\`\`bash
comfy skills show comfy-build
\`\`\`

If \`comfy\` or that skill is missing, install the current CLI first with
\`pip install -U comfy-cli\`. The recipe owns every command, the pins, the
models, the targets, the cut, watching the release and reading a failure.`

/** The end of a custom deployment brief: the cut, the retries and the report. */
export const CUT_AND_REPORT_SECTION = `Then go through the recipe's "Before
you cut" with the user, and wait for a yes. After that, fix and re-cut on your
own within the recipe's limits, and tell the user what each retry changed.

Cut the target the recipe says a deployment needs.

## When you are done

Report the Build name, its id and the release id, and whether the release is
deployable. Ask the user before you deploy it.`

/** Brief an agent follows to help create a custom deployment on Comfy Cloud. */
export const CUSTOM_DEPLOYMENT_BRIEF = `# Create a custom deployment on Comfy Cloud

Help the user create a **custom deployment** on the Comfy developer platform. A
custom deployment runs ComfyUI on Comfy Cloud with the custom node packs and
models the user chooses, including ones Comfy Cloud does not have. Once it is
deployed, it appears under **Run on** in the ComfyUI editor for everyone in the
user's workspace.

${BUILD_RECIPE_SECTION}

## Where the user decides

Ask the user which custom node packs and models the deployment needs, and which
GPU it should run on. Do not guess them. ${CUT_AND_REPORT_SECTION}`
