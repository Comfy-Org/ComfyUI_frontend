import type {
  ModelLaunchMedia,
  ModelLaunchPage
} from '../templates/model-launch/types'

import { externalLinks } from '../config/routes'

// Reference-to-video is the workflow people reach for first (Zhixiong), so every
// "run Seedance" CTA opens that one on Cloud. The free-draft CTA in the steps
// section points at Wan 2.2 instead, which is open source and costs nothing.
const seedanceLinks = {
  cloudRun: 'https://cloud.comfy.org/?template=api_seedance2_5_r2v',
  freeDraft: 'https://cloud.comfy.org/?template=video_wan2_2_14B_t2v',
  // The hub's Seedance family page, which lists the shipped 2.5 workflows
  // (text to video, reference to video, first-last frame and the rest). The
  // "try workflows" CTA pointed at the hub root, which makes the reader find
  // them, the same fix /ltx-2.5 already carries.
  hubModel: `${externalLinks.workflows}/model/seedance`
} as const

// Seedance 2.5 renders, encoded to the site's web video profile (VP9 webm,
// 1200px wide, muted) and served from media.comfy.org. Each poster is the clip's
// own first frame, except `grass`, which opens on black and fades up, so its
// poster is taken from 0.7s in.
const media = {
  hero: {
    kind: 'video',
    src: 'https://media.comfy.org/website/seedance-2.5/hero.mp4',
    posterSrc: 'https://media.comfy.org/website/seedance-2.5/hero-poster.webp'
  },
  balloons: {
    kind: 'video',
    src: 'https://media.comfy.org/website/seedance-2.5/balloons.webm',
    posterSrc:
      'https://media.comfy.org/website/seedance-2.5/balloons-poster.webp'
  },
  grass: {
    kind: 'video',
    src: 'https://media.comfy.org/website/seedance-2.5/grass.webm',
    posterSrc: 'https://media.comfy.org/website/seedance-2.5/grass-poster.webp'
  },
  worldcup: {
    kind: 'video',
    src: 'https://media.comfy.org/website/seedance-2.5/worldcup.webm',
    posterSrc:
      'https://media.comfy.org/website/seedance-2.5/worldcup-poster.webp'
  },
  city: {
    kind: 'video',
    src: 'https://media.comfy.org/website/seedance-2.5/city.webm',
    posterSrc: 'https://media.comfy.org/website/seedance-2.5/city-poster.webp'
  },
  shark: {
    kind: 'video',
    src: 'https://media.comfy.org/website/seedance-2.5/shark.webm',
    posterSrc: 'https://media.comfy.org/website/seedance-2.5/shark-poster.webp'
  },
  giraffe: {
    kind: 'video',
    src: 'https://media.comfy.org/website/seedance-2.5/giraffe.webm',
    posterSrc:
      'https://media.comfy.org/website/seedance-2.5/giraffe-poster.webp'
  }
} as const satisfies Record<string, ModelLaunchMedia>

// Every gallery card on this page is the same model at the same tier behind the
// same workflow link; only the shot changes. Stating that identity once keeps a
// future change to the tier or link a single edit. Spreading the clip last lets
// any one of them override a field if the set starts to diverge.
const sharedCardIdentity = {
  name: { en: 'Seedance 2.5', 'zh-CN': 'Seedance 2.5' },
  tier: 'premium',
  note: { en: 'Pay-as-you-go', 'zh-CN': '按量付费' },
  href: seedanceLinks.cloudRun
} as const

// The prompt behind each clip, exactly as it was run.
const BALLOONS_PROMPT = `Animals crossing a rainy city street at dusk, holding up floating gold foil balloons that spell SEEDANCE 2.5. A bear, a giraffe, and a fox walk the wet crosswalk together, each gripping balloon strings. After the letters, a gold foil balloon shaped like the Comfy logo drifts into frame. Intercut between a POV through the car windshield with wipers and a shot from outside looking into the car, where a sloth sits at the steering wheel. Umbrellas, traffic lights, rain reflections, cinematic 16:9, natural handheld motion.`

