import type { MotionNode, MotionWorkflow, Point } from './workflowMotion'

export type WorkflowGraphNode = MotionNode & {
  label: string
  height: number
  kind: 'landscape' | 'featured' | 'products' | 'processor'
  image?: string
  alt?: string
  video?: string
  loopVideo?: boolean
  poster?: string
  images?: { src: string; alt: string }[]
  extraPorts?: Point[]
}

export type WorkflowGraph = Omit<MotionWorkflow, 'nodes'> & {
  height: number
  nodes: WorkflowGraphNode[]
}
