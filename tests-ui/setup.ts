import { existsSync, mkdirSync, writeFileSync } from 'fs'
import http from 'http'
import { resolve } from 'path'

async function setup() {
  await new Promise<void>((res, rej) => {
    http
      .get('http://127.0.0.1:8188/object_info', (resp) => {
        let data = ''
        resp.on('data', (chunk) => {
          data += chunk
        })
        resp.on('end', () => {
          // Modify the response data to add some checkpoints
          const objectInfo = JSON.parse(data)
          objectInfo.CheckpointLoaderSimple.input.required.ckpt_name[0] = [
            'model1.safetensors',
            'model2.ckpt'
          ]
          objectInfo.VAELoader.input.required.vae_name[0] = [
            'vae1.safetensors',
            'vae2.ckpt'
          ]

          data = JSON.stringify(objectInfo, undefined, '\t')

          const outDir = resolve('./tests-ui/data')
          if (!existsSync(outDir)) {
            mkdirSync(outDir)
          }

          const outPath = resolve(outDir, 'object_info.json')
          console.log(
            `Writing ${Object.keys(objectInfo).length} nodes to ${outPath}`
          )
          writeFileSync(outPath, data, {
            encoding: 'utf8'
          })
          res()
        })
      })
      .on('error', rej)
  })
}

setup()
