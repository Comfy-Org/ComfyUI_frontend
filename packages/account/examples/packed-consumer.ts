import { accountPackageId } from '../src/core/index'

if (accountPackageId() !== '@comfyorg/account')
  throw new Error('invalid package')
