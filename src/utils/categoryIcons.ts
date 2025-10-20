/**
 * Maps category IDs to their corresponding Lucide icon classes
 */
export const getCategoryIcon = (categoryId: string): string => {
  const iconMap: Record<string, string> = {
    // Main categories
    all: 'icon-[lucide--list]',
    'getting-started': 'icon-[lucide--graduation-cap]',

    // Generation types
    'generation-image': 'icon-[lucide--image]',
    image: 'icon-[lucide--image]',
    'generation-video': 'icon-[lucide--film]',
    video: 'icon-[lucide--film]',
    'generation-3d': 'icon-[lucide--box]',
    '3d': 'icon-[lucide--box]',
    'generation-audio': 'icon-[lucide--volume-2]',
    audio: 'icon-[lucide--volume-2]',
    'generation-llm': 'icon-[lucide--message-square-text]',

    // API and models
    'api-nodes': 'icon-[lucide--hand-coins]',
    'closed-models': 'icon-[lucide--hand-coins]',

    // LLMs and AI
    llm: 'icon-[lucide--message-square-text]',
    llms: 'icon-[lucide--message-square-text]',
    'llm-api': 'icon-[lucide--message-square-text]',

    // Performance and hardware
    'small-models': 'icon-[lucide--zap]',
    performance: 'icon-[lucide--zap]',
    'mac-compatible': 'icon-[lucide--command]',
    'runs-on-mac': 'icon-[lucide--command]',

    // Training
    'lora-training': 'icon-[lucide--dumbbell]',
    training: 'icon-[lucide--dumbbell]',

    // Extensions and tools
    extensions: 'icon-[lucide--puzzle]',
    tools: 'icon-[lucide--wrench]',

    // Fallbacks for common patterns
    upscaling: 'icon-[lucide--maximize-2]',
    controlnet: 'icon-[lucide--sliders-horizontal]',
    'area-composition': 'icon-[lucide--layout-grid]'
  }

  // Return mapped icon or fallback to folder
  return iconMap[categoryId.toLowerCase()] || 'icon-[lucide--folder]'
}
