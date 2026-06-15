export type NavColumnItem = {
  label: string
  href: string
  badge?: 'new'
  external?: boolean
}

export type NavColumn = {
  header: string
  items: NavColumnItem[]
}

export type NavFeatured = {
  imageSrc: string
  imageAlt?: string
  title: string
  cta: {
    label: string
    ariaLabel?: string
    href: string
  }
}

export type NavItem =
  | {
      label: string
      columns: NavColumn[]
      featured?: NavFeatured
      href?: never
    }
  | { label: string; href: string; columns?: never; featured?: never }

export const mainNavigation: NavItem[] = [
  {
    label: 'Products',
    featured: {
      imageSrc:
        'https://media.comfy.org/website/customers/moment-factory/hero.webp',
      imageAlt: 'Moment Factory hero image',
      title: 'NEW RELEASE: SEEDANCE 2.0',
      cta: {
        label: 'Try Workflow',
        ariaLabel: 'Try the Seedance 2.0 new release Workflow',
        href: '#'
      }
    },
    columns: [
      {
        header: 'Products',
        items: [
          { label: 'Comfy Desktop', href: '/download' },
          { label: 'Comfy Cloud', href: '/cloud' },
          { label: 'Comfy API', href: '/api', badge: 'new' },
          { label: 'Comfy Enterprise', href: '/cloud/enterprise' }
        ]
      },
      {
        header: 'Features',
        items: [
          // TODO: no page yet — re-enable when landing pages ship
          // { label: 'MCP Server', href: '#', badge: 'new' },
          // { label: 'App Mode', href: '#' },
          // { label: 'Agent Skills', href: '#' },
          { label: 'Docs', href: 'https://docs.comfy.org/', external: true }
        ]
      }
    ]
  },
  { label: 'Pricing', href: '/pricing' },
  {
    label: 'Community',
    featured: {
      imageSrc:
        'https://media.comfy.org/website/customers/moment-factory/hero.webp',
      imageAlt: 'Latest release demo',
      title: 'LATEST RELEASE DEMO',
      cta: {
        label: 'Watch Now',
        ariaLabel: 'Watch the latest release demo',
        href: '#'
      }
    },
    columns: [
      {
        header: 'Programs',
        items: [
          { label: 'Comfy Hub', href: 'https://comfy.org/workflows' },
          { label: 'Gallery', href: '/gallery' }
        ]
      },
      {
        header: 'Connect',
        items: [
          {
            label: 'Discord',
            href: 'https://discord.com/invite/comfyorg',
            external: true
          },
          {
            label: 'GitHub',
            href: 'https://github.com/Comfy-Org/ComfyUI',
            external: true
          },
          {
            label: 'Youtube',
            href: 'https://www.youtube.com/@ComfyOrg',
            external: true
          },
          {
            label: 'Reddit',
            href: 'https://www.reddit.com/r/comfyui/',
            external: true
          },
          { label: 'X', href: 'https://x.com/ComfyUI', external: true },
          {
            label: 'Instagram',
            href: 'https://www.instagram.com/comfyui/',
            external: true
          }
        ]
      },
      {
        header: 'Solutions',
        items: [
          { label: 'Affiliates', href: '/affiliates', badge: 'new' },
          { label: 'Learning', href: '/learning', badge: 'new' }
        ]
      }
    ]
  },
  {
    label: 'Company',
    featured: {
      imageSrc:
        'https://media.comfy.org/website/customers/moment-factory/hero.webp',
      imageAlt: 'Meredith Binnet, Creative Director at Black Math',
      title: 'CUSTOMER STORY: BLACK MATH',
      cta: {
        label: 'Watch Now',
        ariaLabel: 'Watch the Black Math customer story',
        href: '#'
      }
    },
    columns: [
      {
        header: 'Company',
        items: [
          { label: 'About us', href: '/about' },
          { label: 'Careers', href: '/careers' }
        ]
      },
      {
        header: 'More',
        items: [
          { label: 'Customer Stories', href: '/customers' },
          // TODO: no /brand page yet
          // { label: 'Brand', href: '#' },
          { label: 'Contact', href: '/contact' },
          {
            label: 'Blog',
            href: 'https://blog.comfy.org/',
            external: true
          }
        ]
      }
    ]
  }
]
