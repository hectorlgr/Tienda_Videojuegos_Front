import { postJson, HttpError } from './httpClient.js'

const unavailable = 'Identidad no ofrece una consulta administrativa de usuarios.'

export async function getUsers() {
  throw new HttpError(unavailable, 501)
}

export async function getUserById() {
  throw new HttpError(unavailable, 501)
}

export function registerCustomer({ nombre, email, password }) {
  return postJson('/auth/register/cliente', { nombre, email, password })
}
