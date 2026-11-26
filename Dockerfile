FROM node:24.22.3-bookworm-slim@sha256:e0e989b967dacc279681ed81774b2ce9eeebbb0efb8e0c427573235bebf1eda1 AS build
WORKDIR /app
ARG VITE_API_BASE_URL
RUN node -e 'const value = process.env.VITE_API_BASE_URL || ""; if (!/^https?:\/\/[^/\s?#]/i.test(value) || /[\s\\]/.test(value) || !URL.canParse(value) || new URL(value).username || new URL(value).password) throw Error("VITE_API_BASE_URL requiere una URL HTTP(S) absoluta sin credenciales")'

COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.js ./
COPY public/ public/
COPY src/ src/
RUN npm run build

FROM nginx:1.30.8-alpine-slim@sha256:2ffee964b2052318d42de4243ea2a4eca5d2260049f872a95f115987e80cc81e
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/ /srv/checkpoint/
