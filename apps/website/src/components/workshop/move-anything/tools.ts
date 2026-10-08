import { Move, SquareDashed, WandSparkles } from '@lucide/vue'

export const MOVE_TOOLS = [
  { id: 'move', icon: Move, label: 'move.tool.move' },
  { id: 'smart', icon: WandSparkles, label: 'move.tool.smart' },
  { id: 'box', icon: SquareDashed, label: 'move.tool.box' }
] as const
