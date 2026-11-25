import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearSession, persistSession } from '../../utils/authSession'
import { getAdminProducts, getProducts } from '../../services/productService'
import AdminProductCreatePage from './AdminProductCreatePage'
import AuthProvider from '../../context/AuthProvider'
import LoginPage from '../LoginPage'

const fetchMock = vi.fn()
const coverUrl = 'http://localhost:9090/api/productos/imagenes/cover.png'
const response = (data, status = 200) => new Response(data === null ? null : JSON.stringify(data), { status })

function change(label, value) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

function renderForm(category) {
  const view = render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<AdminProductCreatePage />} />
        <Route path="/admin/stock" element={<h1>Inventario de prueba</h1>} />
      </Routes>
    </MemoryRouter>,
  )
  change('Categor\u00eda', category)
  change(/C.digo comercial/, 'demo-01')
  change('Precio (CLP)', '19990')
  change('Stock inicial', '3')
  return view
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  persistSession('test-token')
})

afterEach(() => {
  cleanup()
  clearSession()
  vi.unstubAllGlobals()
})

describe('Integracion de catalogo', () => {
  it('sube archivos y guarda una figura con un solo POST plano', async () => {
    fetchMock.mockResolvedValueOnce(response({ imagenUrl: coverUrl }, 201))
    fetchMock.mockResolvedValueOnce(response({}, 201))
    const { container } = renderForm('figura')
    change('Nombre', 'Figura de Mario')
    change('Franquicia', 'Super Mario')
    change(/Descripci.n larga/, 'Descripcion de prueba')
    const file = new File(['test'], 'cover.png', { type: 'image/png' })
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } })
    expect(await screen.findByAltText('Imagen principal')).toHaveAttribute('src', coverUrl)
    fireEvent.click(screen.getByLabelText('Producto en oferta'))
    change('Descuento', '20')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y agregar otro' }))
    expect(await screen.findByText(/Se cre. Figura de Mario/)).toBeInTheDocument()

    const [[uploadUrl, upload], [productUrl, save]] = fetchMock.mock.calls
    expect(uploadUrl.pathname).toBe('/api/productos/imagenes/subir')
    expect(upload.headers).toEqual({ Accept: 'application/json', Authorization: 'Bearer test-token' })
    expect(upload.body.get('archivo').name).toBe('cover.png')
    expect(productUrl.pathname).toBe('/api/productos')
    expect(JSON.parse(save.body)).toEqual({
      codigo: 'DEMO-01', nombre: 'Figura de Mario', categoria: 'FIGURA', descripcionCorta: null,
      descripcion: 'Descripcion de prueba', marca: null, plataforma: null, genero: null, formato: null,
      ecosistema: null, compatibilidad: null, franquicia: 'Super Mario', precio: 19990, precioOferta: 15992,
      enOferta: true, stock: 3, stockCritico: null, habilitado: true, imagenUrl: coverUrl, imagenes: [],
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(screen.getByLabelText(/Categor.a/)).toHaveValue('figura')
    expect(screen.getByLabelText('Nombre')).toHaveValue('')
  })

  it('importa con nueve campos y conserva datos ante un 409', async () => {
    fetchMock.mockResolvedValueOnce(response({
      resultados: [{ rawgId: 101, nombre: 'Elden Ring', plataformas: ['PC', 'PlayStation 5'], yaImportado: true }],
      page: 1, haySiguiente: false,
    }))
    fetchMock.mockResolvedValueOnce(response({ descripcion: '<b>Texto</b>', generos: ['Rol'] }))
    fetchMock.mockResolvedValueOnce(response({ message: 'Variante duplicada' }, 409))
    fetchMock.mockResolvedValueOnce(response({}, 201))
    renderForm('juego')
    change('Buscar en catálogo RAWG', 'Elden Ring')
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    fireEvent.click(await screen.findByRole('button', { name: /Elden Ring.*Ya importado/ }))
    expect(await screen.findByText('<b>Texto</b>')).toBeInTheDocument()
    change('Plataforma', 'PC')
    change('Formato', 'digital')
    fireEvent.click(screen.getByRole('button', { name: 'Crear producto' }))
    expect(await screen.findByText('Variante duplicada')).toBeInTheDocument()
    expect(screen.getByLabelText(/C.digo comercial/)).toHaveValue('DEMO-01')
    expect(screen.getByLabelText('Plataforma')).toHaveValue('PC')
    const [[searchUrl, search], [detailUrl], [importUrl, save]] = fetchMock.mock.calls
    expect(searchUrl.searchParams.get('query')).toBe('Elden Ring')
    expect(searchUrl.searchParams.get('page')).toBe('1')
    expect(search.headers.Authorization).toBe('Bearer test-token')
    expect(detailUrl.pathname).toBe('/api/productos/rawg/101')
    expect(importUrl.pathname).toBe('/api/productos/rawg/101/importar')
    expect(JSON.parse(save.body)).toEqual({
      codigo: 'DEMO-01', plataforma: 'PC', formato: 'DIGITAL', precio: 19990, precioOferta: null,
      enOferta: false, stock: 3, stockCritico: null, habilitado: true,
    })
    fireEvent.click(screen.getByRole('button', { name: 'Crear producto' }))
    expect(await screen.findByRole('heading', { name: 'Inventario de prueba' })).toBeInTheDocument()
  })

  it('lee HAL y limita el token a las rutas protegidas', async () => {
    fetchMock.mockResolvedValueOnce(response({ _embedded: { productos: [{ id: 1, categoria: 'CONSOLA', imagenUrl: coverUrl }] } }))
    fetchMock.mockResolvedValueOnce(response(null, 403))
    expect(await getProducts()).toMatchObject([{ id: 1, categoria: 'consola', imagen: coverUrl }])
    await expect(getAdminProducts()).rejects.toMatchObject({ status: 403 })
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined()
    expect(fetchMock.mock.calls[1][0].pathname).toBe('/api/admin/productos')
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer test-token')
  })

  it('usa data.token en el login y lo adjunta a la siguiente llamada administrativa', async () => {
    clearSession()
    const claims = btoa(JSON.stringify({ userId: 1, sub: 'admin@example.com', role: 'ADMINISTRADOR', exp: Date.now() / 1000 + 3600 }))
    const token = `header.${claims}.signature`
    persistSession('token-vencido')
    fetchMock.mockResolvedValueOnce(response({ token }))
    fetchMock.mockResolvedValueOnce(response({ id: 1, nombre: 'Administradora', email: 'admin@example.com' }))
    fetchMock.mockResolvedValueOnce(response({}))
    render(
      <MemoryRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<LoginPage />} />
            <Route path="/admin" element={<h1>Panel de prueba</h1>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    )
    change(/Correo electr.nico/, 'admin@example.com')
    change(/Contrase.a/, 'demo')
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(await screen.findByRole('heading', { name: 'Panel de prueba' })).toBeInTheDocument()
    await expect(getAdminProducts()).resolves.toEqual([])
    const [[loginUrl, login], [profileUrl, profile], [, admin]] = fetchMock.mock.calls
    expect(loginUrl.pathname).toBe('/auth/login')
    expect(login.headers.Authorization).toBeUndefined()
    expect(JSON.parse(login.body)).toEqual({ email: 'admin@example.com', password: 'demo' })
    expect(profileUrl.pathname).toBe('/api/v1/usuarios/me')
    expect(profile.headers.Authorization).toBe(`Bearer ${token}`)
    expect(admin.headers.Authorization).toBe(`Bearer ${token}`)
  })
})
