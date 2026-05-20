import { createHash } from 'node:crypto'
import { privateKeyToAccount } from 'x402-stacks'

const walletFixtureMaterial = 'agentsats wallet fixture v1'

export const TEST_PRIVATE_KEY = createHash('sha256')
  .update(walletFixtureMaterial)
  .digest('hex')

export const TEST_TESTNET_ADDRESS = privateKeyToAccount(TEST_PRIVATE_KEY, 'testnet').address