const GRASS_PROMPT = `Start in a dark surreal outdoor office corridor; lights turn on one by one, gradually revealing that the space is enormous. Cut to a close action sequence following an older man pushing a red lawnmower across a lush green lawn that covers the courtyard floor. Camera tracks him tightly from behind and beside. Then the camera rises up into a high-angle overhead shot of the courtyard: mowed into the grass in dry straw-colored lettering, SEEDANCE on top, 2.5 centered below it, and the Comfy logo underneath with clear space between 2.5 and the logo, 16:9.`

const WORLDCUP_PROMPT = `Handheld shot inside a packed Brazilian soccer stadium at night. The camera finds a fan in a yellow jersey holding up a handmade cardboard sign with black marker handwriting that reads SEEDANCE 2.5 on top. The camera pans across the cheering crowd and lands on another fan holding a second cardboard sign with the Comfy logo drawn on it in marker. Brazilian flags waving, stadium lights, shallow depth of field, energetic documentary feel, 16:9.`

const CITY_PROMPT = `Cool blue dusk lighting at the start, the same four people sitting and standing outside a café on a city sidewalk, warm lit windows behind them, chatting and laughing, drinking coffee, holding their same general positions but full of lively, animated physical movement — leaning in and back, gesturing broadly with their hands, shifting in their seats, turning to look at each other, genuinely active and expressive rather than mostly still. Partway through the shot, the scene cuts hard and instantly to a new setting with a fun, playful, almost cheeky snap — no blend, no dissolve, just a sudden, bouncy pop-cut, like a magic trick — the same four people now in warm, golden late-afternoon sunlight, seated in the same relative positions at a charming French bistro with a green awning, colorful flower pots, warm string lights, and cobblestone underfoot. No additional or new people appear at any point — only the original four throughout. The instant the cut happens, all four people react with visible confusion — pausing mid-gesture, glancing around at their unfamiliar new surroundings, exchanging puzzled looks with each other, one or two double-taking or squinting at the sudden change in light, before their conversation slowly resumes. Ambient café chatter and city sounds abruptly cut and restart at the pop-cut moment, a beat of surprised murmurs and puzzled “huh?” reactions, followed by a bright, playful whoosh-pop sound and a cheerful little musical sting marking the fun, sudden transition.

Cool blue dusk lighting, warm amber glow from building windows and streetlights against a cooling blue sky, moody late-afternoon color grade. A narrow city street with brick buildings, fire escapes, and a crosswalk, an exact, fixed number of pedestrians going about their day — no additional or duplicate people appear at any point during the shot. A single white 3D cursor, matte and solid with no glow, no light emission, and no trail of any kind, flies around energetically for the entire shot, remaining visible in every frame from start to finish — it never fades, disappears, or drops out of frame for even a moment. It moves toward a specific person or object, slows and hovers directly over it, and clicks — a clear, precise contact moment. Only at the exact instant of that click does the touched person or object transform into something beach-related — sunglasses, inflatable rings, beach balls, sandcastles, surfboards, tropical drinks — popping into place immediately upon contact, never before it. After each transformation completes, the cursor moves on to its next target and repeats the same hover-then-click sequence, each transformation strictly triggered by its own individual click rather than happening on its own. Fast, lively camera movement following the action. Upbeat, playful sound design — clicks, pops, whooshes, and cheerful ambient chatter and laughter as people react to their new beach gear.

Cool cyan-teal color grade, high contrast, aerial view looking down through a window frame onto a busy city street intersection far below, framed by the dark window edges at the bottom of shot. Handheld camera with natural drift and subtle sway throughout. There is only ever one single cursor visible in the entire shot at all times — no duplicates or additional instances. A giant white 3D arrow cursor, matte and solid with no glow or trail, begins high in the sky already oriented tip-down, pointed end facing directly downward toward the street, and descends rapidly in that tip-first orientation, remaining oriented so its pointed tip always faces the exact direction it is currently traveling. It moves the way a real computer cursor moves — sharp, precise, and deliberate, snapping directly toward its target rather than drifting or floating. Traffic moves through the intersection below, including a yellow taxi. The cursor descends directly onto the taxi, tip-first, snapping into place and touching down in a sharp, exact click. The instant contact is made, the cursor immediately reorients tip-first and snaps away first, moving off in a fast, direct trajectory as if already searching for its next target, tip leading the way, no pause or lingering over the click point. Only after the cursor has already begun moving away does the taxi complete its transformation into a large rat, the morph playing out behind the departing cursor, scaled to match the taxi’s former footprint. The rat then begins moving — turning and scurrying quickly across the crosswalk — while the cursor continues on ahead, tip-first, scanning onward across the scene. Distant city ambience, traffic hum, a sharp digital click/chime sound as the cursor makes contact, a fast whoosh as the cursor snaps away, a quick glitch/transformation zap as the morph completes just behind it, and scurrying/scratching sounds as the rat moves off.

Shot of the manhole cover, people start to walk over it

Add the white 3D arrow cursor from the reference image into this video, exactly matching the reference image’s shape and appearance — a simple solid pointer arrow with a flat triangular head and rectangular tail, matte and clean, not emitting light or glow of any kind. No trail, no streaks, no wings, no dust, no particles, no light effects attached to or trailing behind the cursor — just the plain solid cursor itself moving through the scene, nothing else added. For most of the shot, give it constant, restless, highly energetic movement — never traveling in a straight line for more than a moment, instead darting and weaving in tight, unpredictable zig-zags and loops across the full width of the frame, bouncing up and down erratically, spinning rapidly and continuously as it changes direction again and again, like it’s excited and can barely hold still. Its pointed tip must always remain oriented forward, facing the direction of travel, never sideways or backward, regardless of how much it spins or moves. In the final second of the shot, the cursor rapidly breaks apart and disintegrates — crumbling into small fragments and dissolving away completely, vanishing from the frame by the very last frame. Scale the cursor up gradually to match the perspective as the camera moves forward down the street. Keep all existing motion, timing, environment, and transformation in the video unchanged — only the cursor is being added.

Bright sunny beach scene, warm natural daylight, gentle ocean breeze. A woman sits in a lounge chair under a striped umbrella, initially facing forward toward camera, typing on a laptop resting on her legs. The camera slowly and smoothly orbits around behind her over the course of the shot, rotating from a front-facing angle to a view from behind her shoulder, revealing the ocean and horizon ahead of her. As the camera completes its rotation, she closes the laptop, sets it aside, and leans back in the chair, raising both arms up and resting her hands behind her head in a relaxed, contented pose. Simultaneously, in the sky above the ocean, wispy clouds gradually drift and gather together, softly forming the shape of readable cursive text spelling “Comfy” against the blue sky, the letters emerging gently and naturally as if drawn by the clouds themselves. Gentle ocean waves rolling in, soft ambient beach sounds, a light breeze, the faint clatter of the laptop closing, a soft contented exhale as she leans back.

Cool cyan-teal color grade, high contrast, handheld camera looking straight up a narrow city canyon between towering skyscrapers toward a bright sky, subtle natural handheld sway and micro-shake, no deliberate camera push or pan. A small, sharp, glowing white 3D arrow/cursor hangs high and distant in the sky between the buildings, holding still and small for a beat before beginning its descent. It starts to fall, drifting gently from side to side as it descends, a light, subtle sway rather than a dramatic tumble, gaining speed as it descends toward the camera, growing larger and closer. Natural motion blur and light trailing streaks build dynamically from the increasing speed of the fall — sharp and undistorted at the start, streaked and blurred by the end from genuine velocity, trailing behind the gently drifting path. Small debris and fragments shake loose and scatter outward as it nears, glossy surface flaring with light. Fast rising whoosh and wind rush building in intensity, mechanical rumble, scattered falling debris impacts, rising tension in the sound design as the descent accelerates toward the final moment.`

