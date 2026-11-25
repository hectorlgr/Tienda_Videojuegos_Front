import { getJson, postJson } from './httpClient.js'

const adminUsersPath = '/api/v1/admin/usuarios'

export function getUsers() {
  return getJson(adminUsersPath)
}

export function getUserById(id) {
  return getJson(`${adminUsersPath}/${id}`)
}

export function registerCustomer({ nombre, email, password }) {
  return postJson('/auth/register/cliente', { nombre, email, password })
}
