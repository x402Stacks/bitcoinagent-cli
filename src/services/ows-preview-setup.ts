import { access, mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'

import { NotFoundError, ValidationError } from '../core/errors.js'
import {
  writeAgentsatsConfig,
  type StacksNetwork,
} from '../core/stacks-config.js'
import type { WalletSetupResult } from '../types/commands.js'
import type { CommandRunner } from '../types/context.js'
import { parseOwsWalletAddress } from './wallet-service.js'

export const OWS_STACKS_PREVIEW_WARNING = 'Stacks support in OWS is still under development.'
export const OWS_STACKS_PREVIEW_REPO = 'https://github.com/tony1908/core.git'
export const OWS_STACKS_PREVIEW_COMMIT = '94e059363f172ed71fa72d7b0619508ae11ba0d1'

interface SetupOwsPreviewWalletOptions {
  env: NodeJS.ProcessEnv
  commandRunner: CommandRunner
  wallet: string
  network: StacksNetwork
  keyEncoding: 'compressed' | 'uncompressed'
  timestamp: string
}

function resolveAgentsatsHome(env: NodeJS.ProcessEnv) {
  const configuredHome = env.AGENTSATS_HOME?.trim()
  if (configuredHome) {
    return configuredHome
  }

  const home = env.HOME?.trim() || homedir()
  if (!home) {
    throw new ValidationError('HOME or AGENTSATS_HOME is required to locate the AgentSats directory.')
  }

  return path.join(home, '.agentsats')
}

function chainFromNetwork(network: StacksNetwork) {
  return network === 'mainnet' ? 'stacks:1' : 'stacks:2147483648'
}

function resolvePreviewPaths(env: NodeJS.ProcessEnv) {
  const agentsatsHome = resolveAgentsatsHome(env)
  const sourceDir = path.join(agentsatsHome, 'ows', 'pr-115', OWS_STACKS_PREVIEW_COMMIT)

  return {
    sourceDir,
    owsDir: path.join(sourceDir, 'ows'),
    owsCli: path.join(sourceDir, 'ows', 'target', 'release', 'ows'),
  }
}

function parseExistingWalletAddress(output: string, wallet: string, chain: string) {
  try {
    return parseOwsWalletAddress(output, wallet, chain)
  } catch (error) {
    if (error instanceof NotFoundError) {
      return undefined
    }

    throw error
  }
}

async function pathExists(value: string) {
  try {
    await access(value)
    return true
  } catch {
    return false
  }
}

async function ensurePreviewSource(commandRunner: CommandRunner, env: NodeJS.ProcessEnv, sourceDir: string) {
  await commandRunner('git', ['--version'], { env })
  await commandRunner('cargo', ['--version'], { env })
  await mkdir(path.dirname(sourceDir), { recursive: true })

  if (!(await pathExists(path.join(sourceDir, '.git')))) {
    await commandRunner('git', ['clone', OWS_STACKS_PREVIEW_REPO, sourceDir], { env })
  }

  await commandRunner('git', ['checkout', OWS_STACKS_PREVIEW_COMMIT], { env, cwd: sourceDir })
}

async function buildPreviewOws(commandRunner: CommandRunner, env: NodeJS.ProcessEnv, owsDir: string) {
  await commandRunner('cargo', ['build', '--release', '--bin', 'ows'], { env, cwd: owsDir })
}

async function ensureOwsWallet(
  commandRunner: CommandRunner,
  env: NodeJS.ProcessEnv,
  owsCli: string,
  wallet: string,
  chain: string,
) {
  const beforeCreate = await commandRunner(owsCli, ['wallet', 'list'], { env }).catch(() => ({
    stdout: '',
    stderr: '',
  }))
  const existingAddress = parseExistingWalletAddress(beforeCreate.stdout, wallet, chain)
  if (existingAddress) {
    return existingAddress
  }

  await commandRunner(owsCli, ['wallet', 'create', '--name', wallet], { env })

  const afterCreate = await commandRunner(owsCli, ['wallet', 'list'], { env })
  return parseOwsWalletAddress(afterCreate.stdout, wallet, chain)
}

export async function setupOwsPreviewWallet(options: SetupOwsPreviewWalletOptions): Promise<WalletSetupResult> {
  const { sourceDir, owsDir, owsCli } = resolvePreviewPaths(options.env)
  const chain = chainFromNetwork(options.network)

  await ensurePreviewSource(options.commandRunner, options.env, sourceDir)
  await buildPreviewOws(options.commandRunner, options.env, owsDir)

  const address = await ensureOwsWallet(options.commandRunner, options.env, owsCli, options.wallet, chain)
  const configPath = await writeAgentsatsConfig(options.env, {
    wallet: {
      provider: 'ows',
      wallet: options.wallet,
      chain,
      cliPath: owsCli,
      keyEncoding: options.keyEncoding,
      preview: {
        source: 'ows-pr-115',
        commit: OWS_STACKS_PREVIEW_COMMIT,
      },
    },
  })

  return {
    provider: 'ows',
    preview: true,
    warning: OWS_STACKS_PREVIEW_WARNING,
    wallet: options.wallet,
    address,
    network: options.network,
    chain,
    owsCli,
    sourceDir,
    configPath,
    commit: OWS_STACKS_PREVIEW_COMMIT,
    timestamp: options.timestamp,
  }
}
