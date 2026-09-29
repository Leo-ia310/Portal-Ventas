# Portal interno de empleados | MK Dev Studio

Primera versión funcional del portal interno de MK Dev Studio para agentes de ventas y panel admin de Maikel. Usa HTML, CSS y JavaScript vanilla con Supabase Auth, Database y Row Level Security.

## Módulos incluidos

- Login con Supabase Auth.
- Roles `admin` y `agente`.
- Dashboard del agente con métricas, perfil y accesos rápidos.
- Leads / CRM con creación, edición, filtros, búsqueda y actividades.
- Proceso de ventas y reglas comerciales.
- Servicios y precios referenciales con advertencia interna para admin.
- Capacitación con módulos y progreso.
- Guiones visibles para agentes y gestionables por admin.
- Comisiones basadas en ventas cerradas y pagadas.
- Reportes diarios/semanales.
- Panel admin de Maikel con agentes, métricas, embudo, alertas y reportes.
- Documentos comerciales.
- SQL completo con tablas, relaciones, índices, triggers y RLS.
- Migración incremental para flujo de pagos, comisiones automáticas y bonos.

## Estructura

```text
/index.html
/login.html
/dashboard.html
/assets/css/styles.css
/assets/js/config.example.js
/assets/js/supabase.js
/assets/js/auth.js
/assets/js/router.js
/assets/js/dashboard.js
/assets/js/leads.js
/assets/js/admin.js
/assets/js/commissions.js
/assets/js/training.js
/assets/js/scripts.js
/assets/js/reports.js
/assets/js/documents.js
/assets/js/utils.js
/supabase/schema.sql
/supabase/seed.sql
/supabase/2026-09-29_payment_commissions_bonuses_migration.sql
/README.md
```

## Configurar Supabase

1. Crea un proyecto en [Supabase](https://supabase.com/).
2. En el SQL Editor, ejecuta `supabase/schema.sql`.
3. Después ejecuta `supabase/seed.sql`.
4. En Authentication, crea los usuarios iniciales:
   - Un usuario admin para Maikel.
   - Uno o más usuarios agente para pruebas.
5. Copia el `id` de cada usuario creado en Auth.
6. Inserta sus perfiles en SQL Editor:

```sql
insert into public.profiles (id, full_name, email, role)
values
  ('UUID_DEL_USUARIO_ADMIN', 'Maikel', 'maikel@mkdev.studio', 'admin'),
  ('UUID_DEL_USUARIO_AGENTE', 'Sergio', 'sergio@mkdev.studio', 'agente');
```

7. Crea el registro del agente:

```sql
insert into public.agents (
  user_id,
  country,
  phone,
  whatsapp,
  availability,
  status,
  compensation_mode,
  commission_rate,
  start_date
)
values (
  'UUID_DEL_USUARIO_AGENTE',
  'Nicaragua',
  '+505 0000 0000',
  '+505 0000 0000',
  'Medio tiempo',
  'capacitación',
  'comisión',
  0.30,
  current_date
);
```

## Actualizar una base ya creada

Si ya habías ejecutado el SQL inicial antes de los cambios de pagos/comisiones, ejecuta este archivo en Supabase SQL Editor:

```text
supabase/2026-09-29_payment_commissions_bonuses_migration.sql
```

Ese script agrega:

- Fecha de reunión del lead.
- Sub tag de pago: `pendiente`, `pagado`, `parcial`, `reembolsado`.
- Monto acordado en reunión.
- Monto final pagado.
- Nota de cambio de monto.
- Comisión automática por lead pagado.
- Confirmación de comisión pagada por admin.
- Protección para que solo admin modifique pago, montos y confirmación.

## Configurar el frontend

1. Copia el archivo de ejemplo:

```bash
cp assets/js/config.example.js assets/js/config.js
```

En PowerShell:

```powershell
Copy-Item assets/js/config.example.js assets/js/config.js
```

2. Edita `assets/js/config.js` con valores públicos de Supabase:

```js
export const SUPABASE_CONFIG = {
  url: "https://TU-PROYECTO.supabase.co",
  anonKey: "TU_SUPABASE_ANON_KEY_PUBLICA",
};
```

No coloques service role keys ni secretos en el frontend.

## Correr localmente

Puedes servirlo con cualquier servidor estático. Por ejemplo:

```powershell
python -m http.server 5173
```

Luego abre:

```text
http://localhost:5173/login.html
```

## Cómo probar

1. Entra con el usuario admin.
2. Confirma que aparece el panel admin de Maikel.
3. Crea o revisa agentes.
4. Entra con un usuario agente.
5. Crea leads desde Leads / CRM.
6. Filtra por estado, canal, fecha o búsqueda.
7. Registra actividades del lead.
8. Revisa dashboard, precios, proceso de ventas y capacitación.
9. Marca progreso de capacitación.
10. Copia guiones.
11. Registra reportes.
12. Desde admin, revisa embudo, reportes, documentos, guiones y comisiones.

## Reglas importantes implementadas

- El agente solo ve información permitida por RLS: sus leads, reportes, comisiones, capacitación activa, documentos visibles y guiones activos.
- El admin puede leer y escribir la operación completa.
- Un lead no puede tener estado `Ganado` si `payment_confirmed` es falso.
- Las comisiones se generan automáticamente cuando admin marca un lead como `pagado` y registra el monto final.
- Admin confirma cuándo una comisión ya fue pagada al agente.
- Los bonos se calculan por tramos de ventas pagadas: $1,500 en ventas o 4 ventas fuertes.
- Los precios se muestran como referenciales y con texto “desde”.
- La advertencia interna de precios solo se muestra en la vista admin.

## Limitaciones actuales

- La subida de archivos no está implementada; el módulo de documentos guarda enlaces.
- No hay invitación automática de usuarios; los usuarios se crean desde Supabase Auth.
- El portal no usa framework ni build step, por diseño.
- La edición granular de guiones/documentos está simplificada a crear, activar y desactivar. Puede ampliarse con formularios de edición dedicados.
- Las métricas son operativas para la primera versión; pueden evolucionar a reportes históricos y gráficos.

## Próximos pasos sugeridos

- Añadir storage de Supabase para documentos.
- Crear formularios de edición dedicados para documentos, guiones y comisiones.
- Agregar exportación CSV para leads y reportes.
- Añadir notificaciones de seguimientos vencidos.
- Crear vistas SQL o RPC para métricas avanzadas del embudo.
- Separar notas internas sensibles en una tabla admin-only si se requiere ocultamiento estricto a nivel columna.
