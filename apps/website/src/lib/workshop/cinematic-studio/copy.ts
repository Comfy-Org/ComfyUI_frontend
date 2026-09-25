import type { Locale, LocalizedText } from '../../../i18n/translations'

/**
 * Copy for the Cinematic Studio only. It stays out of the site-wide
 * translations module so the studio's strings ship with the studio and do
 * not add to every other page's script budget.
 */
const copy = {
  'cinematic.video.audioOn': { en: 'On', 'zh-CN': '开启' },
  'cinematic.video.audioOff': { en: 'Off', 'zh-CN': '关闭' },
  'cinematic.video.enhanceHint': {
    en: 'Adds cinematic motion and continuous action to the prompt',
    'zh-CN': '在提示词中添加电影运镜和连续动作'
  },
  'cinematic.video.mode': { en: 'Creation type', 'zh-CN': '创作类型' },
  'cinematic.video.image': { en: 'Image', 'zh-CN': '图像' },
  'cinematic.video.video': { en: 'Video', 'zh-CN': '视频' },
  'cinematic.video.animate': { en: 'Animate image', 'zh-CN': '将图像转为视频' },
  'cinematic.video.preview': { en: 'Generated video', 'zh-CN': '生成的视频' },
  'cinematic.video.duration': { en: 'Duration', 'zh-CN': '时长' },
  'cinematic.video.audio': { en: 'Generate audio', 'zh-CN': '生成音频' },
  'cinematic.video.firstFrame': { en: 'Starting frame', 'zh-CN': '起始帧' },
  'cinematic.video.lastFrame': { en: 'Ending frame', 'zh-CN': '结束帧' },
  'cinematic.video.addFirstFrame': {
    en: 'Add a starting frame',
    'zh-CN': '添加起始帧'
  },
  'cinematic.video.addLastFrame': {
    en: 'Add an ending frame',
    'zh-CN': '添加结束帧'
  },
  'cinematic.video.uploadFrame': { en: 'Upload an image', 'zh-CN': '上传图像' },
  'cinematic.video.needFrame': {
    en: 'Add a starting frame before reviewing this video.',
    'zh-CN': '请先添加起始帧，再检查视频设置。'
  },
  'cinematic.video.oneClip': {
    en: 'One clip per request. Describe the action and camera movement in your scene.',
    'zh-CN': '每次请求生成一个片段。请在场景中描述动作和镜头运动。'
  },
  'cinematic.video.start': {
    en: 'Describe the movement. Choose a video model, or animate an image from your results.',
    'zh-CN': '描述运动，选择视频模型，或将结果中的图像转为视频。'
  },
  'cinematic.video.frameError': {
    en: 'Could not load that starting frame. Download the image and upload it in the video settings.',
    'zh-CN': '无法加载起始帧。请下载图像并在视频设置中上传。'
  },
  'cinematic.video.frameLoading': {
    en: 'Preparing starting frame…',
    'zh-CN': '正在准备起始帧…'
  },

  'cinematic.review.title': { en: 'Review your shot', 'zh-CN': '检查镜头设置' },
  'cinematic.review.description': {
    en: 'Check the full prompt and your choices before generating.',
    'zh-CN': '生成前，请检查完整提示词和所选设置。'
  },
  'cinematic.review.model': { en: 'Model', 'zh-CN': '模型' },
  'cinematic.review.format': { en: 'Requested format', 'zh-CN': '请求的格式' },
  'cinematic.review.takes': { en: 'Takes', 'zh-CN': '生成数量' },
  'cinematic.review.references': { en: 'Reference files', 'zh-CN': '参考文件' },
  'cinematic.review.none': { en: 'None', 'zh-CN': '无' },
  'cinematic.review.prompt': { en: 'Full prompt', 'zh-CN': '完整提示词' },
  'cinematic.review.credits': {
    en: 'Each take is a separate generation and may use workspace credits. The model may adapt the requested format. An exact price is not available here.',
    'zh-CN':
      '每次生成都是独立请求，可能消耗工作区积分。模型可能会调整请求的格式。此处暂不提供准确价格。'
  },
  'cinematic.review.changed': {
    en: 'Your account or generation availability changed. Go back and review again before generating.',
    'zh-CN': '账号或生成可用状态已更改。请返回并重新检查后再生成。'
  },
  'cinematic.review.back': { en: 'Back to editing', 'zh-CN': '返回编辑' },
  'cinematic.review.confirm': { en: 'Generate shot', 'zh-CN': '生成镜头' },
  'cinematic.review.open': { en: 'Review shot', 'zh-CN': '检查镜头' },
  'cinematic.ux.hub': {
    en: 'Hub · Apps tab',
    'zh-CN': 'Hub · 应用标签页'
  },
  'cinematic.hub.eyebrow': { en: 'Hub', 'zh-CN': 'Hub' },
  'cinematic.hub.heading': {
    en: 'What will you make next?',
    'zh-CN': '接下来你想创造什么？'
  },
  'cinematic.hub.subtitle': {
    en: 'Models, the workflows built on them, and apps made for one job.',
    'zh-CN': '模型、基于模型的工作流，以及为单一任务打造的应用。'
  },
  'cinematic.hub.tabs': { en: 'Show', 'zh-CN': '显示' },
  'cinematic.hub.models': { en: 'Models', 'zh-CN': '模型' },
  'cinematic.hub.workflows': { en: 'Workflows', 'zh-CN': '工作流' },
  'cinematic.hub.apps': { en: 'Apps', 'zh-CN': '应用' },
  'cinematic.hub.appsIntro': {
    en: 'Tools built around one kind of work. Each one runs models and workflows for you.',
    'zh-CN': '围绕一类工作打造的工具，为你运行模型和工作流。'
  },
  'cinematic.hub.elsewhere': {
    en: 'Models and workflows live in the new Hub prototype.',
    'zh-CN': '模型和工作流在新版 Hub 原型中。'
  },
  'cinematic.hub.openHub': { en: 'Open the Hub', 'zh-CN': '打开 Hub' },
  'cinematic.hub.beta': { en: 'Beta', 'zh-CN': '测试版' },
  'cinematic.hub.soon': { en: 'Coming soon', 'zh-CN': '即将推出' },
  'cinematic.hub.studioSummary': {
    en: 'Direct a shot with a real camera, light and grade, then run it on any image model.',
    'zh-CN':
      '用真实的摄影机、光线与调色导演一个镜头，然后在任意图像模型上运行。'
  },
  'cinematic.hub.studioMeta': {
    en: 'Image · 5 models',
    'zh-CN': '图像 · 5 个模型'
  },
  'cinematic.hub.to3d': { en: 'Image to 3D', 'zh-CN': '图像转 3D' },
  'cinematic.hub.to3dSummary': {
    en: 'Turn a product photo into a 3D model you can spin and export.',
    'zh-CN': '把产品照片变成可旋转、可导出的 3D 模型。'
  },
  'cinematic.hub.product': { en: 'Product Shots', 'zh-CN': '产品图' },
  'cinematic.hub.productSummary': {
    en: 'Place a product in studio or lifestyle scenes, on a clean background or in context.',
    'zh-CN': '把产品放进棚拍或生活场景，干净背景或真实环境都可以。'
  },
  'cinematic.hub.storyboard': { en: 'Storyboard', 'zh-CN': '分镜' },
  'cinematic.hub.storyboardSummary': {
    en: 'Write a sequence and get consistent frames, ready to animate.',
    'zh-CN': '写下一段情节，生成风格一致、可直接做动画的分镜。'
  },
  'cinematic.stage.renderingTake': {
    en: 'Rendering take {take}',
    'zh-CN': '正在渲染第 {take} 条'
  },
  'cinematic.stage.longWait': {
    en: 'Still going. Some models take about a minute. Nothing is queued; yours already started.',
    'zh-CN': '仍在进行。部分模型需要约一分钟。没有排队，你的任务已经开始。'
  },
  'cinematic.state.failed': {
    en: 'This take failed',
    'zh-CN': '这一条生成失败'
  },
  'cinematic.state.blocked': {
    en: 'Blocked by the model’s content policy',
    'zh-CN': '被模型的内容政策拦截'
  },
  'cinematic.state.noCredits': {
    en: 'Not enough credits for this shot',
    'zh-CN': '积分不足，无法生成这个镜头'
  },
  'cinematic.state.cancelled': {
    en: 'You stopped this take',
    'zh-CN': '你已停止这一条'
  },
  'cinematic.state.tryOn': {
    en: 'Try on {model}',
    'zh-CN': '换用 {model}'
  },
  'cinematic.state.editScene': {
    en: 'Edit scene',
    'zh-CN': '修改场景'
  },
  'cinematic.output.checking': {
    en: 'Checking…',
    'zh-CN': '检查中…'
  },
  'cinematic.model.degraded': {
    en: 'Slow now',
    'zh-CN': '当前较慢'
  },
  'cinematic.picker.done': {
    en: 'Done',
    'zh-CN': '完成'
  },
  'cinematic.stage.again': {
    en: 'Generate again',
    'zh-CN': '再生成一次'
  },
  'cinematic.stage.useAsReference': {
    en: 'Use as reference',
    'zh-CN': '用作参考'
  },
  'cinematic.ux.heading': {
    en: 'Layout to review',
    'zh-CN': '评审布局'
  },
  'cinematic.ux.composer': {
    en: 'E · Bottom composer',
    'zh-CN': 'E · 底部输入栏'
  },
  'cinematic.ux.panel': {
    en: 'D · Side panel',
    'zh-CN': 'D · 侧边面板'
  },
  'cinematic.panel.label': {
    en: 'Shot settings',
    'zh-CN': '镜头设置'
  },
  'cinematic.section.output': {
    en: 'Format',
    'zh-CN': '画幅'
  },
  'cinematic.section.direction': {
    en: 'Direction',
    'zh-CN': '导演'
  },
  'cinematic.scene.fullPrompt': {
    en: 'View full prompt',
    'zh-CN': '查看完整提示词'
  },
  'cinematic.scene.edit': {
    en: 'Edit scene',
    'zh-CN': '编辑场景'
  },
  'cinematic.reference.optional': {
    en: 'Optional',
    'zh-CN': '可选'
  },
  'cinematic.stage.emptyTitle': {
    en: 'Your first shot appears here',
    'zh-CN': '你的第一个镜头会显示在这里'
  },
  'cinematic.stage.emptyBody': {
    en: 'Write a scene, set the direction, then Generate.',
    'zh-CN': '写下场景，设置导演选项，然后点击生成。'
  },
  'cinematic.title': {
    en: 'Cinematic Studio',
    'zh-CN': '电影工作室'
  },
  'cinematic.beta': {
    en: 'Beta',
    'zh-CN': '测试版'
  },
  'cinematic.meta.description': {
    en: 'Direct cinematic stills: pick the camera, shot, light, film and grade, then run any image model through the Comfy Router.',
    'zh-CN':
      '导演电影感静帧：选择摄影机、景别、光线、胶片与调色，然后通过 Comfy Router 运行任意图像模型。'
  },
  'cinematic.unavailable.title': {
    en: 'Cinematic Studio is not open yet',
    'zh-CN': '电影工作室尚未开放'
  },
  'cinematic.unavailable.link': {
    en: 'Browse models',
    'zh-CN': '浏览模型'
  },
  'cinematic.model.heading': {
    en: 'Model · via Comfy Router',
    'zh-CN': '模型 · 通过 Comfy Router'
  },
  'cinematic.model.browse': {
    en: 'All models & native controls (new tab)',
    'zh-CN': '所有模型与原生控件（新标签页）'
  },
  'cinematic.aspect.landscapePhoto': {
    en: 'Landscape photo',
    'zh-CN': '横向照片'
  },
  'cinematic.aspect.portraitPhoto': {
    en: 'Portrait photo',
    'zh-CN': '纵向照片'
  },
  'cinematic.composer.label': {
    en: 'Direct the shot',
    'zh-CN': '导演镜头'
  },
  'cinematic.composer.references': {
    en: 'Add a reference image',
    'zh-CN': '添加参考图'
  },
  'cinematic.composer.format': {
    en: 'Format',
    'zh-CN': '画幅'
  },
  'cinematic.firstRun.body': {
    en: 'Describe the moment. Pick the camera, the light and the look. Switch models any time.',
    'zh-CN': '描述这一刻。选择摄影机、光线与风格。随时切换模型。'
  },
  'cinematic.firstRun.desert': {
    en: 'Lone rider crossing dunes at dawn',
    'zh-CN': '黎明时分独自穿越沙丘的骑手'
  },
  'cinematic.firstRun.portrait': {
    en: 'Old fisherman on an overcast pier',
    'zh-CN': '阴天码头上的老渔夫'
  },
  'cinematic.firstRun.train': {
    en: 'Night train window at blue hour',
    'zh-CN': '蓝调时刻的夜车车窗'
  },
  'cinematic.section.scene': {
    en: 'Scene',
    'zh-CN': '场景'
  },
  'cinematic.section.camera': {
    en: 'Camera',
    'zh-CN': '摄影机'
  },
  'cinematic.section.references': {
    en: 'References',
    'zh-CN': '参考'
  },
  'cinematic.scene.placeholder': {
    en: 'Describe the moment. Who, where, what is happening.',
    'zh-CN': '描述这一刻：谁、在哪里、发生了什么。'
  },
  'cinematic.scene.enhance': {
    en: 'AI prompt',
    'zh-CN': 'AI 提示词'
  },
  'cinematic.scene.enhanceHint': {
    en: 'Adds “cinematic film still” to the prompt',
    'zh-CN': '在提示词中加入“电影静帧”描述'
  },
  'cinematic.camera.body': {
    en: 'Body',
    'zh-CN': '机身'
  },
  'cinematic.camera.lens': {
    en: 'Lens',
    'zh-CN': '镜头'
  },
  'cinematic.camera.focal': {
    en: 'Focal length',
    'zh-CN': '焦距'
  },
  'cinematic.camera.aperture': {
    en: 'Aperture',
    'zh-CN': '光圈'
  },
  'cinematic.part.shot': {
    en: 'Shot',
    'zh-CN': '景别'
  },
  'cinematic.part.light': {
    en: 'Light',
    'zh-CN': '光线'
  },
  'cinematic.part.film': {
    en: 'Film',
    'zh-CN': '胶片'
  },
  'cinematic.part.look': {
    en: 'Look',
    'zh-CN': '风格'
  },
  'cinematic.part.grade': {
    en: 'Grade',
    'zh-CN': '调色'
  },
  'cinematic.option.auto': {
    en: 'Auto',
    'zh-CN': '自动'
  },
  'cinematic.option.digital': {
    en: 'Digital cinema',
    'zh-CN': '数字电影机'
  },
  'cinematic.option.largeFormat': {
    en: 'Large format',
    'zh-CN': '大画幅'
  },
  'cinematic.option.super35': {
    en: 'Super 35',
    'zh-CN': 'Super 35'
  },
  'cinematic.option.film35': {
    en: '35mm film',
    'zh-CN': '35mm 胶片'
  },
  'cinematic.option.film16': {
    en: '16mm film',
    'zh-CN': '16mm 胶片'
  },
  'cinematic.option.handheld': {
    en: 'Handheld',
    'zh-CN': '手持'
  },
  'cinematic.option.prime': {
    en: 'Spherical',
    'zh-CN': '球面定焦'
  },
  'cinematic.option.anamorphic': {
    en: 'Anamorphic',
    'zh-CN': '变形宽银幕'
  },
  'cinematic.option.vintage': {
    en: 'Vintage',
    'zh-CN': '复古镜头'
  },
  'cinematic.option.macro': {
    en: 'Macro',
    'zh-CN': '微距'
  },
  'cinematic.option.tiltShift': {
    en: 'Tilt-shift',
    'zh-CN': '移轴'
  },
  'cinematic.option.mm14': {
    en: '14mm',
    'zh-CN': '14mm'
  },
  'cinematic.option.mm24': {
    en: '24mm',
    'zh-CN': '24mm'
  },
  'cinematic.option.mm35': {
    en: '35mm',
    'zh-CN': '35mm'
  },
  'cinematic.option.mm50': {
    en: '50mm',
    'zh-CN': '50mm'
  },
  'cinematic.option.mm85': {
    en: '85mm',
    'zh-CN': '85mm'
  },
  'cinematic.option.mm135': {
    en: '135mm',
    'zh-CN': '135mm'
  },
  'cinematic.option.f14': {
    en: 'f/1.4',
    'zh-CN': 'f/1.4'
  },
  'cinematic.option.f2': {
    en: 'f/2',
    'zh-CN': 'f/2'
  },
  'cinematic.option.f28': {
    en: 'f/2.8',
    'zh-CN': 'f/2.8'
  },
  'cinematic.option.f4': {
    en: 'f/4',
    'zh-CN': 'f/4'
  },
  'cinematic.option.f8': {
    en: 'f/8',
    'zh-CN': 'f/8'
  },
  'cinematic.option.extremeWide': {
    en: 'Extreme wide',
    'zh-CN': '大远景'
  },
  'cinematic.option.wide': {
    en: 'Wide',
    'zh-CN': '远景'
  },
  'cinematic.option.medium': {
    en: 'Medium',
    'zh-CN': '中景'
  },
  'cinematic.option.closeUp': {
    en: 'Close-up',
    'zh-CN': '特写'
  },
  'cinematic.option.extremeCloseUp': {
    en: 'Extreme close-up',
    'zh-CN': '大特写'
  },
  'cinematic.option.overShoulder': {
    en: 'Over the shoulder',
    'zh-CN': '过肩镜头'
  },
  'cinematic.option.lowAngle': {
    en: 'Low angle',
    'zh-CN': '仰拍'
  },
  'cinematic.option.goldenHour': {
    en: 'Golden hour',
    'zh-CN': '黄金时刻'
  },
  'cinematic.option.overcast': {
    en: 'Overcast',
    'zh-CN': '阴天'
  },
  'cinematic.option.blueHour': {
    en: 'Blue hour',
    'zh-CN': '蓝调时刻'
  },
  'cinematic.option.practicalNight': {
    en: 'Practical night',
    'zh-CN': '实景夜光'
  },
  'cinematic.option.neon': {
    en: 'Neon',
    'zh-CN': '霓虹'
  },
  'cinematic.option.lowKey': {
    en: 'Low key',
    'zh-CN': '低调光'
  },
  'cinematic.option.silhouette': {
    en: 'Silhouette',
    'zh-CN': '剪影'
  },
  'cinematic.option.digitalClean': {
    en: 'Digital clean',
    'zh-CN': '纯净数字'
  },
  'cinematic.option.tungsten500': {
    en: 'Tungsten 500T',
    'zh-CN': '钨丝灯 500T'
  },
  'cinematic.option.daylight250': {
    en: 'Daylight 250D',
    'zh-CN': '日光 250D'
  },
  'cinematic.option.blackWhite400': {
    en: 'Black & white 400',
    'zh-CN': '黑白 400'
  },
  'cinematic.option.reversal': {
    en: 'Reversal slide',
    'zh-CN': '反转片'
  },
  'cinematic.option.expired': {
    en: 'Expired film',
    'zh-CN': '过期胶片'
  },
  'cinematic.option.bleachBypass': {
    en: 'Bleach bypass',
    'zh-CN': '漂白效果'
  },
  'cinematic.option.neoNoir': {
    en: 'Neo-noir',
    'zh-CN': '新黑色电影'
  },
  'cinematic.option.western': {
    en: 'Western',
    'zh-CN': '西部片'
  },
  'cinematic.option.sciFi': {
    en: 'Science fiction',
    'zh-CN': '科幻'
  },
  'cinematic.option.periodDrama': {
    en: 'Period drama',
    'zh-CN': '年代剧'
  },
  'cinematic.option.thriller': {
    en: 'Thriller',
    'zh-CN': '惊悚片'
  },
  'cinematic.option.documentary': {
    en: 'Documentary',
    'zh-CN': '纪录片'
  },
  'cinematic.option.roadMovie': {
    en: 'Road movie',
    'zh-CN': '公路片'
  },
  'cinematic.option.tealOrange': {
    en: 'Teal and orange',
    'zh-CN': '青橙色调'
  },
  'cinematic.option.noir': {
    en: 'Noir',
    'zh-CN': '黑白'
  },
  'cinematic.option.kodachrome': {
    en: 'Kodachrome',
    'zh-CN': '柯达克罗姆'
  },
  'cinematic.option.neonNight': {
    en: 'Neon night',
    'zh-CN': '霓虹之夜'
  },
  'cinematic.option.desertDust': {
    en: 'Desert dust',
    'zh-CN': '沙漠尘土'
  },
  'cinematic.option.nordicCold': {
    en: 'Nordic cold',
    'zh-CN': '北欧冷调'
  },
  'cinematic.aspect.scope': {
    en: 'Scope',
    'zh-CN': '宽银幕'
  },
  'cinematic.aspect.widescreen': {
    en: 'Widescreen',
    'zh-CN': '宽屏'
  },
  'cinematic.aspect.academy': {
    en: 'Academy',
    'zh-CN': '学院比例'
  },
  'cinematic.aspect.square': {
    en: 'Square',
    'zh-CN': '方形'
  },
  'cinematic.aspect.vertical': {
    en: 'Vertical',
    'zh-CN': '竖屏'
  },
  'cinematic.reference.cast': {
    en: 'Character',
    'zh-CN': '角色'
  },
  'cinematic.reference.castHint': {
    en: 'Same face across shots',
    'zh-CN': '在各镜头中保持同一张脸'
  },
  'cinematic.reference.castAction': {
    en: 'Add a character reference',
    'zh-CN': '添加角色参考'
  },
  'cinematic.reference.palette': {
    en: 'Palette',
    'zh-CN': '色板'
  },
  'cinematic.reference.paletteHint': {
    en: 'Match its colors',
    'zh-CN': '匹配其色彩'
  },
  'cinematic.reference.paletteAction': {
    en: 'Add a palette reference',
    'zh-CN': '添加色板参考'
  },
  'cinematic.reference.remove': {
    en: 'Remove reference',
    'zh-CN': '移除参考'
  },
  'cinematic.picker.close': {
    en: 'Close',
    'zh-CN': '关闭'
  },
  'cinematic.output.takes': {
    en: 'Takes',
    'zh-CN': '条数'
  },
  'cinematic.output.fewerTakes': {
    en: 'Fewer takes',
    'zh-CN': '减少条数'
  },
  'cinematic.output.moreTakes': {
    en: 'More takes',
    'zh-CN': '增加条数'
  },
  'cinematic.output.aspect': {
    en: 'Aspect ratio',
    'zh-CN': '画面比例'
  },
  'cinematic.output.resolution': {
    en: 'Resolution',
    'zh-CN': '分辨率'
  },
  'cinematic.output.generate': {
    en: 'Generate',
    'zh-CN': '生成'
  },
  'cinematic.output.cancel': {
    en: 'Cancel',
    'zh-CN': '取消'
  },
  'cinematic.output.unavailable': {
    en: 'Running models is not available here yet.',
    'zh-CN': '此处暂不支持运行模型。'
  },
  'cinematic.stage.label': {
    en: 'Shots',
    'zh-CN': '镜头'
  },
  'cinematic.stage.rendering': {
    en: 'Rendering…',
    'zh-CN': '渲染中…'
  },
  'cinematic.stage.shot': {
    en: 'Shot {number}',
    'zh-CN': '镜头 {number}'
  },
  'cinematic.stage.takes': {
    en: 'Takes',
    'zh-CN': '条数'
  },
  'cinematic.stage.download': {
    en: 'Download',
    'zh-CN': '下载'
  },
  'cinematic.stage.sequence': {
    en: 'Sequence',
    'zh-CN': '序列'
  },
  'cinematic.stage.thumb': {
    en: 'Shot {shot}, take {take}',
    'zh-CN': '镜头 {shot}，第 {take} 条'
  }
} as const satisfies Record<string, LocalizedText>

export type CinematicCopyKey = keyof typeof copy

export function tc(key: CinematicCopyKey, locale: Locale = 'en'): string {
  const entry: LocalizedText = copy[key]
  return entry[locale] ?? entry.en
}
