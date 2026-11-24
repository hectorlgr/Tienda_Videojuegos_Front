export function publicAsset(path) {
  if (/^(?:https?:\/\/|data:image\/)/i.test(path)) return path
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`
}
