/** Names of required settings that are missing or blank. */
export function findMissingSettings(settings: Record<string, unknown>): string[] {
  return Object.entries(settings)
    .filter(([, value]) => typeof value !== 'string' || value.trim() === '')
    .map(([name]) => name)
}
