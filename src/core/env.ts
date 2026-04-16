export type Environment = {
  ci: boolean
  noColor: boolean
}

export function readEnvironment(env: NodeJS.ProcessEnv = process.env): Environment {
  return {
    ci: env.CI === '1' || env.CI === 'true',
    noColor: Object.hasOwn(env, 'NO_COLOR'),
  }
}
