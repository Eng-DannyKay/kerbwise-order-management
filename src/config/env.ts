function readRequired(name: string, value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} is not set. Copy .env.example to .env and set it.`)
  }
  return value.trim()
}

export const env = {
  apiBaseUrl: readRequired('VITE_API_BASE_URL', import.meta.env.VITE_API_BASE_URL).replace(/\/+$/, ''),
  apiToken: readRequired('VITE_API_TOKEN', import.meta.env.VITE_API_TOKEN),
}
