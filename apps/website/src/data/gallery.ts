export interface GalleryItem {
  id: string
  image?: string
  video?: string
  title: string
  userAlias: string
  teamAlias: string
  tool: string
  href?: string
  objectPosition?: string
  objectFit?: string
  /** Defaults to true. Set to false to hide this item from rendered lists. */
  visible?: boolean
}

const galleryItems: GalleryItem[] = [
  {
    id: 'until-our-eye-interlink-harajuku',
    video: 'https://media.comfy.org/videos/compressed_512/eye.webm',
    title: 'Until Our Eye Interlink harajuku',
    userAlias: 'ShaneF Motion Design',
    teamAlias: 'ThinkDiffusion',
    tool: 'ComfyUI',
    href: 'https://www.thinkdiffusion.com/studio#success-stories-anta'
  },
  {
    id: 'origins-kyrie-irving',
    video: 'https://media.comfy.org/videos/compressed_512/kyrie.webm',
    title: 'Origins - Kyrie Irving',
    userAlias: 'ShaneF Motion Design',
    teamAlias: 'ThinkDiffusion',
    tool: 'ComfyUI',
    href: 'https://vimeo.com/1021360563'
  },
  {
    id: 'neon-nights',
    video: 'https://media.comfy.org/videos/compressed_512/arcade.webm',
    title: 'Neon Nights',
    userAlias: 'ShaneF Motion Design',
    teamAlias: 'DOGSTUDIO/DEPT®',
    tool: 'ComfyUI',
    href: 'https://www.instagram.com/p/C1kG1oErzUV/'
  },
  {
    id: 'untitled-dusk-mountains',
    video: 'https://media.comfy.org/videos/compressed_512/dusk_mountains.webm',
    title: 'Untitled',
    userAlias: 'MidJourney man',
    teamAlias: 'DOGSTUDIO/DEPT®',
    tool: 'ComfyUI',
    href: 'https://www.instagram.com/midjourney.man/?hl=fr'
  },
  {
    id: 'autopoiesis',
    video: 'https://media.comfy.org/videos/compressed_512/cigarette.webm',
    title: 'Autopoiesis',
    userAlias: 'Yogo',
    teamAlias: 'Visual Frisson',
    tool: 'ComfyUI',
    href: 'https://www.instagram.com/visualfrisson/?hl=en'
  },
  {
    id: 'eat-it-dance',
    video:
      'https://media.comfy.org/videos/compressed_512/Eat%20It%20-%20Dance%20%5BWanAnimate%5D2.webm',
    title: 'Eat It - Dance',
    userAlias: 'Johana Lyu',
    teamAlias: 'Visual Frisson',
    tool: 'ComfyUI',
    href: 'https://www.joannalyu.com/'
  },
  {
    id: 'fall',
    video: 'https://media.comfy.org/videos/compressed_512/flower.webm',
    title: 'Fall',
    userAlias: 'Nathan Shipley',
    teamAlias: 'Visual Frisson',
    tool: 'ComfyUI',
    href: 'https://www.instagram.com/p/C3k9t_6vH5F/'
  },
  {
    id: 'untitled-buildings',
    video: 'https://media.comfy.org/videos/compressed_512/buildings.webm',
    title: 'Untitled',
    userAlias: 'Nathan Shipley',
    teamAlias: '',
    tool: 'ComfyUI',
    href: 'https://www.instagram.com/p/C6rEuJ4p9xU/'
  },
  {
    id: 'origami-world',
    video:
      'https://media.comfy.org/videos/compressed_512/origami_shortened.webm',
    title: 'Origami world',
    userAlias: 'Karen X',
    teamAlias: '',
    tool: 'ComfyUI',
    href: 'https://www.instagram.com/karenxcheng/'
  },
  {
    id: 'shot-on-instax',
    video: 'https://media.comfy.org/videos/compressed_512/biking.webm',
    title: 'Shot on InstaX',
    userAlias: 'Karen X',
    teamAlias: '',
    tool: 'ComfyUI',
    href: 'https://www.instagram.com/karenxcheng/'
  },
  {
    id: 'good-good-summer',
    video: 'https://media.comfy.org/videos/compressed_512/clouds.webm',
    title: "It's gonna be a good good summer",
    userAlias: 'Paul Trillo',
    teamAlias: '',
    tool: 'CogvideoX',
    href: 'https://vimeo.com/1019685900'
  },
  {
    id: 'ddu-du-ddu-du',
    video: 'https://media.comfy.org/videos/compressed_512/dududu.webm',
    title: 'DDU-DU DDU-DU',
    userAlias: 'Purz',
    teamAlias: 'Andidea',
    tool: 'Animatediff',
    href: 'https://vimeo.com/1019924290'
  },
  {
    id: 'cuco-love-letter-to-la',
    video: 'https://media.comfy.org/videos/compressed_512/paul_trillo.webm',
    title: 'Cuco - A Love Letter To LA',
    userAlias: 'Paul Trillo',
    teamAlias: 'CoffeeVectors',
    tool: 'ComfyUI',
    href: 'https://vimeo.com/1062859798'
  },
  {
    id: 'show-you-my-garden',
    video:
      'https://media.comfy.org/videos/compressed_512/chibi_fish_tank_shortened.webm',
    title: 'Show you my garden',
    userAlias: 'Paul Trillo',
    teamAlias: '',
    tool: 'CogvideoX',
    href: 'https://vimeo.com/1019685479'
  },
  {
    id: 'goodbye-beijing',
    video: 'https://media.comfy.org/videos/compressed_512/swings.webm',
    title: 'Goodbye Beijing',
    userAlias: 'Rui',
    teamAlias: 'makeitrad',
    tool: 'Animatediff',
    href: 'https://x.com/rui40000'
  },
  {
    id: 'animation-reel',
    video: 'https://media.comfy.org/videos/compressed_512/clouds_statue.webm',
    title: 'Animation Reel',
    userAlias: 'Andidea',
    teamAlias: '',
    tool: 'ComfyUI',
    href: 'https://www.youtube.com/watch?v=qu3eIQ1uln8'
  },
  {
    id: 'amber-astronaut',
    image: 'https://media.comfy.org/website/gallery/gallery.webp',
    title: 'Amber Astronaut',
    userAlias: 'Yogo',
    teamAlias: '',
    tool: 'ComfyUI',
    href: 'https://de.linkedin.com/in/milan-kastenmueller-18778a174'
  },
  {
    id: 'desert-landing',
    image: 'https://media.comfy.org/website/gallery/desert.webp',
    title: 'Desert Landing',
    userAlias: 'Yogo',
    teamAlias: '',
    tool: 'ComfyUI',
    href: 'https://de.linkedin.com/in/milan-kastenmueller-18778a174'
  }
]

export const visibleGalleryItems: GalleryItem[] = galleryItems.filter(
  (item) => item.visible !== false
)

/** @knipIgnoreUsedByStackedPR */
export function getGalleryItemById(id: string): GalleryItem | undefined {
  return galleryItems.find((item) => item.id === id)
}
