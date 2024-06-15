# ComfyUI_frontend

Front end of ComfyUI written in TypeScript

## The grand migration to TypeScript

This repo is an experiment trying to migrate ComfyUI's front-end code to TypeScript for a better front-end development experience.

## Tasks

- [x] Gradually migrate the code to TypeScript in this repo, while monitoring the change
in ComfyUI's front-end code.
- [ ] Using zod schema to add static/runtime type check for core structures.
- [ ] Figure out a way to reliably embed compiled code to ComfyUI distribution.

  - It can be a bot regularly pulling the new changes in the front-end repo and submitting them to the main repo. (Chrome does a similar process for Chrome devtools, which is hosted in a separate repo.)


## Development

Currently the dev server does not work as the ws runs on root path '/', and all api endpoints are all defined on '/'. There might need to be some API changes before dev server can work.

- Run `npm install` to install the necessary packages
- Start local ComfyUI backend at `localhost:8188`
- Run `npm run dev` to start the dev server

## Test

- `npm run build` to build the front end
- `cd tests-ui`
- `npm i` to install all test dependencies
- `npm run test:generate` to fetch `data/object_info.json`
- `npm run test` to execute all unit tests.
