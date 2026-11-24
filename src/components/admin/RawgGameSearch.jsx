import { useRef, useState } from 'react'
import { getRawgPlatformNames, searchRawgGames } from '../../services/rawgService'
import ImageWithFallback from '../common/ImageWithFallback'

export default function RawgGameSearch({ onSelect }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [status, setStatus] = useState('')
  const request = useRef(0)

  async function search() {
    if (!query.trim()) return
    const id = ++request.current
    setResults([])
    setStatus('Buscando juegos…')
    try {
      const games = await searchRawgGames(query)
      if (id !== request.current) return
      setResults(games)
      setStatus(games.length ? '' : 'No se encontraron juegos. Puedes completar la ficha manualmente.')
    } catch {
      if (id === request.current) setStatus('La búsqueda falló. Puedes volver a intentarlo o completar la ficha manualmente.')
    }
  }

  return (
    <div className="mb-4 border rounded p-3">
      <label htmlFor="rawg-query" className="form-label fw-semibold">Buscar en catálogo RAWG</label>
      <div className="input-group">
        <input id="rawg-query" type="search" className="form-control" value={query}
          onChange={event => {
            request.current++
            setQuery(event.target.value)
            setResults([])
            setStatus('')
          }}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void search()
            }
          }} />
        <button type="button" className="btn btn-outline-secondary" disabled={!query.trim()} onClick={search}>Buscar</button>
      </div>
      <p className="form-text mb-0">Catálogo de prueba. También puedes completar la ficha manualmente.</p>
      <div role="status">{status}</div>
      {results.length > 0 && (
        <ul className="list-unstyled mt-3 mb-0">
          {results.map(game => (
            <li key={game.id} className="mb-2">
              <button type="button" className="btn btn-outline-secondary w-100 d-flex align-items-center gap-3 text-start"
                onClick={() => {
                  onSelect(game)
                  setResults([])
                  setStatus(`Se completó la ficha con ${game.name}. Puedes editar los datos importados.`)
                }}>
                <ImageWithFallback src={game.background_image} alt="" width={48} height={56} className="object-fit-cover rounded flex-shrink-0" />
                <span><strong>{game.name}</strong><br /><small>{getRawgPlatformNames(game)}</small></span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
