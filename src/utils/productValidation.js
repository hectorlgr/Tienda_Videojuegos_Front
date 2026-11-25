import { CATALOG_CATEGORIES } from '../config/catalogCategories'
import { calculateOfferPrice, getCategoryFields, OFFER_PERCENTAGES } from '../config/productForm'
import { getDescriptionText, LONG_DESCRIPTION_LIMIT, SHORT_DESCRIPTION_HTML_LIMIT, SHORT_DESCRIPTION_LIMIT } from './productDescription'

export function normalizeProductCode(code) {
  return code.trim().toUpperCase()
}

function validInteger(value, minimum) {
  const number = Number(value)
  return value.trim() !== '' && Number.isSafeInteger(number) && number >= minimum
}

export function validateProductForm({ product, inventory }, rawgGame = null) {
  const errors = {}
  const code = normalizeProductCode(product.codigo)
  if (!code) errors.codigo = 'El código es obligatorio.'
  else if (code.length < 3) errors.codigo = 'El código debe tener al menos 3 caracteres.'

  if (!rawgGame && !product.nombre.trim()) errors.nombre = 'El nombre es obligatorio.'
  else if (!rawgGame && product.nombre.trim().length > 100) errors.nombre = 'Máximo 100 caracteres.'

  if (!CATALOG_CATEGORIES.some(category => category.value === product.categoria)) {
    errors.categoria = 'Selecciona una categoría válida.'
  }
  for (const field of getCategoryFields(product.categoria, rawgGame !== null)) {
    const value = product[field.name]?.trim() ?? ''
    if (!value && field.required) {
      errors[field.name] = field.options ? 'Selecciona una opción.' : 'Completa este campo.'
    } else if (value && field.options && !field.options.some(option => option.value === value)) {
      errors[field.name] = 'Selecciona una opción válida.'
    }
  }
  if (rawgGame?.plataformas?.length && product.plataforma && !rawgGame.plataformas.includes(product.plataforma.trim())) {
    errors.plataforma = 'Selecciona una plataforma de este juego.'
  }
  if (!validInteger(product.precio, 1)) {
    errors.precio = 'Ingresa un precio entero seguro mayor que 0.'
  }
  if (product.enOferta) {
    const percentage = Number(product.porcentajeOferta)
    const price = Number(product.precio)
    const offerPrice = calculateOfferPrice(price, percentage)
    if (!OFFER_PERCENTAGES.includes(percentage)) {
      errors.porcentajeOferta = 'Selecciona un porcentaje de descuento.'
    } else if (offerPrice !== null && (offerPrice <= 0 || offerPrice >= price)) {
      errors.porcentajeOferta = 'El precio final redondeado debe ser mayor que $0 y menor que el precio normal.'
    }
  }
  if (!rawgGame) {
    if (getDescriptionText(product.descripcionCorta).length > SHORT_DESCRIPTION_LIMIT) {
      errors.descripcionCorta = `Máximo ${SHORT_DESCRIPTION_LIMIT} caracteres visibles.`
    } else if (product.descripcionCorta.length > SHORT_DESCRIPTION_HTML_LIMIT) {
      errors.descripcionCorta = 'Simplifica el formato de la descripción corta para poder guardarla.'
    }
    if (getDescriptionText(product.descripcionLarga).length > LONG_DESCRIPTION_LIMIT) {
      errors.descripcionLarga = `Máximo ${LONG_DESCRIPTION_LIMIT} caracteres visibles.`
    }
  }
  if (!validInteger(inventory.stock, 0)) {
    errors.stock = 'Ingresa un stock entero seguro mayor o igual a 0.'
  }
  if (inventory.stockCritico.trim() !== '' && !validInteger(inventory.stockCritico, 0)) {
    errors.stockCritico = 'Ingresa un stock crítico entero seguro mayor o igual a 0, o déjalo vacío.'
  }
  return errors
}