const SHARK_PROMPT = `Scene 1 (0–3s): Extreme close-up from the first-person perspective. A human hand holds a bright orange flying frisbee in the foreground. The camera looks downward toward an excited beige Labrador standing on the beach, tail wagging rapidly, panting happily, eyes locked on the frisbee. Ocean waves gently roll in behind the dog.

Scene 2 (3–6s): The hand throws the frisbee in a smooth arc from the sandy shoreline toward the open ocean. The camera follows the frisbee briefly before tracking the Labrador sprinting and launching into the surf, splashing dramatically through breaking waves with determination.

Scene 3 (6–9s): Farther offshore in deeper blue water, the Labrador successfully catches the frisbee in its mouth. Only the dog's head and upper neck remain above the water while it swims back. Several seagulls float calmly on the water nearby while others glide overhead. Peaceful, cinematic atmosphere.

Scene 4 (9–12s): Without warning, a massive great white shark erupts powerfully out of the ocean behind the dog, creating an enormous splash. The seagulls instantly scatter into the sky in panic. The Labrador freezes, eyes wide, ears back, visibly startled while still holding the frisbee.

Scene 5 (12–15s): Dramatic slow-motion cinematic close-up. The giant shark lunges forward and bites only the frisbee—not the dog. The Labrador safely swims out of frame. The camera zooms tightly onto the shark's jaws gripping the orange frisbee. The logo "SEEDANCE 2.5" is printed clearly in bold white letters across the center of the frisbee and remains sharp and fully legible for the final second. Epic movie-quality ending, ultra-realistic detail.`

