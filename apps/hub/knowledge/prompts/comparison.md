# Comparison Content Template

You are generating a **comparison-style** page for a ComfyUI workflow template. This format positions the workflow against alternatives and helps users make informed decisions.

## Purpose

Help users understand why they should choose this workflow over alternatives, when to use it, and what tradeoffs exist.

## Audience

- Researchers evaluating options
- Professionals comparing tools
- Users searching "best [task] workflow" or "[model] vs [alternative]"
- People trying to decide between local and cloud options

## Tone

- Objective and balanced
- Informative, not salesy
- Honest about tradeoffs
- Helpful in decision-making

## Required Output Structure

### extendedDescription (3 short paragraphs, 150-200 words)

Each paragraph should be 2-3 sentences max, separated by `\n\n`. Use the full model/workflow name once in the first sentence, then refer to it as "this workflow" or "it". Do not repeat the name more than twice total.

Follow the **PAS framework** from the system prompt (adapted for comparison):

**Paragraph 1 — Problem**: Start with "[Model name] solves/addresses [problem]" in the first sentence. Name the task and the decision the user faces between approaches.

- Example: "Flux inpainting handles object removal and background replacement in ComfyUI. It works on any uploaded image with painted mask regions."

**Paragraph 2 — Agitate**: How existing alternatives fall short — speed, cost, quality, complexity. Be specific, balanced, and include at least one honest tradeoff for this workflow too.

**Paragraph 3 — Solution**: When this is the right choice and when it might not be. Help users self-select with concrete criteria.

**Comparison phrases to use**:

- "Faster than [alternative] but requires more VRAM"
- "More consistent than [manual approach] with less effort"
- "Better for [use case A], while [alternative] excels at [use case B]"

### howToUse (4-6 steps)

Frame steps in terms of efficiency vs alternatives:

1. [Step] - Unlike [alternative], this only requires...
2. [Step] - Automatically handles [task] that usually requires...

### metaDescription (exactly 150-160 characters)

**Requirements**:

- Lead with primary keyword (model + task)
- Include "ComfyUI" and comparison framing
- Mention the decision/choice aspect
- Appeal to users researching options

**Template**: "[Model] vs alternatives for [task] in ComfyUI. [Key differentiator]. [Decision help]."
**Example**: "Flux vs SDXL for inpainting in ComfyUI. Compare quality, speed, and VRAM requirements. Find the best workflow for your needs." (128 chars)

### suggestedUseCases (4-6 items)

Frame as "best for" scenarios:

- "Best for high-volume batch processing"
- "Ideal when consistency matters more than speed"
- "Perfect for users with limited VRAM"
- "Great alternative to expensive cloud services"

### faqItems (4-5 questions)

**Structure each FAQ as an object with `question` and `answer` keys.**

**Question requirements**:

- Focus on comparison and decision-making
- Include model name in at least 2 questions
- Target "[model] vs [alternative]" search patterns

**Answer requirements**:

- 2-4 sentences, balanced and objective
- Acknowledge both strengths AND limitations
- Provide clear decision criteria
- Never dismiss alternatives unfairly

**Good examples**:

- Q: "Is [model] better than [common alternative]?"
  A: "[Model] and [alternative] excel in different areas. [Model] offers better [advantage], while [alternative] is stronger for [other use case]. Choose [model] if [criteria]; choose [alternative] if [other criteria]."
- Q: "Should I use [workflow] or [other approach] for [task]?"
  A: "Use this workflow when you need [specific benefit] and have [requirements]. The [other approach] may be better if you need [other benefit] or have [different constraints]. For most users doing [common task], this workflow is the more efficient choice."
- Q: "When should I NOT use this workflow?"
  A: "This workflow may not be ideal if you [limitation 1] or need [capability it lacks]. In those cases, consider [alternative 1] for [reason] or [alternative 2] for [other reason]. It's also not optimized for [edge case]."

## Comparison Dimensions

When comparing, consider:

- **Speed**: Generation time, iteration speed
- **Quality**: Output fidelity, consistency
- **Resources**: VRAM, disk space, cost
- **Ease of use**: Setup complexity, learning curve
- **Flexibility**: Customization options

## What NOT to Do

- Don't make unfair comparisons
- Don't claim superiority without basis
- Don't ignore legitimate alternatives
- Don't hide significant tradeoffs
- Don't compare to straw man alternatives
- Don't write dense, unscannable paragraphs — keep each paragraph to 2-3 sentences

## Example Output

Below is an example of ideal comparison content for a Flux inpainting workflow:

```json
{
  "extendedDescription": "Flux inpainting addresses the challenge of removing objects and filling regions in images within ComfyUI. This workflow lets you mask an area and regenerate it with content that matches the surrounding context, perspective, and lighting.\n\nCompared to manual clone-stamp editing in Photoshop, Flux inpainting produces context-aware fills in a single pass. It handles complex backgrounds more consistently than SDXL inpainting, though it requires roughly 10 GB VRAM versus 8 GB for SDXL. For simple rectangular fills, traditional content-aware fill tools may be faster, but Flux excels at irregular mask shapes and scenes with depth.\n\nChoose this workflow when you need high-fidelity inpainting on detailed scenes and have a GPU with at least 10 GB VRAM. If your hardware is limited or the edits are simple crops, SDXL inpainting or manual editing may be more practical.",
  "howToUse": [
    "Upload your source image in the Load Image node",
    "Draw a mask over the area to remove using the Mask Editor",
    "Enter a description of what should replace the masked area in the CLIP Text Encoder node",
    "Set denoise strength between 0.7 and 0.9 for best blending",
    "Click Queue or press Ctrl+Enter to run the workflow"
  ],
  "metaDescription": "Flux vs SDXL for inpainting in ComfyUI. Compare quality, speed, and VRAM needs. Find the best object removal workflow for your hardware.",
  "suggestedUseCases": [
    "Best for removing complex objects from detailed backgrounds",
    "Ideal when seamless blending matters more than speed",
    "Great alternative to manual Photoshop clone-stamp work",
    "Suitable for batch product photo cleanup at consistent quality"
  ],
  "faqItems": [
    {
      "question": "Is Flux inpainting better than SDXL inpainting?",
      "answer": "Flux inpainting produces more consistent results on complex scenes with depth and varied textures. SDXL inpainting is lighter on VRAM (8 GB vs 10 GB) and faster per image. Choose Flux for quality-critical work and SDXL when speed or hardware constraints matter."
    },
    {
      "question": "When should I NOT use this inpainting workflow?",
      "answer": "This workflow is not ideal for very small touch-ups where a simple clone tool would suffice, or on machines with less than 10 GB VRAM. For those cases, SDXL inpainting or manual editing tools are more efficient."
    }
  ]
}
```
