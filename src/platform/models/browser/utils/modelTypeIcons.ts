/**
 * Get icon class for a model type
 * Returns the appropriate lucide icon for the given model type
 */
export function getModelTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    CHECKPOINT: 'icon-[lucide--box]',
    LORA: 'icon-[lucide--layers]',
    VAE: 'icon-[lucide--cpu]',
    CONTROLNET: 'icon-[lucide--sliders-horizontal]',
    EMBEDDING: 'icon-[lucide--type]',
    UPSCALE: 'icon-[lucide--arrow-up]',
    'CLIP VISION': 'icon-[lucide--eye]',
    'IP-ADAPTER': 'icon-[lucide--image]',
    SAM: 'icon-[lucide--scissors]',
    DIFFUSION: 'icon-[lucide--sparkles]',
    ANIMATEDIFF: 'icon-[lucide--film]',
    'MOTION LORA': 'icon-[lucide--move]',
    AUDIO: 'icon-[lucide--music]',
    CLIP: 'icon-[lucide--text]',
    UNET: 'icon-[lucide--network]',
    GLIGEN: 'icon-[lucide--grid-3x3]',
    STYLE: 'icon-[lucide--palette]',
    PHOTOMAKER: 'icon-[lucide--camera]'
  }
  return icons[type] || 'icon-[comfy--ai-model]'
}
