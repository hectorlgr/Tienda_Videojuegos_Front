import { SHIPPING_REGIONS } from '../config/shippingRegions.js'

export function initialCheckoutDelivery(user) {
  const region = SHIPPING_REGIONS.find(option => option.id === user?.region || option.nombre === user?.region)
  return {
    destinatario: [user?.nombre, user?.apellidos].filter(Boolean).join(' '),
    telefono: user?.telefono ?? '',
    direccion: user?.direccion ?? '',
    regionId: region?.id ?? '',
    comuna: region?.comunas.includes(user?.comuna) ? user.comuna : '',
  }
}

export function normalizeCheckoutDelivery(values) {
  return Object.fromEntries(Object.entries(values).map(([name, value]) => [name, value.trim()]))
}

export function validateCheckout(values) {
  const normalized = normalizeCheckoutDelivery(values)
  const errors = {}
  for (const [field, label, maxLength] of [
    ['destinatario', 'destinatario', 255],
    ['telefono', 'teléfono', 30],
    ['direccion', 'dirección', 255],
  ]) {
    if (!normalized[field]) errors[field] = 'Completa el campo ' + label + '.'
    else if (normalized[field].length > maxLength) errors[field] = 'Máximo ' + maxLength + ' caracteres permitidos.'
  }

  const region = SHIPPING_REGIONS.find(option => option.id === normalized.regionId)
  if (!region) errors.regionId = 'Selecciona una región válida.'
  if (!region?.comunas.includes(normalized.comuna)) errors.comuna = 'Selecciona una comuna de la región elegida.'
  return errors
}
