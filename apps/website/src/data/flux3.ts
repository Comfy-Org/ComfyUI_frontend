import type {
  ModelLaunchMedia,
  ModelLaunchPage
} from '../templates/model-launch/types'

import { externalLinks } from '../config/routes'

// Flux 3 launch footage, encoded to the site's web video profile and served
// from media.comfy.org. Posters are pending: add each clip's `posterSrc` once
// the stills reach the CDN.
const media = {
  hero: {
    kind: 'video',
    src: 'https://media.comfy.org/website/flux-3/hero.mp4'
  },
  card1: {
    kind: 'video',
    src: 'https://media.comfy.org/website/flux-3/card-1.webm'
  },
  card2: {
    kind: 'video',
    src: 'https://media.comfy.org/website/flux-3/card-2.webm'
  },
  card3: {
    kind: 'video',
    src: 'https://media.comfy.org/website/flux-3/card-3.webm'
  },
  card4: {
    kind: 'video',
    src: 'https://media.comfy.org/website/flux-3/card-4.webm'
  },
  card5: {
    kind: 'video',
    src: 'https://media.comfy.org/website/flux-3/card-5.webm'
  },
  card6: {
    kind: 'video',
    src: 'https://media.comfy.org/website/flux-3/card-6.webm'
  }
} as const satisfies Record<string, ModelLaunchMedia>

