# Showcase Content Template

You are generating a **showcase-style** page for a ComfyUI workflow template. This format emphasizes visual results, creative possibilities, and the "wow factor."

## Purpose

Inspire users with what's possible, emphasize output quality, create desire to try the workflow.

## Audience

- Artists and creators looking for inspiration
- Professionals evaluating quality
- Social media users who saw cool outputs
- People searching "[model] examples" or "best [task] results"

## Tone

- Enthusiastic but not hyperbolic
- Visual and descriptive
- Confidence in capabilities
- Aspirational but grounded ("You can create..." over "Create stunning...")

## Required Output Structure

### extendedDescription (3 short paragraphs, 150-200 words)

Each paragraph should be 2-3 sentences max, separated by `\n\n`. Use the full model/workflow name once in the first sentence, then refer to it as "this workflow" or "it". Do not repeat the name more than twice total.

Follow the **PAS framework** from the system prompt:

**Paragraph 1 — Problem**: Start with "[Model name] creates/generates [output type]" in the first sentence. Name the creative task and the gap it fills.

- Example: "Flux upscaling produces 4K images from low-resolution sources in ComfyUI. You can upscale photos, illustrations, and AI-generated art with preserved detail."

**Paragraph 2 — Agitate**: Acknowledge the previous limitations — slow manual upscaling, cloud costs, quality loss with traditional methods. One sentence, then pivot to this workflow's advantage (speed, quality, consistency).

**Paragraph 3 — Solution**: Which users and workflows benefit most. Be concrete about outputs and professional applications.

**Descriptive language to use**:

- "Produces clear, detailed [outputs]"
- "Handles [input type] with accurate [quality aspect]"
- "Generates consistent [content] across batches"
- "Preserves fine detail in [specific area]"

### howToUse (4-6 steps, simplified)

Focus on the creative workflow, not technical details:

1. Upload your [input type]
2. Describe what you want to create
3. Adjust [key creative parameter] for your style
4. Generate and iterate
5. Download your result

### metaDescription (exactly 150-160 characters)

**Requirements**:

- Lead with primary keyword (model + output type)
- Include "ComfyUI" within first 60 characters
- Focus on the result/outcome, not the process
- End with action-oriented phrase

**Template**: "[Model] [output] in ComfyUI. [Quality claim]. [Call-to-action]."
**Example**: "Flux image generation in ComfyUI. Professional-quality AI art in seconds. Download and start creating today." (112 chars)

### suggestedUseCases (4-6 items)

Focus on professional and creative applications:

- "Social media content creation"
- "Professional portfolio pieces"
- "Client presentation mockups"
- "Game asset concepting"
- "Film and video production"
- "Marketing and advertising visuals"

### faqItems (3-4 questions)

**Structure each FAQ as an object with `question` and `answer` keys.**

**Question requirements**:

- Focus on results and quality (not setup)
- Include model name in at least 2 questions
- Target users evaluating output quality

**Answer requirements**:

- 2-3 sentences, specific and confident
- Include concrete details (resolution, speed, style capabilities)
- Reference real capabilities from the workflow data

**Good examples**:

- Q: "What quality can I expect from [model]?"
  A: "[Model] produces images at up to [resolution] with fine detail preservation. Output quality is suitable for professional print and web use. Results are consistent across different prompts and styles."
- Q: "Is [workflow] good enough for professional work?"
  A: "Yes, [model] is widely used in professional creative workflows for [use cases]. The output quality meets industry standards for [applications]. Many studios use this workflow for client-facing work."
- Q: "How long does it take to generate [output]?"
  A: "Generation time depends on your hardware and settings. On a typical RTX 3080, expect [X seconds] per image at standard resolution. Batch processing multiple images is also supported."

## Visual Language Keywords

- "High-resolution"
- "Professional quality"
- "Detailed"
- "Consistent"
- "Customizable"

## What NOT to Do

- Don't oversell or use superlatives — see banned phrases in the system prompt
- Don't make specific quality claims not supported by data
- Don't ignore technical requirements entirely
- Don't create FOMO through artificial urgency
- Don't write dense, unscannable paragraphs — keep each paragraph to 2-3 sentences

## Example Output

Below is an example of ideal showcase content for a Flux upscaling workflow:

```json
{
  "extendedDescription": "Flux upscaling produces crisp, detailed 4K images from low-resolution sources in ComfyUI. This workflow takes a 512×512 input and generates a clean 2048×2048 output while preserving fine textures and sharp edges.\n\nCompared to traditional bicubic scaling, Flux upscaling reconstructs missing detail rather than blurring it. A typical 4× upscale completes in under 20 seconds on an RTX 3080, making it practical for batch processing large image sets.\n\nPhotographers, game artists, and print designers can upscale legacy assets to modern resolutions without re-shooting or re-rendering. Upload an image, choose your scale factor, and download the enhanced result.",
  "howToUse": [
    "Upload your source image in the Load Image node",
    "Select the desired scale factor in the Upscale Model Loader node",
    "Adjust the denoise strength to control detail generation (0.3–0.5 recommended)",
    "Click Queue or press Ctrl+Enter to run the workflow",
    "Download the upscaled image from the Save Image node"
  ],
  "metaDescription": "Flux image upscaling in ComfyUI. Enhance low-resolution images to 4K with preserved detail. Fast batch processing for professionals.",
  "suggestedUseCases": [
    "Upscale product photos for high-resolution print catalogs",
    "Enhance archival images for digital restoration projects",
    "Prepare game textures at higher resolution for modern displays",
    "Improve social media thumbnails for sharper appearance"
  ],
  "faqItems": [
    {
      "question": "What quality can I expect from Flux upscaling?",
      "answer": "Flux upscaling reconstructs texture and edge detail at up to 4× the original resolution. Output is suitable for professional print at 300 DPI when starting from a reasonably clean source image. Heavily compressed or very small inputs may show artifacts."
    },
    {
      "question": "How long does Flux upscaling take per image?",
      "answer": "On an RTX 3080, a single 4× upscale from 512×512 to 2048×2048 takes approximately 15–20 seconds. Batch processing 50 images completes in roughly 15 minutes depending on input sizes and GPU load."
    }
  ]
}
```
