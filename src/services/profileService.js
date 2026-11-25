import { getJson, patchJson } from './httpClient'

const PROFILE_PATH = '/api/v1/usuarios/me'

export function getProfile() {
  return getJson(PROFILE_PATH)
}

export function updateProfile({ telefono, direccion, region, comuna }) {
  return patchJson(PROFILE_PATH, { telefono, direccion, region, comuna })
}
