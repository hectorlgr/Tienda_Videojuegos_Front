import { readAccessToken } from '../utils/authSession.js'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:9090'

export class HttpError extends Error {
  constructor(message, status, data = null) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.data = data
  }
}

export function getJson(resource, query = {}) {
  return request(resource, 'GET', { query })
}

export function postJson(resource, data, options) {
  return sendJson(resource, 'POST', data, options)
}

export function patchJson(resource, data) {
  return sendJson(resource, 'PATCH', data)
}

export function postForm(resource, body) {
  return request(resource, 'POST', { body })
}

function sendJson(resource, method, data, options) {
  return request(resource, method, {
    ...options,
    body: JSON.stringify(data),
    contentType: 'application/json',
  })
}

function isProtected(path, method) {
  return /^\/api\/admin(?:\/|$)/.test(path)
    || (path === '/api/v1/usuarios/me' && ['GET', 'PATCH'].includes(method))
    || (method === 'GET' && /^\/api\/pedidos\/(?:mis-pedidos|\d+)$/.test(path))
    || (method === 'POST' && path === '/api/pedidos')
    || /^\/api\/productos\/rawg(?:\/|$)/.test(path)
    || (['POST', 'PUT', 'DELETE'].includes(method) && /^\/api\/productos(?:\/|$)/.test(path))
}

async function request(resource, method, { query = {}, body, contentType, idempotencyKey, withStatus = false } = {}) {
  const url = new URL('/' + resource.replace(/^\/+/, ''), API_BASE_URL)
  url.search = new URLSearchParams(query).toString()
  const headers = { Accept: 'application/json' }
  if (contentType) headers['Content-Type'] = contentType
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey
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
      409: url.pathname === '/auth/register/cliente'
        ? 'Ya existe una cuenta con ese correo.'
        : url.pathname === '/api/pedidos'
          ? 'No pudimos verificar este intento de compra.'
          : 'El código comercial o la variante ya está registrada.',
    }
    const message = typeof data?.message === 'string' && data.message.trim()
      ? data.message
      : fallback[response.status] ?? ('Error HTTP ' + response.status + ' al consultar ' + url.pathname + '.')
    throw new HttpError(message, response.status, data)
  }
  return withStatus ? { status: response.status, data } : data
}
