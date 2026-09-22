# Workflow API coverage — September 21, 2026

The 29 regular launch workflows have exported API graphs and can target the shared
Cloud API, `POST https://cloud.comfy.org/api/v2/jobs`. They do not need a separate
endpoint per template: the request carries the workflow graph. This is a documented
integration path and structural compatibility assessment, not a successful live-run
certification of all templates.

The object-removal demo has a real exported graph, but no deployed server. After
provisioning its models and custom nodes through Comfy API, it targets
`POST https://{deployment}.run.comfy.app/api/v2/jobs`. Its playground remains simulated.
The code requires an actual `COMFY_BASE_URL`; it does not invent a working URL.

## Per-workflow assessment

All listed workflows have Python, TypeScript and cURL examples with the actual
node/input bindings, media uploads, API-key authentication and job submission.
Python and TypeScript also wait for completion and save outputs; cURL reads the
current status and explains how to continue polling. Each API tab downloads its
matching `.api.json` file. The MiniMax image-to-video alternative remains an external
template link and is not a separate launch workflow or executable variant here.

| Workflow                               | API route assessment | Local media inputs                                      |
| -------------------------------------- | -------------------- | ------------------------------------------------------- |
| Remove an object from a video          | Deployment required  | Your footage (video)                                    |
| Turn an image into a video             | Cloud v2 candidate   | Starting image (image)                                  |
| Create a video from references         | Cloud v2 candidate   | First reference (image), Second reference (image)       |
| Connect two images with motion         | Cloud v2 candidate   | Start frame (image), End frame (image)                  |
| Change a video’s background            | Cloud v2 candidate   | Your video (video)                                      |
| Expand a video’s frame                 | Cloud v2 candidate   | Your video (video), Reference frame (image)             |
| Change a material                      | Cloud v2 candidate   | Your original image (image), Material reference (image) |
| Copy movement from a video             | Cloud v2 candidate   | Your character (image), Movement reference (video)      |
| Make your character talk               | Cloud v2 candidate   | Your character (image), Voice recording (audio)         |
| Replace a character in a video         | Cloud v2 candidate   | Your character (image), Reference performance (video)   |
| See your subject from a new angle      | Cloud v2 candidate   | Your subject (image)                                    |
| Upscale and restore detail             | Cloud v2 candidate   | Your image (image)                                      |
| Upscale a video                        | Cloud v2 candidate   | Your video (video)                                      |
| Edit a selected region                 | Cloud v2 candidate   | Your image (image), Edit mask (image)                   |
| Make your character sing               | Cloud v2 candidate   | Your character (image), Song or rap recording (audio)   |
| Extend an image’s borders              | Cloud v2 candidate   | Your image (image)                                      |
| Create a product mockup                | Cloud v2 candidate   | Reference image 1 (image), Reference image 2 (image)    |
| Remove an image background             | Cloud v2 candidate   | Your image (image)                                      |
| Animate a scene from a reference sheet | Cloud v2 candidate   | Character, props, and setting reference sheet (image)   |
| Separate an image into editable layers | Cloud v2 candidate   | Your image (image)                                      |
| Create a character turnaround          | Cloud v2 candidate   | Your character (image)                                  |
| Try an outfit on a character           | Cloud v2 candidate   | Your character (image), Outfit reference (image)        |
| Match lighting from a reference        | Cloud v2 candidate   | Your portrait (image), Lighting reference (image)       |
| Upscale an illustration                | Cloud v2 candidate   | Your illustration (image)                               |
| Sharpen a product photo                | Cloud v2 candidate   | Your product (image)                                    |
| Put your product in a new scene        | Cloud v2 candidate   | Your product (image), New background (image)            |
| Turn a product photo into a video      | Cloud v2 candidate   | Your product (image)                                    |
| Restore archival footage               | Cloud v2 candidate   | Your footage (video)                                    |
| Restore portrait detail                | Cloud v2 candidate   | Your portrait (image)                                   |
| Remove an object                       | Cloud v2 candidate   | Your image (image), Edit mask (image)                   |

## Validation and limits

- All 30 generated TypeScript examples execute through the installed official
  SDK against a local mock transport. Checks cover uploaded asset references,
  node IDs, edited inputs, job payloads, endpoint selection and downloaded bytes.
- Python examples pass parsing and Bash examples pass syntax checks. A cURL
  deployment example also executes with a stubbed transport, including quoted
  prompt text. No actual API key or paid job is used by these tests.
- Every media loader in the exported graphs has an input binding. Outpainting
  retains an image input even though its image-conditioning bypass is enabled;
  its required LoadImage branch is now exposed as Reference frame, rather than
  depending on a server-side `example.png` file.
- Regular graphs previously passed CLI structural validation against Cloud node
  definitions. See WORKFLOWS_PROTOTYPE.md for warnings, model availability and
  the earlier insufficient-credit response. Runtime availability, costs and
  completed output quality still require funded live validation.
- API examples use server-side API keys. They do not change the website's existing
  browser-session execution/authentication contract. Keep keys out of client code.
- The deployment demo still needs provisioning, a real URL and live validation.

## Primary references

- [Comfy API v2 overview](https://docs.comfy.org/api-reference/v2/overview):
  shared jobs/assets contract, Cloud and deployment base URLs, Bearer authentication.
- [Official SDK guide](https://docs.comfy.org/development/api-development/sdks):
  Python and TypeScript packages, workflow inputs, asset uploads and output retrieval.
- [TypeScript SDK source](https://github.com/Comfy-Org/comfy-typescript-sdk):
  setInput, submit and asset serialization contract.
- [Python SDK source](https://github.com/Comfy-Org/comfy-python-sdk):
  from_file, set_input, submit and result interfaces.
- [Comfy API deployment overview](https://docs.comfy.org/development/serverless/overview):
  deployment lifecycle and model/custom-node environment.
