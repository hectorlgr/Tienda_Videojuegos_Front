import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { AuthContext } from '../../context/AuthContext'
import LocalEditorialPosts from './LocalEditorialPosts'

afterEach(() => {
  cleanup()
  localStorage.removeItem('checkpoint-editorial-posts')
})

it('guarda una publicación enriquecida y la muestra al volver sin sesión', () => {
  const { unmount } = render(
    <AuthContext.Provider value={{ user: { rol: 'administrador' } }}>
      <LocalEditorialPosts />
    </AuthContext.Provider>,
  )
  fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Una reseña' } })
  fireEvent.paste(screen.getByRole('textbox', { name: 'Cuerpo de la publicación' }), {
    clipboardData: {
      getData: type => type === 'text/html'
        ? '<h4>Jugabilidad</h4><p><strong>Muy buena</strong>. <a href="https://example.org/">Fuente</a></p>'
        : '',
    },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar publicación' }))
  expect(screen.getByRole('status')).toHaveTextContent('Publicación guardada')
  unmount()

  render(
    <AuthContext.Provider value={{ user: null }}>
      <LocalEditorialPosts />
    </AuthContext.Provider>,
  )
  expect(screen.getByRole('heading', { name: 'Una reseña' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Jugabilidad', level: 4 })).toBeInTheDocument()
  expect(screen.getByText('Muy buena').tagName).toBe('STRONG')
  expect(screen.getByRole('link', { name: 'Fuente' })).toHaveAttribute('href', 'https://example.org/')
  expect(screen.queryByRole('button', { name: 'Guardar publicación' })).not.toBeInTheDocument()
})
