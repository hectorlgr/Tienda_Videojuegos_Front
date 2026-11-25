import { getJson, postJson } from './httpClient.js'

async function getOrderCollection(path) {
  const data = await getJson(path)
  if (Array.isArray(data?._embedded?.pedidos)) return data._embedded.pedidos
  if (Array.isArray(data?.content)) return data.content
  return Array.isArray(data) ? data : []
}

export function getMyOrders() {
  return getOrderCollection('/api/pedidos/mis-pedidos')
}

export function getMyOrder(id) {
  return getJson(`/api/pedidos/${id}`)
}

export function createOrder(payload, idempotencyKey) {
  return postJson('/api/pedidos', payload, { idempotencyKey, withStatus: true })
}

export async function getOrders() {
  const orders = await getOrderCollection('/api/admin/pedidos')
  return orders.map(order => ({
    ...order,
    usuarioId: order.compradorId,
    nombre: order.entrega?.destinatario,
    region: order.entrega?.region,
    comuna: order.entrega?.comuna,
    direccion: order.entrega?.direccion,
    montoTotal: order.totalFinal,
  }))
}