const GIRAFFE_PROMPT = `A calm and inspiring video of an adventurous giraffe riding a motorcycle, jumping into a ring of fire, swimming with sharks and jumping from an airplane with parachutes.
[0:00-0:08] A beautiful and inspiring drone shot of a highway located on a beautiful place with great views, camera gets closer slow and we see the giraffe happily riding its motorcycle. The giraffe jump off the motorcycle into a ring of fire.
[0:08-0:11] Jump cut and the swimming with 3 sharks.
[0:11-0:13] Jump cut and we see a close-up giraffe face falling from the sky, with a lot of wind blowing on her face.
[0:13-0:14] Jump cut to a distant shot that reveals the giraffe was skydiving, the parachute opens.
[0:14-0:17] The camera pans to the top as we can see the blue sky with clouds that form the words "SEEDANCE 2.5" in the sky, then the clouds reorganize themselves and form Comfy's logo (also made of clouds)
vibrant color grading, inspiring, cinematic motion blur, hyper-realistic, consistent character and motorcycle in each time segment, no outfit mixing, no off-model details, sharp focus on the giraffe features  in every frame.`

const clips = [
  {
    id: 'balloons',
    media: media.balloons,
    prompt: { en: BALLOONS_PROMPT, 'zh-CN': BALLOONS_PROMPT },
    description: {
      en: 'Animals crossing a rain-slick city street under balloon letters.',
      'zh-CN': '动物们走过雨后的城市街道，身后是巨大的气球字母。'
    }
  },
  {
    id: 'grass',
    media: media.grass,
    prompt: { en: GRASS_PROMPT, 'zh-CN': GRASS_PROMPT },
    description: {
      en: 'A meadow running down the middle of an empty office floor.',
      'zh-CN': '一片草地从空荡的办公楼中间蔓延开来。'
    }
  },
  {
    id: 'worldcup',
    media: media.worldcup,
    prompt: { en: WORLDCUP_PROMPT, 'zh-CN': WORLDCUP_PROMPT },
    description: {
      en: 'A packed stadium crowd, shot handheld from the stands.',
      'zh-CN': '看台上人声鼎沸的球迷，手持镜头拍摄。'
    }
  },
  {
    id: 'city',
    media: media.city,
    prompt: { en: CITY_PROMPT, 'zh-CN': CITY_PROMPT },
    description: {
      en: 'A close pass over a wet city street at ground level.',
      'zh-CN': '贴近地面掠过湿漉漉的城市路面。'
    }
  },
  {
    id: 'shark',
    media: media.shark,
    prompt: { en: SHARK_PROMPT, 'zh-CN': SHARK_PROMPT },
    description: {
      en: 'A dog fetching a frisbee as a shark breaches behind it.',
      'zh-CN': '狗狗叼回飞盘，身后鲨鱼破浪跃起。'
    }
  },
  {
    id: 'giraffe',
    media: media.giraffe,
    prompt: { en: GIRAFFE_PROMPT, 'zh-CN': GIRAFFE_PROMPT },
    description: {
      en: 'A giraffe clearing a ring of fire in a single leap.',
      'zh-CN': '一只长颈鹿一跃穿过熊熊火圈。'
    }
  }
] as const

