import { assertNumericId } from '../utils/ids.js'
import { isExternalImageUrl } from '../utils/assets.js'
import { getJson, postForm, postJson, HttpError } from './httpClient.js'

const PRODUCT_PATH = '/api/productos'
const CATEGORY_TO_API = { juego: 'VIDEOJUEGO', consola: 'CONSOLA', accesorio: 'ACCESORIO', figura: 'FIGURA' }
const CATEGORY_FROM_API = Object.fromEntries(Object.entries(CATEGORY_TO_API).map(([key, value]) => [value, key]))

export class ProductNotFoundError extends HttpError {
  constructor(productId) {
    super('No existe el producto con ID ' + productId + '.', 404)
    this.name = 'ProductNotFoundError'
  }
}

function normalizeProduct(product) {
  return {
    ...product,
    categoria: CATEGORY_FROM_API[product.categoria] ?? product.categoria,
    formato: product.formato?.toLowerCase() ?? null,
    descripcionLarga: product.descripcion,
    imagen: product.imagenUrl,
  }
}

async function getProductCollection(path) {
  const response = await getJson(path)
  const products = response?._embedded?.productos ?? []
  return Array.isArray(products) ? products.map(normalizeProduct) : []
}

export function getProducts() {
  return getProductCollection(PRODUCT_PATH)
}

export function getAdminProducts() {
  return getProductCollection('/api/admin/productos')
}

export function getCommercialFields(product, inventory) {
  return {
    codigo: product.codigo,
    plataforma: product.categoria === 'juego' ? product.plataforma?.trim() || null : null,
    formato: product.categoria === 'juego' ? product.formato?.toUpperCase() || null : null,
    precio: Number(product.precio),
    precioOferta: product.enOferta ? Number(product.precioOferta) : null,
    enOferta: product.enOferta === true,
    stock: Number(inventory.stock),
    stockCritico: inventory.stockCritico == null || inventory.stockCritico === '' ? null : Number(inventory.stockCritico),
    habilitado: true,
  }
}

export function createProduct(product, inventory) {
  const imagenUrl = product.imagen?.trim() || null
  const images = [...new Set(product.imagenes)].filter(url => url !== imagenUrl)
  if ((imagenUrl && !isExternalImageUrl(imagenUrl)) || images.some(url => !isExternalImageUrl(url)) || images.length > 4) {
    throw new TypeError('Usa URLs HTTP o HTTPS y un máximo de cuatro imágenes de galería.')
  }
  return postJson(PRODUCT_PATH, {
    ...getCommercialFields(product, inventory),
    nombre: product.nombre,
    categoria: CATEGORY_TO_API[product.categoria],
    descripcionCorta: product.descripcionCorta || null,
    descripcion: product.descripcionLarga || null,
    marca: product.marca || null,
    genero: product.categoria === 'juego' ? product.genero || null : null,
    ecosistema: product.ecosistema || null,
    compatibilidad: product.categoria === 'accesorio' ? product.compatibilidad || null : null,
    franquicia: product.categoria !== 'consola' ? product.franquicia || null : null,
    imagenUrl,
    imagenes: images,
  })
}

export async function uploadProductImage(file) {
  const form = new FormData()
  form.append('archivo', file)
  const data = await postForm(PRODUCT_PATH + '/imagenes/subir', form)
  if (!isExternalImageUrl(data?.imagenUrl)) throw new Error('La API no devolvió una URL de imagen válida.')
  return data.imagenUrl
}

export async function getProductById(id) {
  assertNumericId(id)
  try {
    return normalizeProduct(await getJson(PRODUCT_PATH + '/' + id))
  } catch (error) {
    if (error.status === 404) throw new ProductNotFoundError(id)
    throw error
  }
}
