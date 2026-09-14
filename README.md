# Kings Durango / Tabira

Liga de fútbol local con dashboard, calendario, clasificaciones, goleadores, sanciones y panel de administración.

## Configuración rápida

1. Instala dependencias:
   npm install
2. Ejecuta la app en desarrollo:
   npm run dev
3. Crea un archivo `.env.local` con la configuración de Supabase basada en `.env.example`.

## API local disponible

- GET /api/health
- GET /api/teams
- POST /api/teams
- GET /api/players?team=NombreDelEquipo
- POST /api/players
- GET /api/sanctions
- POST /api/sanctions

## Base de datos

La estructura SQL para PostgreSQL está en `database/schema.sql` y la semilla en `database/seed.sql`.

## Despliegue

Se recomienda desplegar la app en Vercel y la base de datos en Supabase/PostgreSQL con un dominio propio.

## Preparación para producción

1. Copia `.env.example` a `.env.local` o al entorno de producción de tu hosting.
2. Define al menos estas variables:
   - `NEXT_PUBLIC_ADMIN_EMAIL`
   - `NEXT_PUBLIC_ADMIN_PASSWORD`
   - `ADMIN_ACCESS_TOKEN`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. En producción no uses los valores de ejemplo; cambia la contraseña y email por los reales.
4. Haz `npm install` y `npm run build` antes de desplegar.
5. Sube el proyecto a Vercel y conecta el repositorio.

## Proceso recomendado

- Frontend + API: Vercel
- Base de datos: Supabase/PostgreSQL
- Datos de la liga: migrar desde JSON a tablas reales
- Autenticación admin: variables de entorno + base de usuarios de producción

Consulta [DEPLOY.md](DEPLOY.md) para la guía completa de despliegue.

Deployment status: ready
