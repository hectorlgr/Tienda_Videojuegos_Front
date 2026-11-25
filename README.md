# CheckPoint Store

CheckPoint Store es una tienda académica de videojuegos y productos relacionados. Desde el navegador se puede explorar el catálogo, preparar un carrito y registrar pedidos. El personal de la tienda dispone de un panel con funciones según su rol.

## Instalación y primer arranque

1. Instala Node.js con npm. Una versión compatible con las herramientas de desarrollo y pruebas es **Node.js 24.15.0 o posterior de la serie 24**.
2. Para usar el catálogo, la autenticación y los pedidos, inicia el entorno descrito en el [repositorio del backend](https://github.com/hectorlgr/Tienda_Videojuegos_Back#readme). Espera a que el Gateway esté disponible en `http://localhost:9090`.
3. Abre PowerShell en la raíz del clon del frontend, donde se encuentran `package.json` y `package-lock.json`. Instala las versiones fijadas y crea la configuración local.

   ```powershell
   npm ci
   Copy-Item .env.example .env
   ```

   En Linux o macOS, usa `cp .env.example .env` para la copia. El archivo de ejemplo ya apunta al Gateway local.

   ```dotenv
   VITE_API_BASE_URL=http://localhost:9090
   ```

   Si el Gateway se ejecuta en otra dirección, cambia el valor en `.env` y reinicia Vite. Esta variable es pública y solo debe contener el origen del Gateway.

4. Inicia el servidor de desarrollo.

   ```sh
   npm run dev
   ```

   Abre [la tienda local](http://localhost:5173) y entra en **Productos** para consultar el catálogo. Si Vite anuncia otro puerto, libera el 5173 y vuelve a ejecutar el comando. El Gateway permite el origen local de desarrollo en ese puerto.

## Integración con el backend

El navegador envía las solicitudes HTTP al Gateway mediante los módulos de `src/services/` y el cliente común `src/services/httpClient.js`, basado en `fetch`. El Gateway aplica las reglas de acceso y dirige cada solicitud al servicio correspondiente.

| Servicio | Operaciones del frontend |
| --- | --- |
| Identidad | Registro de clientes, inicio de sesión, perfil y consulta administrativa de usuarios. |
| Catálogo | Consulta de productos y existencias, alta de productos y movimientos de stock. |
| Ventas | Registro del pedido, historial del comprador y consulta de órdenes del personal. |

Las operaciones protegidas utilizan la sesión emitida por el backend. El navegador conserva la sesión en `sessionStorage`. El acceso a MySQL corresponde a los servicios del backend.

## Funcionalidades y roles

| Acceso | Funciones |
| --- | --- |
| Visitante | Explorar productos, categorías y ofertas, consultar fichas, preparar un carrito y registrarse como cliente. |
| Cliente | Ajustar el carrito, confirmar un pedido en `/checkout`, editar su perfil y consultar sus pedidos en `/perfil`. |
| Vendedor | Consultar las órdenes de la tienda en `/admin/ordenes`. |
| Administrador | Consultar órdenes, indicadores, reportes y usuarios, listar y crear productos y ajustar existencias desde `/admin`. |

### Persistencia del carrito

El frontend guarda las líneas del carrito (identificador del producto y cantidad) en `localStorage`, bajo la clave `checkpoint.carritos.v2`. Mantiene un carrito de invitado y uno por cada cuenta de cliente. Al iniciar sesión como cliente, combina el carrito de invitado con el de esa cuenta y comprueba las cantidades contra el inventario disponible. Al cerrar sesión, el carrito personal queda guardado para la próxima visita con esa cuenta.

La persistencia se limita al mismo navegador, perfil y origen de la tienda. Otro dispositivo tiene su propio carrito. Borrar los datos del sitio elimina los carritos almacenados allí.

## Limitaciones del MVP

- Confirmar la compra registra un pedido. El cobro y el despacho efectivo quedan fuera del flujo.
- El formulario de contacto solo valida los campos en el navegador. El envío y almacenamiento de mensajes quedan pendientes.
- La sección de críticas presenta contenido editorial estático.

## Tecnologías y verificación

El frontend está escrito en JavaScript y JSX. Las versiones indicadas son las resueltas en `package-lock.json`, que reproduce `npm ci`.

| Área | Tecnologías |
| --- | --- |
| Interfaz y navegación | React y React DOM 19.3.0, React Router DOM 7.18.4 |
| Estilos y animaciones | Bootstrap 5.3.8, GSAP 3.15.1 |
| Edición y saneamiento de contenido | Tiptap 3.35.0, DOMPurify 3.5.0 |
| Desarrollo y compilación | Vite 8.3.3, complemento React para Vite 6.1.2 |
| Pruebas y análisis | Vitest 5.0.5, Testing Library para React 16.3.3, jsdom 30.1.3, ESLint 10.15.0 |

Ejecuta estos comandos desde la raíz del frontend.

| Comando | Resultado |
| --- | --- |
| `npm test` | Ejecuta las pruebas una vez. |
| `npm run test:watch` | Repite las pruebas al detectar cambios. |
| `npm run lint` | Analiza el código con ESLint. |
| `npm run build` | Genera la compilación de producción en `dist/`. |
| `npm run preview` | Sirve localmente la compilación existente para inspeccionarla. Requiere ejecutar antes `npm run build`. |
