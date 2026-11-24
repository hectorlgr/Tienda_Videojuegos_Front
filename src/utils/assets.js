export function publicAsset(path) {
  if (/^(?:https?:\/\/|data:image\/)/i.test(path)) return path
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`
}

export function isExternalImageUrl(value) {
  if (typeof value !== 'string' || value.length > 2048 || !/^https?:\/\/[^\s]+$/.test(value)) return false
  try {
    const url = new URL(value)
    return Boolean(url.hostname) && !url.username && !url.password
  } catch {
    return false
  }
}
