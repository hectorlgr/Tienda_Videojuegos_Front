import { getJson, postJson } from './httpClient'
import { getCommercialFields } from './productService'

const RAWG_PATH = '/api/productos/rawg'

export function searchRawgGames(query, page = 1) {
  return getJson(RAWG_PATH + '/buscar', { query: query.trim(), page })
}

export function getRawgGame(rawgId) {
  return getJson(RAWG_PATH + '/' + rawgId)
}

export function importRawgGame(rawgId, product, inventory) {
  return postJson(RAWG_PATH + '/' + rawgId + '/importar', getCommercialFields(product, inventory))
}
