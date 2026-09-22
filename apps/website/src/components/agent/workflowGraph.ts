import type { MotionNode, MotionWorkflow, Point } from './workflowMotion'

export type WorkflowGraphNode = MotionNode & {
  label: string
  height: number
  kind:
    | 'reference'
    | 'preview'
    | 'prompt'
    | 'result'
    | 'landscape'
    | 'featured'
    | 'products'
    | 'processor'
  image?: string
  alt?: string
  video?: string
  loopVideo?: boolean
  poster?: string
  pending?: string
  images?: { src: string; alt: string }[]
  extraPorts?: Point[]
}

export type WorkflowGraph = Omit<MotionWorkflow, 'nodes'> & {
  nodes: WorkflowGraphNode[]
}