export const seedancePage: ModelLaunchPage = {
  metaTitleKey: 'seedance.meta.title',
  metaDescriptionKey: 'seedance.meta.description',
  breadcrumbLabelKey: 'seedance.breadcrumb.model',
  breadcrumbUpdatedKey: 'seedance.breadcrumb.updated',
  hero: {
    layout: 'content-first',
    videoSrc: media.hero.src,
    posterSrc: media.hero.posterSrc,
    badgeKeys: [
      'seedance.hero.tagPartnerNode',
      'seedance.hero.tagImageToVideo',
      'seedance.hero.tagTextToVideo'
    ],
    promptBar: {
      sampleKey: 'seedance.hero.promptSample',
      cta: {
        labelKey: 'seedance.hero.promptCta',
        href: seedanceLinks.cloudRun,
        target: '_blank'
      }
    },
    titleKey: 'seedance.hero.title',
    descriptionKey: 'seedance.hero.description',
    primaryCta: {
      labelKey: 'seedance.hero.primaryCta',
      href: seedanceLinks.cloudRun,
      target: '_blank'
    },
    secondaryCta: {
      labelKey: 'seedance.hero.secondaryCta',
      href: seedanceLinks.hubModel,
      target: '_blank'
    }
  },
  gallery: {
    headingKey: 'seedance.models.heading',
    ctaVariant: 'accent',
    cards: clips.map((clip) => ({ ...sharedCardIdentity, ...clip }))
  },
  pricing: {
    defaultBillingCycle: 'monthly',
    banner: {
      titleKey: 'seedance.pricing.banner.title',
      subtitleKey: 'seedance.pricing.banner.subtitle',
      cta: {
        labelKey: 'seedance.pricing.banner.cta',
        href: externalLinks.cloud,
        target: '_blank'
      }
    }
  },
  faq: {
    headingKey: 'seedance.faq.heading',
    items: [
      {
        id: 'what-is-seedance',
        question: {
          en: 'What is Seedance 2.5?',
          'zh-CN': 'Seedance 2.5 是什么？'
        },
        answer: {
          en: "ByteDance's cinematic video model. Give it a text prompt or a reference image and it renders the shot with native audio. On Comfy you direct it on the canvas alongside every other model.",
          'zh-CN':
            '字节跳动的电影级视频模型。给它一段文本提示或一张参考图，它就能渲染出带原生音频的镜头。在 Comfy 上，你可以在画布上与其他模型一起执导它。'
        }
      },
      {
        id: 'whats-new-in-25',
        question: {
          en: "What's new in Seedance 2.5 vs Seedance 2.0?",
          'zh-CN': 'Seedance 2.5 相比 Seedance 2.0 有哪些新变化？'
        },
        answer: {
          en: 'Longer native clips and support for many more reference inputs than 2.0.',
          'zh-CN': '更长的原生片段，以及比 2.0 多得多的参考输入支持。'
        }
      },
      {
        id: 'run-in-comfyui',
        question: {
          en: 'How do I run Seedance 2.5 in ComfyUI?',
          'zh-CN': '如何在 ComfyUI 中运行 Seedance 2.5？'
        },
        answer: {
          en: 'Open a Seedance workflow template, or add Seedance to any workflow on the canvas. It runs on Comfy Cloud, so you do not need a local GPU.',
          'zh-CN':
            '打开 Seedance 工作流模板，或将 Seedance 添加到画布上的任意工作流中。它在 Comfy Cloud 上运行，因此你不需要本地 GPU。'
        }
      },
      {
        id: 'clip-length',
        question: {
          en: 'How long can Seedance 2.5 videos be?',
          'zh-CN': 'Seedance 2.5 能生成多长的视频？'
        },
        answer: {
          en: 'Up to 30 seconds natively, and you can chain shots on the canvas when you need a longer cut.',
          'zh-CN':
            '最长可原生生成 30 秒。需要更长的成片时，你可以在画布上串联多个镜头。'
        }
      },
      {
        id: 'native-audio',
        question: {
          en: 'Does Seedance 2.5 generate audio?',
          'zh-CN': 'Seedance 2.5 会生成音频吗？'
        },
        answer: {
          en: 'Yes. Dialogue, music and sound effects are generated with the frame, so you do not have to score the clip afterwards.',
          'zh-CN':
            '会。对白、音乐和音效会与画面一同生成，你无需事后再单独配乐配音。'
        }
      },
      {
        id: 'is-it-free',
        question: {
          en: 'Is Seedance 2.5 free to use?',
          'zh-CN': 'Seedance 2.5 可以免费使用吗？'
        },
        answer: {
          en: 'Seedance runs on pay-as-you-go or subscription credits. You can draft the same shot free on Wan 2.2 first, and spend credits only on the final render.',
          'zh-CN':
            'Seedance 采用按量付费或订阅积分。你可以先在 Wan 2.2 上免费打样同一镜头，只在最终渲染时消耗积分。'
        }
      },
      {
        id: 'commercial-use',
        question: {
          en: 'Can I use the videos commercially?',
          'zh-CN': '视频可以商用吗？'
        },
        answer: {
          en: 'Yes. Renders include commercial use and carry no watermark.',
          'zh-CN': '可以。渲染结果包含商业使用授权，且不带水印。'
        }
      }
    ]
  },
  steps: {
    headingKey: 'seedance.steps.heading',
    stepLabelKey: 'seedance.steps.step',
    items: [
      {
        id: 'write-the-shot',
        title: { en: 'Write the shot', 'zh-CN': '写下你的镜头' },
        description: {
          en: 'Camera, subject, framing',
          'zh-CN': '运镜、主体、构图'
        }
      },
      {
        id: 'draft-free',
        title: {
          en: 'Draft free on other models',
          'zh-CN': '先用其他模型免费打样'
        },
        description: {
          en: 'Same workflow, zero credits',
          'zh-CN': '同一工作流，零积分消耗'
        }
      },
      {
        id: 'switch-to-seedance',
        title: {
          en: 'Switch to Seedance 2.5',
          'zh-CN': '切换到 Seedance 2.5'
        },
        description: {
          en: 'Final render, native audio',
          'zh-CN': '最终渲染，原生音频'
        }
      }
    ],
    primaryCta: {
      labelKey: 'seedance.steps.primaryCta',
      href: seedanceLinks.freeDraft,
      target: '_blank'
    },
    secondaryCta: {
      labelKey: 'seedance.steps.secondaryCta',
      href: seedanceLinks.cloudRun,
      target: '_blank'
    }
  },
  runOptions: {
    headingKey: 'seedance.runOptions.heading',
    subtitleKey: 'seedance.runOptions.subtitle',
    ctaKey: 'seedance.runOptions.cta'
  },
  reviews: {
    headingKey: 'seedance.reviews.heading',
    highlight: {
      titleKey: 'seedance.reviews.highlightTitle',
      descriptionKey: 'seedance.reviews.highlightDescription',
      ctaKey: 'seedance.reviews.highlightCta'
    }
  }
}
