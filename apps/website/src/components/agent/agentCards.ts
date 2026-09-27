/**
 * Pitch cards for the agent landing page. Kept out of the `.astro`
 * frontmatter so the `website-unit` gate can measure them: V8 cannot
 * instrument `.astro` files.
 */
export interface AgentCard {
  tag: string
  title: string
  body: string
}

export const agentCards: readonly AgentCard[] = [
  {
    tag: 'Creative knowledge',
    title: 'Best practice can be delivered end to end',
    body: "Up-to-date knowledge of all the latest models, ComfyUI extensions, parameters, and best workflows, curated by ComfyUI experts. Describe the content and asset you want. It is Comfy Agent's job to learn the technology and model details. It can run a project in auto mode and deliver the best result end to end."
  },
  {
    tag: 'Human-agent Multiplayer',
    title: 'Two of you edit at the same time',
    body: "Build a big workflow with the agent in parallel. Watch the graph assemble. Mention a node or reference another workflow. Point at an error and it fixes it. Comfy Agent is fully aware of what's happening on the canvas."
  },
  {
    tag: 'Control & Iterate',
    title: 'The craft stays yours',
    body: 'Every control ComfyUI gives you stays exactly where it is. You spend your time on composition, camera angles, masks, parameters, and polishing the details. Power users can always take over: open the nodes and check every single pixel.'
  },
  {
    tag: 'Local and Cloud',
    title: 'It runs where you run',
    body: 'Same agent, works with you on your local machine or in Comfy Cloud. It walks you through all setups, builds the workflows, and chooses models based on your hardware. It suggests environment and deployment solutions for your workflow and dependencies.'
  }
]