export const flux3Page: ModelLaunchPage = {
  metaTitleKey: 'flux3.meta.title',
  metaDescriptionKey: 'flux3.meta.description',
  breadcrumbLabelKey: 'flux3.breadcrumb.model',
  breadcrumbUpdatedKey: 'flux3.breadcrumb.updated',
  hero: {
    videoSrc: media.hero.src,
    titleKey: 'flux3.hero.title',
    titleRestKey: 'flux3.hero.titleRest',
    descriptionKey: 'flux3.hero.description',
    primaryCta: {
      labelKey: 'flux3.hero.primaryCta',
      href: externalLinks.cloud,
      target: '_blank'
    },
    secondaryCta: {
      labelKey: 'flux3.hero.secondaryCta',
      href: externalLinks.workflows,
      target: '_blank'
    },
    badgeKeys: ['flux3.hero.tagPartnerNodes', 'flux3.hero.tagOpenWeightsSoon']
  },
  gallery: {
    headingKey: 'flux3.models.heading',
    cards: [
      {
        id: 'lake-valley',
        name: { en: 'Flux 3', 'zh-CN': 'Flux 3', ja: 'Flux 3' /* machine */ },
        tier: 'premium',
        note: {
          en: 'Pay-as-you-go',
          'zh-CN': '按量付费',
          ja: '従量課金' /* machine */
        },
        description: {
          en: 'A peaceful pixelated lake valley holds every detail as the camera pushes in.',
          'zh-CN': '宁静的像素风湖谷，镜头推进时每个细节都清晰保留。',
          ja: '穏やかなピクセル調の湖畔の谷を、カメラが寄っていきながら細部まで捉えます。' /* machine */
        },
        media: media.card1,
        href: externalLinks.workflows
      },
      {
        id: 'three-dancers',
        name: { en: 'Flux 3', 'zh-CN': 'Flux 3', ja: 'Flux 3' /* machine */ },
        tier: 'premium',
        note: {
          en: 'Pay-as-you-go',
          'zh-CN': '按量付费',
          ja: '従量課金' /* machine */
        },
        description: {
          en: 'Three dancers, three rooms, one rhythm, timing locked across every panel.',
          'zh-CN': '三位舞者、三个房间、同一个节奏，每一格画面的节拍都锁得住。',
          ja: '3人のダンサー、3つの部屋、1つのリズム。すべてのパネルでタイミングが揃う。' /* machine */
        },
        media: media.card2,
        href: externalLinks.workflows
      },
      {
        id: 'porcelain',
        name: { en: 'Flux 3', 'zh-CN': 'Flux 3', ja: 'Flux 3' /* machine */ },
        tier: 'premium',
        note: {
          en: 'Pay-as-you-go',
          'zh-CN': '按量付费',
          ja: '従量課金' /* machine */
        },
        description: {
          en: 'Shattered porcelain reassembles on white, every fragment tracked in reverse.',
          'zh-CN': '碎裂的青花瓷在白色背景上复原，每一片碎片都被倒放追踪。',
          ja: '砕けた磁器が白い背景の上で元に戻り、すべての破片を逆再生で追います。' /* machine */
        },
        media: media.card3,
        href: externalLinks.workflows
      },
      {
        id: 'drone-transition',
        name: { en: 'Flux 3', 'zh-CN': 'Flux 3', ja: 'Flux 3' /* machine */ },
        tier: 'premium',
        note: {
          en: 'Pay-as-you-go',
          'zh-CN': '按量付费',
          ja: '従量課金' /* machine */
        },
        description: {
          en: 'A drone crosses from one environment to the next.',
          'zh-CN': '无人机从一个场景穿越到下一个场景。',
          ja: 'ドローンがある環境から次の環境へ移動します。' /* machine */
        },
        media: media.card4,
        href: externalLinks.workflows
      },
      {
        id: 'outlaws',
        name: { en: 'Flux 3', 'zh-CN': 'Flux 3', ja: 'Flux 3' /* machine */ },
        tier: 'premium',
        note: {
          en: 'Pay-as-you-go',
          'zh-CN': '按量付费',
          ja: '従量課金' /* machine */
        },
        description: {
          en: 'Outlaws ride into town, hooves and crowd noise with the frame.',
          'zh-CN': '匪徒骑马进城，马蹄声与人群嘈杂声随画面同步生成。',
          ja: '無法者たちが町へ乗り込み、蹄の音と群衆のざわめきが画面に重なります。' /* machine */
        },
        media: media.card5,
        href: externalLinks.workflows
      },
      {
        id: 'bear-checkpoint',
        name: { en: 'Flux 3', 'zh-CN': 'Flux 3', ja: 'Flux 3' /* machine */ },
        tier: 'premium',
        note: {
          en: 'Pay-as-you-go',
          'zh-CN': '按量付费',
          ja: '従量課金' /* machine */
        },
        description: {
          en: 'A bear closes in at the checkpoint, game-engine look held steady.',
          'zh-CN': '一头熊在检查站前逼近，游戏引擎般的质感稳定统一。',
          ja: 'クマが検問所に迫り、ゲームエンジン風のルックを一貫して維持します。' /* machine */
        },
        media: media.card6,
        href: externalLinks.workflows
      }
    ]
  },
  pricing: {
    // The Figma opens this page on monthly, as /minimax does.
    defaultBillingCycle: 'monthly',
    banner: {
      titleKey: 'flux3.pricing.banner.title',
      subtitleKey: 'flux3.pricing.banner.subtitle',
      cta: {
        labelKey: 'flux3.pricing.banner.cta',
        href: externalLinks.cloud,
        target: '_blank'
      }
    }
  },
  faq: {
    headingKey: 'flux3.faq.heading',
    items: [
      {
        id: 'prompt-syntax',
        question: {
          en: 'Do I need special prompt syntax or keywords for Flux 3?',
          'zh-CN': 'Flux 3 需要特殊的提示词语法或关键词吗？',
          ja: 'Flux 3に特別なプロンプト構文やキーワードは必要ですか？' /* machine */
        },
        answer: {
          en: 'No. Flux 3 interprets and rewrites your prompt before generation, so plain language works. Describe the scene the way you would brief a colleague. Keyword stacking and caption-style prose add nothing.',
          'zh-CN':
            '不需要。Flux 3 会在生成前理解并改写你的提示词，因此用日常语言就可以。像给同事交代拍摄需求那样描述画面即可。堆砌关键词或写成图注式短语没有额外帮助。',
          ja: 'いいえ。Flux 3は生成前にプロンプトを解釈して書き換えるため、自然な文章で問題ありません。同僚に指示するようにシーンを説明してください。キーワードの羅列やキャプション調の文章は効果を高めません。' /* machine */
        }
      },
      {
        id: 'prompt-rewriting',
        question: {
          en: 'Does Flux 3 change my prompt? Will it override what I asked for?',
          'zh-CN': 'Flux 3 会改写我的提示词吗？会不会覆盖我的要求？',
          ja: 'Flux 3はプロンプトを変更しますか？指定内容は上書きされますか？' /* machine */
        },
        answer: {
          en: "It rewrites, but the rewrite preserves what you explicitly specify. The more precisely you describe a scene, the more of the output is your call rather than the model's. Vague prompts hand control to the rewriter.",
          'zh-CN':
            '它会改写，但你明确指定的内容会被保留。你对画面描述得越精确，成片就越由你决定，而不是由模型决定。含糊的提示词等于把控制权交给改写环节。',
          ja: '書き換えは行われますが、明示した内容は維持されます。シーンを具体的に記述するほど、出力はモデル任せではなく、自分で決められる部分が増えます。曖昧なプロンプトでは、書き換え側に主導権が渡ります。' /* machine */
        }
      },
      {
        id: 'burned-in-text',
        question: {
          en: 'Why is my text appearing burned into the video instead of being spoken?',
          'zh-CN': '为什么我的文字变成了画面上的字幕，而不是被念出来？',
          ja: 'テキストがセリフではなく、動画に焼き付いた表示になるのはなぜですか？' /* machine */
        },
        answer: {
          en: 'Quoted text without a visible speaker tends to render as on-screen text. To get a spoken line: quote the line, describe a speaker visible on camera, and add "no on-screen text, no subtitles".',
          'zh-CN':
            '如果引号中的文字没有对应的出镜说话者，通常会被渲染成画面文字。想要念出来的台词：把台词放在引号里，描述一个出现在镜头中的说话者，并加上 "no on-screen text, no subtitles"。',
          ja: '話者が画面に見えない引用文は、画面上のテキストとして表示されがちです。セリフとして話させるには、セリフを引用し、カメラに映る話者を説明したうえで、「画面上のテキストなし、字幕なし」と追加してください。' /* machine */
        }
      },
      {
        id: 'audio-control',
        question: {
          en: 'How do I control audio in Flux 3?',
          'zh-CN': '如何控制 Flux 3 的音频？',
          ja: 'Flux 3で音声をコントロールするには？' /* machine */
        },
        answer: {
          en: 'Describe audio in layers and name each one separately: ambient sound, music, and speech. Each lands as its own layer. Lumping them into one phrase gives you less control over the mix.',
          'zh-CN':
            '把音频分层描述，并分别点名：环境音、音乐、人声。每一项都会作为独立的音轨生成。把它们塞进一句话里，会让你对混音的控制变弱。',
          ja: '環境音、音楽、セリフのように、音声をレイヤーごとに分けて個別に指定してください。それぞれ独立したレイヤーになります。1つのフレーズにまとめると、ミックスのコントロールが弱まります。' /* machine */
        }
      },
      {
        id: 'multi-shot',
        question: {
          en: 'Can Flux 3 generate multiple shots in one generation?',
          'zh-CN': 'Flux 3 能在一次生成里输出多个镜头吗？',
          ja: 'Flux 3は1回の生成で複数のショットを作れますか？' /* machine */
        },
        answer: {
          en: 'Yes. Structure the prompt as "SHOT ONE ... HARD CUT. SHOT TWO ..." and it produces real cuts inside a single generation. For an uncut take, ask explicitly for "one continuous unbroken shot".',
          'zh-CN':
            '可以。把提示词写成 "SHOT ONE ... HARD CUT. SHOT TWO ..." 的结构，它就会在一次生成中产生真正的剪切点。如果要一镜到底，请明确写出 "one continuous unbroken shot"。',
          ja: 'はい。プロンプトを「ショット1 ... ハードカット。ショット2 ...」のように構成すると、1回の生成内で実際のカットを作れます。カットなしのテイクには、「途切れない1つの連続ショット」と明示してください。' /* machine */
        }
      },
      {
        id: 'cuts-not-reading',
        question: {
          en: 'Why do my cuts not look like cuts?',
          'zh-CN': '为什么我的剪切点看起来不像剪切？',
          ja: 'カットがカットらしく見えないのはなぜですか？' /* machine */
        },
        answer: {
          en: 'Consecutive shots that are too similar will not register as edits. Change scale, location, or colour between shots so the cut reads cleanly.',
          'zh-CN':
            '相邻镜头如果太相似，就不会被看成一次剪辑。在镜头之间改变景别、场景或色调，剪切点才会清晰可辨。',
          ja: '連続するショットが似すぎていると、編集として認識されません。ショット間でスケール、場所、色を変えると、カットが明確に伝わります。' /* machine */
        }
      },
      {
        id: 'music-bed',
        question: {
          en: 'Can I hold one music bed across multiple shots?',
          'zh-CN': '可以让同一段配乐贯穿多个镜头吗？',
          ja: '複数のショットで同じ音楽トラックを維持できますか？' /* machine */
        },
        answer: {
          en: 'Yes. Specify it directly, such as "one continuous music bed across all three shots", alongside the shot structure.',
          'zh-CN':
            '可以。在镜头结构旁边直接写明，例如 "one continuous music bed across all three shots"。',
          ja: 'はい。ショット構成とともに、「3つのショットすべてに1本の連続した音楽トラック」のように直接指定してください。' /* machine */
        }
      },
      {
        id: 'prompt-examples',
        question: {
          en: 'What does a good Flux 3 prompt look like?',
          'zh-CN': '一个好的 Flux 3 提示词是什么样的？',
          ja: '良いFlux 3プロンプトとは？' /* machine */
        },
        answer: {
          en: `Three examples, copy and paste ready.

Plain brief: A cozy ramen shop on a rainy Tokyo night: steam rising from the broth, neon reflections in the window puddles, the cook working calmly. Rain patter and quiet kitchen sounds.

Spoken line: A weather presenter on camera in front of a stylized storm map, speaking directly to the lens: "Storm season is here and this time, we're ready." Confident delivery, clean studio lighting. No on-screen text, no subtitles.

Multi-shot: SHOT ONE: wide aerial of a desert highway at dawn, a single red car speeding through. HARD CUT. SHOT TWO: interior close-up, the driver's hands drumming the wheel to the radio. HARD CUT. SHOT THREE: from the roadside, the car shrinking into the heat haze. Warm engine hum under one continuous music bed across all three shots.`,
          'zh-CN': `三个可直接复制使用的示例（提示词保留英文原文，以保证效果一致）。

日常描述：A cozy ramen shop on a rainy Tokyo night: steam rising from the broth, neon reflections in the window puddles, the cook working calmly. Rain patter and quiet kitchen sounds.

带台词：A weather presenter on camera in front of a stylized storm map, speaking directly to the lens: "Storm season is here and this time, we're ready." Confident delivery, clean studio lighting. No on-screen text, no subtitles.

多镜头：SHOT ONE: wide aerial of a desert highway at dawn, a single red car speeding through. HARD CUT. SHOT TWO: interior close-up, the driver's hands drumming the wheel to the radio. HARD CUT. SHOT THREE: from the roadside, the car shrinking into the heat haze. Warm engine hum under one continuous music bed across all three shots.`,
          ja: 'すぐにコピー＆ペーストできる3つの例です。\n\nシンプルな指示：雨の東京の夜にある居心地のよいラーメン店。スープから湯気が立ち上り、窓際の水たまりにはネオンが反射し、店主は落ち着いて調理している。雨音と静かな厨房の音。\n\nセリフ：様式化された嵐の地図を背に、カメラの前でレンズに向かって話す気象キャスター。「嵐の季節が来ました。ですが今回は、準備ができています。」自信のある話し方、クリーンなスタジオ照明。画面上のテキストなし、字幕なし。\n\nマルチショット：ショット1：夜明けの砂漠のハイウェイを空撮のワイドで捉え、1台の赤い車が疾走する。ハードカット。ショット2：車内のクローズアップ。運転手の手がラジオに合わせてハンドルを叩く。ハードカット。ショット3：路肩から、陽炎の中へ小さくなっていく車を捉える。3つのショット全体を通して、連続した1つの音楽の下に暖かなエンジン音が流れる。' /* machine */
        }
      }
    ]
  },
  closingCta: {
    headingKey: 'flux3.cta.heading',
    primaryCta: {
      labelKey: 'flux3.cta.primaryCta',
      href: externalLinks.cloud,
      target: '_blank'
    },
    secondaryCta: {
      labelKey: 'flux3.cta.secondaryCta',
      href: externalLinks.workflows,
      target: '_blank'
    }
  },
  runOptions: {
    headingKey: 'flux3.runOptions.heading',
    subtitleKey: 'flux3.runOptions.subtitle',
    ctaKey: 'flux3.runOptions.cta'
  },
  reviews: {
    headingKey: 'flux3.reviews.heading',
    highlight: {
      titleKey: 'flux3.reviews.highlightTitle',
      descriptionKey: 'flux3.reviews.highlightDescription',
      ctaKey: 'flux3.reviews.highlightCta'
    }
  }
}
