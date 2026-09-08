import type { LocalizedText } from '../i18n/translations'

export interface CreatorReview {
  id: string
  body: LocalizedText
  name: string
  role?: LocalizedText
}

// Comfy creator testimonials shared by every model-launch page: they praise
// Comfy/ComfyUI in general, so they apply to whichever model the page is for.
export const creatorReviews: readonly CreatorReview[] = [
  {
    id: 'scott-belsky',
    body: {
      en: 'Comfy has innovated a new and powerful ecosystem for creativity without compromising creative control. It has been amazing to watch technical artists and curious creative minds leverage Comfy to explore the full surface area of their ideas.',
      'zh-CN':
        'Comfy 打造了一个全新而强大的创意生态，同时毫不牺牲创作掌控力。看着技术型艺术家和充满好奇的创意人借助 Comfy 探索创意的每一个维度，令人惊叹。',
      ja: 'Comfyは、クリエイティブコントロールを損なわずに創作できる新たなエコシステムを築きました。技術系アーティストや探究心のあるクリエイターがComfyを活用し、アイデアの可能性を幅広く探る姿を見るのは素晴らしいことです。' /* machine */
    },
    name: 'Scott Belsky',
    role: {
      en: 'Founder of Behance',
      'zh-CN': 'Behance 创始人',
      ja: 'Behance創設者' /* machine */
    }
  },
  {
    id: 'richard-n',
    body: {
      en: 'The best part for me is the node-based workflow: it offers a lot of possibilities and enables many different combinations. I also appreciate the optimization options and the automatic memory handling, even when working with tight models.',
      'zh-CN':
        '对我来说最棒的是基于节点的工作流：它带来了大量可能性，能实现许多不同的组合。我也很欣赏它的优化选项和自动显存管理，即使在显存吃紧时也能应对。',
      ja: 'ノードベースのワークフローが特に気に入っています。多くの可能性があり、さまざまな組み合わせを試せます。最適化の選択肢や、メモリ制約の厳しいモデルでも使える自動メモリ管理も評価しています。' /* machine */
    },
    name: 'Richard N.',
    role: { en: 'Owner', 'zh-CN': '企业主', ja: 'オーナー' /* machine */ }
  },
  {
    id: 'maryann-e',
    body: {
      en: 'I appreciate being able to use models that my computer can no longer keep up with. I prefer the node-based approach because it is adjustable, rather than being behind a closed door.',
      'zh-CN':
        '我很喜欢能够使用那些本地电脑已经带不动的模型。我更偏爱基于节点的方式，因为它可以自由调整，而不是被关在一扇关闭的门后。',
      ja: '自分のコンピュータではもう扱えないモデルを使えるのがありがたいです。ブラックボックスではなく調整できる、ノードベースのアプローチを好んでいます。' /* machine */
    },
    name: 'MaryAnn E.',
    role: {
      en: "Broker at Pop RV's",
      'zh-CN': "Pop RV's 经纪人",
      ja: "Pop RV'sのブローカー" /* machine */
    }
  },
  {
    id: 'alan-m',
    body: {
      en: 'The UI and UX of ComfyUI are intuitive and user-friendly, making navigation straightforward and efficient. Its integrations with other tools streamline workflows and enhance overall productivity.',
      'zh-CN':
        'ComfyUI 的界面和交互直观易用，导航清晰高效。它与其他工具的集成让工作流更顺畅，整体效率也随之提升。',
      ja: 'ComfyUIのUIとUXは直感的で使いやすく、わかりやすく効率的に操作できます。他ツールとの連携でワークフローが整理され、全体の生産性が向上します。' /* machine */
    },
    name: 'Alan M.',
    role: {
      en: 'Co-Founder',
      'zh-CN': '联合创始人',
      ja: '共同創業者' /* machine */
    }
  },
  {
    id: 'kirk-h',
    body: {
      en: "I use ComfyUI to help me create VFX for my animated show. It's easy to use, especially with importing a Comfy pipeline on the cloud, and I really like the clean UI and how straightforward it is.",
      'zh-CN':
        '我用 ComfyUI 为我的动画剧集制作视觉特效。它很好上手，尤其是在云端导入 Comfy 流程时，我非常喜欢它简洁直观的界面。',
      ja: 'アニメ番組のVFX制作にComfyUIを使っています。特に、クラウドでComfyパイプラインをインポートできるため使いやすく、すっきりしたUIとわかりやすさが気に入っています。' /* machine */
    },
    name: 'Kirk H.'
  },
  {
    id: 'fred-c',
    body: {
      en: 'I love that ComfyUI is extremely fast and very reliable. It gives me so much freedom to create the characters I want.',
      'zh-CN':
        '我喜欢 ComfyUI 既极快又非常可靠。它让我可以自由地创作出想要的角色。',
      ja: 'ComfyUIは非常に高速で信頼性が高く、作りたいキャラクターを自由に制作できます。' /* machine */
    },
    name: 'Fred C.'
  },
  {
    id: 'matthew-p',
    body: {
      en: "The one-click workflows are something I do love, as they simplify many processes for me. The setup was very easy, even for someone who isn't familiar with it all.",
      'zh-CN':
        '我很喜欢一键式工作流，它为我简化了许多流程。整个设置也非常简单，即使对不太熟悉的人也是如此。',
      ja: 'ワンクリックのワークフローは、多くの工程を簡素化してくれるのでとても気に入っています。詳しくない私でも、セットアップはとても簡単でした。' /* machine */
    },
    name: 'Matthew P.'
  },
  {
    id: 'verified-user-in-depth',
    body: {
      en: "I like how in-depth ComfyUI can be. It makes me feel like the software itself isn't limited, which encourages me to keep experimenting and learning.",
      'zh-CN':
        '我喜欢 ComfyUI 可以做到多么深入。它让我觉得软件本身没有边界，鼓励我不断尝试和学习。',
      ja: 'ComfyUIをどこまでも深く使い込める点が気に入っています。ソフトウェア自体に限界がないように感じられ、実験と学習を続ける励みになります。' /* machine */
    },
    name: 'Verified User'
  },
  {
    id: 'nikolai-k',
    body: {
      en: 'A holistic approach and visualisation through an endless whiteboard.',
      'zh-CN': '一种整体性的方式，通过无限画布进行可视化。',
      ja: '無限に広がるホワイトボードを通じた、包括的なアプローチと可視化。' /* machine */
    },
    name: 'Nikolai K.',
    role: {
      en: '3D Artist',
      'zh-CN': '3D 艺术家',
      ja: '3Dアーティスト' /* machine */
    }
  },
  {
    id: 'leonardo-s',
    body: {
      en: 'Having full control of the GenAI process, and being able to use it unlimited times, integrating it into your workflow whenever you need to create.',
      'zh-CN':
        '能够完全掌控生成式 AI 的过程，并且可以无限次使用，随时将它融入到你的创作工作流中。',
      ja: 'GenAIプロセスを完全にコントロールでき、必要なときはいつでもワークフローに組み込んで、回数制限なく使えること。' /* machine */
    },
    name: 'Leonardo S.',
    role: {
      en: 'Social Media Marketing Expert',
      'zh-CN': '社交媒体营销专家',
      ja: 'ソーシャルメディアマーケティング専門家' /* machine */
    }
  },
  {
    id: 'verified-user-local',
    body: {
      en: 'Helps me run AI models locally and generate images, video, and audio, all free of cost.',
      'zh-CN': '帮助我在本地运行 AI 模型，并免费生成图像、视频和音频。',
      ja: 'AIモデルをローカルで実行し、画像、動画、音声を無料で生成できます。' /* machine */
    },
    name: 'Verified User',
    role: {
      en: 'Computer Software',
      'zh-CN': '计算机软件',
      ja: 'コンピューターソフトウェア' /* machine */
    }
  }
] as const
