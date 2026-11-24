import { readAccessToken } from '../utils/authSession.js'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:9090'

export class HttpError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

export function getJson(resource, query = {}) {
  return request(resource, 'GET', { query })
}

export function postJson(resource, data) {
  return sendJson(resource, 'POST', data)
}

export function postForm(resource, body) {
  return request(resource, 'POST', { body })
}

function sendJson(resource, method, data) {
  return request(resource, method, {
    body: JSON.stringify(data),
    contentType: 'application/json',
  })
}

function isProtected(path, method) {
  return /^\/api\/admin(?:\/|$)/.test(path)
    || /^\/api\/productos\/rawg(?:\/|$)/.test(path)
    || (['POST', 'PUT', 'DELETE'].includes(method) && /^\/api\/productos(?:\/|$)/.test(path))
}

async function request(resource, method, { query = {}, body, contentType } = {}) {
  const url = new URL('/' + resource.replace(/^\/+/, ''), API_BASE_URL)
  url.search = new URLSearchParams(query).toString()
  const headers = { Accept: 'application/json' }
  if (contentType) headers['Content-Type'] = contentType
  const token = isProtected(url.pathname, method) ? readAccessToken() : null
  if (token) headers.Authorization = 'Bearer ' + token

  let response
  try {
    response = await fetch(url, { method, headers, body })
  } catch (cause) {
    throw new Error('No se pudo conectar con la API en ' + url.origin + '.', { cause })
  }

  const text = response.status === 204 ? '' : await response.text()
  let data = null
  if (text.trim()) {
    try {
      data = JSON.parse(text)
    } catch (cause) {
      if (response.ok) throw new Error('La API devolvió una respuesta que no es JSON.', { cause })
    }
  }
  if (!response.ok) {
    const fallback = {
      401: 'La sesión no es válida o expiró.',
      403: 'No tienes permiso para realizar esta acción.',
      409: 'El código comercial o la variante ya está registrada.',
    }
    const message = typeof data?.message === 'string' && data.message.trim()
      ? data.message
      : fallback[response.status] ?? ('Error HTTP ' + response.status + ' al consultar ' + url.pathname + '.')
    throw new HttpError(message, response.status)
  }
  return data
}
