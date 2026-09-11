// What a user sees on the panel for each recorded turn: the complete assistant
// text, and the tool call groups in order with each row's label, multiplicity
// and failure state. Explicit per recording, so the replay never predicts
// production rendering.
interface ExpectedToolRow {
  label: string
  count: number
  failed: boolean
}

export interface ExpectedTurn {
  text: string
  groups: ExpectedToolRow[][]
}

export const RECORDED_EXPECTATIONS: Partial<Record<string, ExpectedTurn[]>> = {
  'agent-l4-zimage-string-node-prompt': [
    {
      text: "I'm on the \"Text to image\" tab, and the text node is in and wired: your prompt \"a red bicycle on a pier at dusk\" now feeds the positive prompt. I also connected two things the graph was missing (an empty negative prompt and the blank canvas the sampler starts from) — without those it couldn't have run at all. I couldn't run it, though. The image model this workflow is built on isn't installed on this server — the checkpoint slot reports no available files at all, so there's nothing valid to point it at, and I'd rather tell you than silently swap in a different model and hand you an image that isn't the one you set up. Two ways forward, your call: Install the checkpoint this workflow expects, then hit Run — the graph is otherwise complete and correct. Let me rebuild it on one of the hosted image models that are available here (Flux, Ideogram, Stable Image and others), keeping your prompt. That's a different model than your current setup, so I'd want your OK first.",
      groups: [
        [
          {
            label: 'Switched tabs',
            count: 1,
            failed: false
          },
          {
            label: 'Print workflow',
            count: 1,
            failed: false
          },
          {
            label: 'Find nodes',
            count: 1,
            failed: false
          }
        ],
        [
          {
            label: 'Apply ops',
            count: 1,
            failed: false
          },
          {
            label: 'Validate',
            count: 1,
            failed: true
          },
          {
            label: 'Show node',
            count: 1,
            failed: false
          },
          {
            label: 'List model picks',
            count: 1,
            failed: true
          },
          {
            label: 'List generate models',
            count: 1,
            failed: false
          },
          {
            label: 'Print workflow',
            count: 1,
            failed: false
          }
        ]
      ]
    }
  ],
  'agent-rec-add-set-delete': [
    {
      text: "I'm on the \"Text to image\" tab now, and the second text encode node is in place, taking its text understanding from the same checkpoint loader as the first one. Two things worth flagging, since I only did exactly what you asked: Its text box is empty, and it isn't connected onward to anything yet — most likely you want it as the negative prompt into the sampler, whose negative input is currently empty. That sampler is also missing its image-size input, so the workflow won't run as it stands regardless of this new node. Say the word and I'll wire the new node in as the negative prompt (with whatever text you want) and add the missing size input so it's ready to run.",
      groups: [
        [
          {
            label: 'Switched tabs',
            count: 1,
            failed: false
          },
          {
            label: 'Print workflow',
            count: 1,
            failed: false
          },
          {
            label: 'Apply ops',
            count: 1,
            failed: false
          },
          {
            label: 'Print workflow',
            count: 1,
            failed: false
          }
        ]
      ]
    },
    {
      text: 'Done — the new node now reads "blurry, low quality". It\'s still not wired into the sampler, so it won\'t affect a render until I connect it as the negative prompt. Want me to do that?',
      groups: [
        [
          {
            label: 'Set widget',
            count: 1,
            failed: false
          }
        ]
      ]
    },
    {
      text: 'Removed — the canvas is back to the five original nodes.',
      groups: [
        [
          {
            label: 'Delete node',
            count: 1,
            failed: false
          }
        ]
      ]
    }
  ],
  'agent-rec-batched-ops': [
    {
      text: "Done — I'm now on your \"Text to image\" tab, and both new text prompt nodes are on the canvas with their CLIP inputs wired from the checkpoint loader. They're not connected to anything downstream yet, so tell me if you'd like one hooked up as a negative prompt.",
      groups: [
        [
          {
            label: 'Switched tabs',
            count: 1,
            failed: false
          },
          {
            label: 'Print workflow',
            count: 1,
            failed: false
          },
          {
            label: 'Apply ops',
            count: 1,
            failed: false
          }
        ]
      ]
    }
  ],
  'agent-rec-cancelled-turn': [
    {
      text: 'Stopped at your request. Before stopping I made 1 edit to your canvas.',
      groups: [
        [
          {
            label: 'Switched tabs',
            count: 1,
            failed: false
          },
          {
            label: 'Ls nodes',
            count: 1,
            failed: false
          }
        ],
        [
          {
            label: 'Add node',
            count: 1,
            failed: false
          }
        ]
      ]
    }
  ],
  'agent-rec-clarifying-question': [
    {
      text: "I'm on the \"Text to image\" tab now, but I don't have any record of your usual sampler settings — nothing saved from earlier in our conversation, and this is the first workflow I've seen from you. Rather than guess and quietly change your image, tell me the values and I'll set them (and remember them for next time). Right now the sampler is on: Steps: 20 CFG: 7 Sampler: euler Scheduler: normal Denoise: 1.0 Seed: 0, randomized each run Just say what you want them changed to — e.g. \"30 steps, cfg 4.5, dpmpp_2m karras\" — or tell me the name of a workflow where I can read them off, and I'll copy them across. One other thing worth flagging: this graph is missing a negative prompt and an image-size input into the sampler, so it won't run as-is. I can add both while I'm in there.",
      groups: [
        [
          {
            label: 'Switched tabs',
            count: 1,
            failed: false
          },
          {
            label: 'List workflows',
            count: 1,
            failed: false
          },
          {
            label: 'Print workflow',
            count: 1,
            failed: false
          }
        ]
      ]
    },
    {
      text: "Steps are now 30, and I've noted that as your default for next time. The graph still won't run as-is — the sampler has no negative prompt or image-size input wired in. Want me to add those?",
      groups: [
        [
          {
            label: 'List slots',
            count: 1,
            failed: false
          },
          {
            label: 'Saved a preference',
            count: 1,
            failed: false
          },
          {
            label: 'Set widget',
            count: 1,
            failed: false
          }
        ]
      ]
    }
  ],
  'agent-rec-refiner-between': [
    {
      text: "The refiner is in and wired: the first sampler's latent feeds it, and its own latent now drives the VAE decoder into your save node. Two things were already unfinished in this graph before I touched it, and they'll block a run: Neither sampler has a negative prompt connected, and there's no empty-latent node feeding the first sampler. The checkpoint it points at isn't installed here, so no model file is actually available. I set the refiner to 20 steps at 0.5 denoise, which is a sensible second-pass default. Want me to add the missing negative prompt and latent-size nodes and pick an installed checkpoint so it can actually run?",
      groups: [
        [
          {
            label: 'Switched tabs',
            count: 1,
            failed: false
          },
          {
            label: 'Print workflow',
            count: 1,
            failed: false
          },
          {
            label: 'Apply ops',
            count: 1,
            failed: false
          },
          {
            label: 'Print workflow',
            count: 1,
            failed: false
          },
          {
            label: 'Validate',
            count: 1,
            failed: true
          }
        ]
      ]
    }
  ],
  'agent-rec-replace-prompt-encoder': [
    {
      text: 'Done — I\'m on the "Text to image" tab, the old positive prompt node is gone, and a fresh one is in its place, taking CLIP from the checkpoint loader and feeding the sampler\'s positive input. I carried over the same prompt text ("a photo of a pier"). One thing unrelated to this swap: the sampler\'s negative prompt and empty latent inputs were already unconnected before I started, so the graph won\'t run until those are filled in. Want me to add them?',
      groups: [
        [
          {
            label: 'Switched tabs',
            count: 1,
            failed: false
          },
          {
            label: 'Print workflow',
            count: 1,
            failed: false
          },
          {
            label: 'Apply ops',
            count: 1,
            failed: false
          },
          {
            label: 'Delete node',
            count: 1,
            failed: false
          },
          {
            label: 'Print workflow',
            count: 1,
            failed: false
          }
        ]
      ]
    }
  ],
  'agent-rec-set-widget-existing': [
    {
      text: 'You\'re now on the "Text to image" tab, with steps at 30 and cfg at 5. Nothing else was touched.',
      groups: [
        [
          {
            label: 'Switched tabs',
            count: 1,
            failed: false
          },
          {
            label: 'Ls nodes',
            count: 1,
            failed: false
          },
          {
            label: 'List slots',
            count: 1,
            failed: false
          },
          {
            label: 'Apply ops',
            count: 1,
            failed: false
          },
          {
            label: 'List slots',
            count: 1,
            failed: false
          }
        ]
      ]
    }
  ],
  'agent-rec-text-only-answer': [
    {
      text: 'I\'m on the "Text to image" tab now. It\'s a standard SDXL text-to-image setup: it loads the SDXL base model, turns the prompt — currently "a photo of a pier" — into guidance, generates an image over 20 steps, and saves the result. One thing to flag: it isn\'t runnable as-is. Two inputs on the generation step are still empty — there\'s no negative prompt wired in, and no blank canvas/image-size node telling it what dimensions to make. Want me to add those so you can run it?',
      groups: [
        [
          {
            label: 'Switched tabs',
            count: 1,
            failed: false
          },
          {
            label: 'Print workflow',
            count: 1,
            failed: false
          }
        ]
      ]
    }
  ],
  'agent-rec-three-sequential-adds': [
    {
      text: 'All three nodes are on the "Text to image" tab now — a multiline text box, an empty latent, and a text encoder — left unconnected and unconfigured as you asked.',
      groups: [
        [
          {
            label: 'Switched tabs',
            count: 1,
            failed: false
          },
          {
            label: 'Add node',
            count: 3,
            failed: false
          }
        ]
      ]
    }
  ],
  'agent-rec-tool-error': [
    {
      text: 'I\'m now on the "Text to image" tab, but there\'s no node called "DoesNotExist" — nothing was added, and the canvas is unchanged. If you tell me what you actually want that node to do (e.g. upscale, add a LoRA, save output), I\'ll find the real one and wire it in.',
      groups: [
        [
          {
            label: 'Switched tabs',
            count: 1,
            failed: false
          },
          {
            label: 'Add node',
            count: 1,
            failed: true
          }
        ]
      ]
    }
  ],
  'agent-rec-two-turn-dependent-edit': [
    {
      text: 'I\'m on the "Text to image" tab now, and the second text box is added with "blurry, low quality" and fed from the checkpoint loader. One thing worth flagging: it isn\'t connected to anything downstream yet, so it has no effect on the image. The sampler\'s negative input is currently empty (and its latent input too) — say the word and I\'ll wire this new text into the negative slot.',
      groups: [
        [
          {
            label: 'Switched tabs',
            count: 1,
            failed: false
          },
          {
            label: 'Print workflow',
            count: 1,
            failed: false
          },
          {
            label: 'Apply ops',
            count: 1,
            failed: false
          },
          {
            label: 'Print workflow',
            count: 1,
            failed: false
          }
        ]
      ]
    },
    {
      text: 'Connected — the "blurry, low quality" text now feeds the negative input. The graph still won\'t run as-is: nothing is feeding the sampler\'s latent input, so it needs an empty latent (which is also where the image size gets set). Want me to add one?',
      groups: [
        [
          {
            label: 'Connect',
            count: 1,
            failed: false
          },
          {
            label: 'Print workflow',
            count: 1,
            failed: false
          }
        ]
      ]
    }
  ],
  'agent-workflow-editing-05': [
    {
      text: "Done — the side-by-side comparison is on your canvas: the original image and the edited result now go into a stitch node (edited placed to the right of the original, sizes matched), and that combined image is what gets saved. Two things worth knowing: The gap/spacing setting on that node can't be changed from here, so the two images sit flush against each other. You can set a spacing value directly on the node if you want a divider. The rest of this workflow was already incomplete before I touched it — the sampler has no model loaded and no prompt text, and the encode/decode steps have no VAE connected. It won't run until those are filled in. Want me to wire up a checkpoint and prompt boxes for you?",
      groups: [
        [
          {
            label: 'Switched tabs',
            count: 1,
            failed: false
          },
          {
            label: 'Print workflow',
            count: 1,
            failed: false
          },
          {
            label: 'Find nodes',
            count: 1,
            failed: false
          },
          {
            label: 'Apply ops',
            count: 1,
            failed: false
          },
          {
            label: 'List slots',
            count: 1,
            failed: false
          },
          {
            label: 'Set widget',
            count: 1,
            failed: true
          },
          {
            label: 'Validate',
            count: 1,
            failed: true
          }
        ]
      ]
    }
  ]
}
