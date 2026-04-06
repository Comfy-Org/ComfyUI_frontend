# Tutorial Content Template

You are generating a **tutorial-style** page for a ComfyUI workflow template. This format is inspired by the detailed step-by-step guides on docs.comfy.org.

## Purpose

Help users understand exactly how to use this workflow, with clear instructions for each step.

## Audience

- Beginners to ComfyUI
- Users who want to learn, not just run
- People searching "how to [task] in ComfyUI"

## Tone

- Educational and patient
- Technical but accessible
- Encouraging ("You can customize this by...")

## Required Output Structure

### extendedDescription (3 short paragraphs, 150-200 words)

Each paragraph should be 2-3 sentences max, separated by `\n\n`. Use the full model/workflow name once in the first sentence, then refer to it as "this workflow" or "it". Do not repeat the name more than twice total.

Follow the **PAS framework** from the system prompt:

**Paragraph 1 — Problem**: Start with "[Model name] [task]" in the first sentence. Name the task and what makes it worth solving.

- Example: "Flux inpainting enables precise object removal and background replacement in ComfyUI. Upload any image and paint over the area you want to change."

**Paragraph 2 — Agitate**: Briefly note why this was hard before — cloud costs, manual work, quality issues, hardware limits. One honest sentence, then pivot to how this workflow addresses it.

**Paragraph 3 — Solution**: What the user gets concretely — outputs, speed, who benefits. Keep it specific and actionable.

### howToUse (5-8 numbered steps)

Each step should follow this pattern:

1. **[Action verb] the [Node Name]**: [What to do]
   - Specific values, model names, or settings

Good example from our docs:

1. Ensure the `Load Diffusion Model` node has loaded `wan2.1_i2v_480p_14B_fp16.safetensors`
2. Ensure the `Load CLIP` node has loaded `umt5_xxl_fp8_e4m3fn_scaled.safetensors`
3. Upload your input image in the `Load Image` node
4. (Optional) Enter your description in the `CLIP Text Encoder` node
5. Click the `Queue` button or use `Ctrl+Enter` to run the workflow

### metaDescription (exactly 150-160 characters)

**Requirements**:

- Start with primary keyword (model + task)
- Include "ComfyUI" within first 60 characters
- End with benefit or differentiator
- Must be a complete sentence ending with a period

**Template**: "[Model] [task] in ComfyUI. [What user gets]. [Differentiator]."
**Example**: "Wan 2.1 video generation in ComfyUI. Create 480p videos from images. Step-by-step tutorial with one-click setup." (138 chars)

### suggestedUseCases (3-5 items)

Specific, actionable use cases starting with action verbs:

- "Remove unwanted objects from product photography"
- "Generate consistent character poses for animation"
- "Create variations of logo designs"

### faqItems (3-5 questions)

**Structure each FAQ as an object with `question` and `answer` keys.**

**Question requirements**:

- Start with "How", "What", "Can", "Why", or "Is"
- Include model name in at least 2 questions
- Target "People Also Ask" search intent

**Answer requirements**:

- 2-3 sentences minimum, never just "Yes" or "No"
- First sentence directly answers the question
- Include specific details (values, steps, or model names)
- End with actionable next step when appropriate

**Good examples**:

- Q: "How do I install [model] for ComfyUI?"
  A: "Download [model].safetensors from Hugging Face and place it in your ComfyUI/models/checkpoints folder. The model requires approximately X GB of disk space. Restart ComfyUI to load the new model."
- Q: "What VRAM is required for [workflow]?"
  A: "[Model] requires a minimum of X GB VRAM for standard generation. For optimal performance at higher resolutions, 12+ GB VRAM is recommended. Users with less VRAM can enable fp8 mode in the settings."
- Q: "Can I run [workflow] locally without a GPU?"
  A: "Running [model] without a GPU is not recommended due to extremely slow generation times. CPU-only inference may take 10-30x longer than GPU. Consider cloud options or smaller model variants for limited hardware."

## Keywords to Naturally Include

- "ComfyUI workflow"
- "ComfyUI [model name]"
- "[task] tutorial"
- "step-by-step"
- The model names from the template metadata

## What NOT to Do

- Don't use marketing language — see banned phrases in the system prompt
- Don't mention pricing or costs
- Don't invent model capabilities not in the data
- Don't make up specific node names not in the workflow
- Don't write dense, unscannable paragraphs — keep each paragraph to 2-3 sentences

## Example Output

Below is an example of ideal tutorial content for a Wan 2.1 image-to-video workflow:

```json
{
  "extendedDescription": "Wan 2.1 image-to-video generation transforms a single still image into a short animated video clip in ComfyUI. This workflow uses the 14B parameter model to produce 480p video with natural motion and temporal consistency from your uploaded reference image.\n\nThe Wan 2.1 model excels at preserving the visual style and composition of the input image while adding believable motion. It runs on GPUs with 12 GB or more VRAM using the fp16 checkpoint, and an fp8 variant is available for cards with less memory.\n\nContent creators, animators, and social media producers can use this workflow to bring static artwork to life without manual keyframing. Load your image, optionally add a motion description, and generate a video in under a minute.",
  "howToUse": [
    "Ensure the Load Diffusion Model node has loaded wan2.1_i2v_480p_14B_fp16.safetensors",
    "Ensure the Load CLIP node has loaded umt5_xxl_fp8_e4m3fn_scaled.safetensors",
    "Upload your input image in the Load Image node",
    "Enter a motion description in the CLIP Text Encoder node (optional)",
    "Set the frame count in the EmptyHunyuanLatentVideo node (default 49 frames)",
    "Click the Queue button or press Ctrl+Enter to run the workflow"
  ],
  "metaDescription": "Wan 2.1 image-to-video workflow for ComfyUI. Turn still images into 480p animated clips. One-click template with step-by-step guide.",
  "suggestedUseCases": [
    "Animate product photography for e-commerce listings",
    "Create short motion clips from digital artwork",
    "Generate social media video content from static images",
    "Produce animated storyboard frames for pre-visualization"
  ],
  "faqItems": [
    {
      "question": "What VRAM is required for the Wan 2.1 video workflow?",
      "answer": "Wan 2.1 at 14B parameters requires at least 12 GB VRAM with the fp16 checkpoint. An fp8 variant is available for GPUs with 8–10 GB VRAM, though generation will be slower. For best results at 480p, 16 GB or more is recommended."
    },
    {
      "question": "How long does Wan 2.1 take to generate a video?",
      "answer": "On an RTX 4090, a 49-frame clip at 480p takes roughly 30–45 seconds. Lower-end GPUs may need 2–3 minutes. Generation time scales linearly with the number of frames."
    },
    {
      "question": "Can I control the motion direction in this workflow?",
      "answer": "You can guide motion by entering a text description in the CLIP Text Encoder node, such as 'camera slowly pans left' or 'subject walks forward.' The model interprets these prompts as motion hints, though results vary by scene complexity."
    }
  ]
}
```
