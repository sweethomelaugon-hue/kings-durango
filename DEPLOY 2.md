# Guía de despliegue para Kings Durango

## 1. Requisitos

- Node.js 20+
- npm
- Repositorio en GitHub
- Cuenta en Vercel
- Opción recomendada: Supabase/PostgreSQL para datos reales

## 2. Variables de entorno

Crea un archivo `.env.production` o usa el panel de variables del hosting. Configura al menos:

```bash
NEXT_PUBLIC_ADMIN_EMAIL=tu-admin@dominio.com
NEXT_PUBLIC_ADMIN_PASSWORD=TuPasswordSegura2026!
ADMIN_ACCESS_TOKEN=token-super-secreto
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxx
LEAGUE_STORE_PATH=/tmp/league-store.json
```

Importante:
- Nunca dejes la contraseña por defecto en producción.
- Usa una contraseña fuerte y exclusiva.
- `ADMIN_ACCESS_TOKEN` sirve para proteger APIs administrativas.

## 3. Recomendación de despliegue

### Vercel

1. Conecta el repositorio a Vercel.
2. Selecciona el proyecto.
3. Añade las variables de entorno en Settings > Environment Variables.
4. Haz deploy.

### VPS / servidor Linux

1. Instala Node.js 20.
2. Clona el repositorio.
3. Ejecuta:

```bash
npm install
npm run build
npm run start
```

4. Usa un gestor de proceso como PM2 o systemd.
5. Configura Nginx/Apache si quieres HTTPS y dominio propio.

## 4. Base de datos y persistencia

Este proyecto está todavía pensado como demo, aunque ya incluye estructura SQL:

- `database/schema.sql`
- `database/seed.sql`

Para producción, migra de almacenamiento JSON a Supabase/PostgreSQL.

## 5. Criterio importante

El proyecto no está aún 100% preparado para producción con usuarios reales, porque:
- la auth del admin sigue siendo básica,
- los datos se gestionan todavía en JSON local,
- la persistencia debe migrarse a base de datos real.

## 6. Siguiente paso recomendado

1. Crear base en Supabase.
2. Mover `teams`, `players`, `matches`, `sanciones`, `finanzas` a tablas reales.
3. Sustituir credenciales de demo por usuarios reales.
4. Hacer deploy final en Vercel.

## 7. Comando de validación local

```bash
npm install
npm run build
```

Si la build pasa, el proyecto está listo para prepararse para producción.
