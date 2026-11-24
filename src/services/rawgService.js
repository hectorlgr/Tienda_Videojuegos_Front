import { publicAsset } from '../utils/assets'

// El adaptador devuelve la misma forma de datos que consumirá el buscador con HTTP.
const mockGames = [
  [1, 'Elden Ring', 'cara_elden_ring.jpg', ['PC', 'PlayStation 4', 'PlayStation 5', 'Xbox One', 'Xbox Series X/S'], 'Rol de acción', 'Elden Ring', 'Explora las Tierras Intermedias como un Sinluz, descubre mazmorras y enfréntate a los semidioses para reclamar el Círculo de Elden.'],
  [2, 'Super Mario Odyssey', 'cara_super_mario_odyssey.jpg', ['Nintendo Switch'], 'Plataformas', 'Super Mario', 'Viaja con Mario y Cappy por reinos llenos de secretos. Reúne lunas para impulsar la Odyssey y alcanzar a Bowser.'],
  [3, 'Super Mario Galaxy', 'cara_super_mario_galaxy.jpg', ['Wii', 'Nintendo Switch'], 'Plataformas', 'Super Mario', 'Salta entre pequeños planetas, juega con la gravedad y recupera las estrellas robadas por Bowser.'],
  [4, 'Halo Infinite', 'halo_infinite_1.jpg', ['PC', 'Xbox One', 'Xbox Series X/S'], 'Disparos', 'Halo', 'El Jefe Maestro explora el anillo Zeta Halo y se enfrenta a los Desterrados en una campaña de mundo abierto.'],
  [5, 'Minecraft', 'minecraft-portada.jpg', ['PC', 'Nintendo Switch', 'PlayStation 4', 'Xbox One'], 'Sandbox', 'Minecraft', 'Explora mundos de bloques, consigue materiales y construye tus propias creaciones en los modos Supervivencia y Creativo.'],
]

function normalizeSearch(value) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}

export function getRawgPlatformNames(game) {
  return game.platforms.map(({ platform }) => platform.name).join(', ')
}

export async function searchRawgGames(query) {
  const search = normalizeSearch(query)
  if (!search) return []

  return mockGames
    .filter(([, name]) => normalizeSearch(name).includes(search))
    .map(([id, name, image, platforms, genre, franchise, description_raw]) => ({
      id,
      name,
      description_raw,
      background_image: new URL(publicAsset(`img/${image}`), document.baseURI).href,
      platforms: platforms.map(name => ({ platform: { name } })),
      genres: [{ name: genre }],
      franchise,
    }))
}
