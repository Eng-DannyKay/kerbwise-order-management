import { findMissingSettings } from './check-config'

const settings = {
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  VITE_API_TOKEN: import.meta.env.VITE_API_TOKEN,
}

/** Required settings that are missing; the app shows a setup message instead of running. */
export const missingSettings = findMissingSettings(settings)

export const env = {
  apiBaseUrl: (settings.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, ''),
  apiToken: (settings.VITE_API_TOKEN ?? '').trim(),
}
