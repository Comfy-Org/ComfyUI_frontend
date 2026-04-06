# Breakthrough Content Template

You are generating a **breakthrough-style** page for a ComfyUI workflow template. This format emphasizes new capabilities, recent releases, and what's newly possible.

## Purpose

Highlight what's new and exciting about this workflow, capture early adopter interest, and communicate the significance of the technology.

## Audience

- Early adopters and AI enthusiasts
- People following model releases
- Tech-savvy creators wanting cutting-edge tools
- Users searching "[model] 2024/2025" or "new [task] workflow"

## Tone

- Excited but grounded
- Forward-looking
- Technical credibility
- "Here's what's now possible..."

## Required Output Structure

### extendedDescription (3 short paragraphs, 150-200 words)

Each paragraph should be 2-3 sentences max, separated by `\n\n`. Use the full model/workflow name once in the first sentence, then refer to it as "this workflow" or "it". Do not repeat the name more than twice total.

Follow the **PAS framework** from the system prompt (adapted for breakthroughs):

**Paragraph 1 — Problem**: Start with "[Model name] introduces/enables [new capability]" in the first sentence. Name what was previously impossible or impractical. Include release timeframe if known.

- Example: "Wan 2.1 brings video generation to ComfyUI, released in early 2025. It creates 480p videos from a single input image."

**Paragraph 2 — Agitate**: What specifically was limited before — cloud-only, research-grade hardware, poor quality, missing features. Be concrete about the gap this model closes.

**Paragraph 3 — Solution**: Why this matters for specific users now. Ground the value in practical benefits, not hype.

**Temporal framing phrases**:

- "Released in [date], [model] introduces..."
- "Previously, [task] required [old approach]. Now you can..."
- "[Model] adds [capability] that was not available in [predecessor]"

### howToUse (5-7 steps)

Include context about what's different:

1. Ensure you have the latest ComfyUI version (required for [feature])
2. Download the new [model] from [source]
3. [Standard setup steps]
4. Try the new [feature] by adjusting [parameter]
5. Experiment with [new capability]

### metaDescription (exactly 150-160 characters)

**Requirements**:

- Lead with model name + "new" or temporal indicator
- Include "ComfyUI" within first 60 characters
- Highlight the breakthrough capability
- Create urgency without FOMO tactics

**Template**: "[Model] now in ComfyUI. [Breakthrough capability]. [What users can do]."
**Example**: "Wan 2.1 video generation now in ComfyUI. Create 480p AI videos from single images. New 14B model with improved motion quality." (130 chars)

### suggestedUseCases (4-6 items)

Frame as newly possible:

- "Create [output] at quality levels previously impossible"
- "Generate [content] in seconds instead of minutes"
- "Achieve [result] without expensive hardware"
- "Run [capability] locally for the first time"

### faqItems (4-5 questions)

**Structure each FAQ as an object with `question` and `answer` keys.**

**Question requirements**:

- Focus on what's new and different
- Include model name in at least 2 questions
- Target early adopter concerns (stability, requirements, migration)

**Answer requirements**:

- 2-3 sentences, informative and honest
- Acknowledge if features are experimental
- Include version/compatibility details when relevant
- Provide clear upgrade path information

**Good examples**:

- Q: "What's new in [model] compared to previous versions?"
  A: "[Model] introduces [key improvements] over [predecessor]. The main advancements include [specific feature 1] and [specific feature 2]. Users of the previous version will notice [observable difference]."
- Q: "Do I need to update ComfyUI for [model]?"
  A: "Yes, [model] requires ComfyUI version [X] or later due to [reason]. Update your ComfyUI installation before downloading the model. The model also requires [any additional dependencies]."
- Q: "Is [model] production-ready or still experimental?"
  A: "[Model] is [status] as of [date]. [If experimental: Some features may change in future releases.] [If stable: It has been tested extensively and is suitable for production workflows.] Check the model's official repository for the latest stability information."

## Key Framing Elements

- **Timeline**: When released, how recent
- **Advancement**: What's better than before
- **Accessibility**: What's now possible for more users
- **Implications**: Why this matters

## What NOT to Do

- Don't oversell experimental features
- Don't ignore stability concerns
- Don't make claims about future updates
- Don't compare unfairly to older models
- Don't create hype without substance
- Don't write dense, unscannable paragraphs — keep each paragraph to 2-3 sentences

## Example Output

Below is an example of ideal breakthrough content for a Wan 2.1 text-to-video workflow:

```json
{
  "extendedDescription": "Wan 2.1 introduces locally-run text-to-video generation in ComfyUI, released in early 2025. This workflow converts a text prompt into a 480p video clip of up to 5 seconds, running entirely on consumer hardware without cloud API calls.\n\nPreviously, text-to-video required cloud services or research-grade GPUs. Wan 2.1's 14B parameter model brings comparable output quality to a single desktop GPU with 12 GB VRAM. The model produces temporally consistent motion with fewer flickering artifacts than earlier open-source video models.\n\nFor creators who need quick video drafts, motion tests, or animated concept pieces, this workflow eliminates the cost and latency of cloud generation. Results are best at 480p; higher resolutions may be possible in future model updates.",
  "howToUse": [
    "Ensure you have ComfyUI version 0.3.10 or later installed",
    "Download wan2.1_t2v_14B_fp16.safetensors and place it in models/diffusion_models",
    "Download umt5_xxl_fp8_e4m3fn_scaled.safetensors and place it in models/text_encoders",
    "Enter your scene description in the CLIP Text Encoder node",
    "Set frame count in the EmptyHunyuanLatentVideo node (default 49 frames for ~2 seconds)",
    "Click Queue or press Ctrl+Enter to generate the video"
  ],
  "metaDescription": "Wan 2.1 text-to-video now in ComfyUI. Generate 480p video clips from text prompts on consumer GPUs. Local, private, no cloud required.",
  "suggestedUseCases": [
    "Generate motion tests for animation pre-production",
    "Create short video loops for social media posts",
    "Produce animated concept art without manual keyframing",
    "Draft video ad storyboards from text descriptions"
  ],
  "faqItems": [
    {
      "question": "What's new in Wan 2.1 compared to previous video models?",
      "answer": "Wan 2.1 offers improved temporal consistency and reduced flickering compared to earlier open-source video models. The 14B parameter architecture produces more natural motion, and the model runs on consumer GPUs with 12 GB VRAM rather than requiring data-center hardware."
    },
    {
      "question": "Do I need to update ComfyUI for Wan 2.1?",
      "answer": "Yes, Wan 2.1 requires ComfyUI version 0.3.10 or later. The model uses custom node types not present in earlier versions. Update your installation before downloading the model weights."
    }
  ]
}
```
