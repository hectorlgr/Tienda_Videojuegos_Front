import { useRef, useState } from 'react'
import { searchRawgGames } from '../../services/rawgService'
import ImageWithFallback from '../common/ImageWithFallback'
import RawgAttribution from '../common/RawgAttribution'

export default function RawgGameSearch({ onSelect }) {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState(null)
  const [status, setStatus] = useState('')
  const request = useRef(0)

  async function search(page) {
    if (!query.trim()) return
    const id = ++request.current
    setResult(null)
    setStatus('Buscando juegos…')
    try {
      const data = await searchRawgGames(query, page)
      if (id !== request.current) return
      setResult(data)
      setStatus(data.resultados?.length ? '' : 'Sin resultados. Puedes crear el juego manualmente.')
    } catch (error) {
      if (id === request.current) setStatus(error.message)
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
            setResult(null)
            setStatus('')
          }}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void search(1)
            }
          }} />
        <button type="button" className="btn btn-outline-secondary" disabled={!query.trim()} onClick={() => search(1)}>Buscar</button>
      </div>
      <RawgAttribution />
      <div role="status">{status}</div>
      {result?.resultados?.length > 0 && (
        <ul className="list-unstyled mt-3 mb-0">
          {result.resultados.map(game => (
            <li key={game.rawgId} className="mb-2">
              <button type="button" className="btn btn-outline-secondary w-100 d-flex align-items-center gap-3 text-start"
                onClick={() => { onSelect(game); setResult(null) }}>
                <ImageWithFallback src={game.imagenUrl} alt="" width={48} height={56} className="object-fit-cover rounded flex-shrink-0" />
                <span>
                  <strong>{game.nombre}</strong><br />
                  <small>{game.plataformas?.join(', ')}</small>
                  {game.yaImportado && <span className="badge text-bg-info ms-2">Ya importado</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {result && (result.page > 1 || result.haySiguiente) && (
        <div className="d-flex gap-2 mt-2">
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={result.page <= 1} onClick={() => search(result.page - 1)}>Anterior</button>
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={!result.haySiguiente} onClick={() => search(result.page + 1)}>Siguiente</button>
        </div>
      )}
    </div>
  )
}
