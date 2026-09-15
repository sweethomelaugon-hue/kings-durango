# Kings Durango / Tabira

Liga de fútbol local con dashboard, calendario, clasificaciones, goleadores, sanciones y panel de administración.

## Configuración rápida

1. Instala dependencias:
   npm install
2. Ejecuta la app en desarrollo:
   npm run dev
3. Copia `.env.example` a `.env.local` y sustituye todos los placeholders por los valores de tu proyecto.

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
Para instalaciones existentes, ejecuta también `database/migrate-financial-movement-details.sql` en Supabase para conservar todos los campos del panel de Economía.

## Despliegue

Se recomienda desplegar la app en Vercel y la base de datos en Supabase/PostgreSQL con un dominio propio.

## Preparación para producción

1. Copia `.env.example` a `.env.local` o configura estas variables en tu hosting:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` o `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` para crear o modificar datos desde la API
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD` y `ADMIN_ACCESS_TOKEN`
2. En producción no uses los valores de ejemplo; cambia la contraseña, email y tokens por los reales.
3. No expongas `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD` ni `ADMIN_ACCESS_TOKEN` al navegador ni los subas al repositorio.
4. Haz `npm install` y `npm run build` antes de desplegar.
5. Sube el proyecto a Vercel y conecta el repositorio.

## Proceso recomendado

- Frontend + API: Vercel
- Base de datos: Supabase/PostgreSQL
- Datos de la liga: migrar desde JSON a tablas reales
- Autenticación admin: variables de entorno + base de usuarios de producción

Consulta [DEPLOY.md](DEPLOY.md) para la guía completa de despliegue.

Deployment status: ready
