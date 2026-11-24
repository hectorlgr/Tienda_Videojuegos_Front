import { STORE_ECOSYSTEMS } from './storeEcosystems'

const ecosystems = { name: 'ecosistema', label: 'Ecosistema', options: STORE_ECOSYSTEMS }
const franchise = { name: 'franquicia', label: 'Franquicia' }

const categoryFields = {
  juego: [
    { ...ecosystems, required: true },
    { name: 'formato', label: 'Formato', required: true, options: [
      { value: 'fisico', label: 'Físico' },
      { value: 'digital', label: 'Digital' },
    ] },
    { name: 'plataforma', label: 'Plataforma', required: true },
    franchise,
  ],
  consola: [{ ...ecosystems, required: true }],
  accesorio: [
    { name: 'compatibilidad', label: 'Compatibilidad', required: true },
    ecosystems,
    franchise,
  ],
  figura: [{ ...franchise, required: true }],
}

export const OFFER_PERCENTAGES = [5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90]

export function getCategoryFields(category, importing = false) {
  const fields = Object.hasOwn(categoryFields, category) ? categoryFields[category] : []
  return importing ? fields.filter(field => field.name === 'plataforma' || field.name === 'formato') : fields
}

export function calculateOfferPrice(price, percentage) {
  if (!Number.isSafeInteger(price) || price <= 0 || !OFFER_PERCENTAGES.includes(percentage)) return null
  return Math.round(price * (1 - percentage / 100))
}
