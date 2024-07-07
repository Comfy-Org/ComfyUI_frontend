import { copy } from 'fs-extra';
import { config } from "dotenv";
config();

const sourceDir = './dist';
const targetDir = process.env.DEPLOY_COMFYUI_DIR;

copy(sourceDir, targetDir)
  .then(() => {
    console.log(`Directory copied successfully! ${sourceDir} -> ${targetDir}`);
  })
  .catch((err) => {
    console.error('Error copying directory:', err);
  });