export interface ParsedProxy {
  rules: string
  username: string
  password: string
}

export function parseProxy(input: string): ParsedProxy | null {
  const value = input.trim()
  if (!value) return null
  try {
    const url = new URL(value.includes('://') ? value : `http://${value}`)
    if (!url.hostname) return null
    const scheme = url.protocol.replace(':', '')
    if (!['http', 'https', 'socks4', 'socks5'].includes(scheme)) return null
    return {
      rules: `${scheme}://${url.host}`,
      username: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password)
    }
  } catch {
    return null
  }
}
