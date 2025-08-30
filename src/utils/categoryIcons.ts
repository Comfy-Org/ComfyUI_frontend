/**
 * Maps category IDs to their corresponding Lucide icon names
 */
export const getCategoryIcon = (categoryId: string): string => {
  const iconMap: Record<string, string> = {
    // Main categories
    all: 'list',
    'getting-started': 'graduation-cap',

    // Generation types
    'generation-image': 'image',
    image: 'image',
    'generation-video': 'film',
    video: 'film',
    'generation-3d': 'box',
    '3d': 'box',
    'generation-audio': 'volume-2',
    audio: 'volume-2',
    'generation-llm': 'message-square-text',

    // API and models
    'api-nodes': 'hand-coins',
    'closed-models': 'hand-coins',

    // LLMs and AI
    llm: 'message-square-text',
    llms: 'message-square-text',
    'llm-api': 'message-square-text',

    // Performance and hardware
    'small-models': 'zap',
    performance: 'zap',
    'mac-compatible': 'command',
    'runs-on-mac': 'command',

    // Training
    'lora-training': 'dumbbell',
    training: 'dumbbell',

    // Extensions and tools
    extensions: 'puzzle',
    tools: 'wrench',

    // Fallbacks for common patterns
    upscaling: 'maximize-2',
    controlnet: 'sliders-horizontal',
    'area-composition': 'layout-grid'
  }

  // Return mapped icon or fallback to folder
  return iconMap[categoryId.toLowerCase()] || 'folder'
}

/**
 * Maps category titles to their corresponding Lucide icon names
 */
export const getCategoryIconByTitle = (title: string): string => {
  const titleMap: Record<string, string> = {
    'Getting Started': 'graduation-cap',
    'Generation Type': 'sparkles',
    'Closed Source Models': 'hand-coins',
    'API Nodes': 'hand-coins',
    'Small Models': 'zap',
    Performance: 'zap',
    'Mac Compatible': 'command',
    'LoRA Training': 'dumbbell',
    Extensions: 'puzzle',
    'Tools & Building': 'wrench'
  }

  return titleMap[title] || 'folder'
}
