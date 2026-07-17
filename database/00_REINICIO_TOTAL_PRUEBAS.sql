-- ============================================================
-- ADVERTENCIA: REINICIO TOTAL DE LA BASE DE PRUEBAS
-- ============================================================
-- Este archivo elimina los datos y tablas publicas del sistema
-- de accesos, tanto del esquema antiguo como del esquema V2.
--
-- NO elimina usuarios de Supabase Auth.
-- NO elimina el bucket SCTR ni sus archivos.
-- NO modifica NetBox.
--
-- Ejecutar solamente cuando los datos actuales sean de prueba.
-- Despues ejecutar, en orden, las etapas 01 a 09.
-- ============================================================

BEGIN;

-- Tablas operativas y dependientes.
DROP TABLE IF EXISTS public.acceso_documentos CASCADE;
DROP TABLE IF EXISTS public.movimiento_detalle CASCADE;
DROP TABLE IF EXISTS public.reemplazos CASCADE;
DROP TABLE IF EXISTS public.equipos CASCADE;
DROP TABLE IF EXISTS public.rack_ru CASCADE;
DROP TABLE IF EXISTS public.racks CASCADE;
DROP TABLE IF EXISTS public.prestamos_llave CASCADE;
DROP TABLE IF EXISTS public.llaves_nodo CASCADE;
DROP TABLE IF EXISTS public.movimientos CASCADE;
DROP TABLE IF EXISTS public.personal_acceso CASCADE;
DROP TABLE IF EXISTS public.accesos CASCADE;

-- Configuracion y catalogos.
DROP TABLE IF EXISTS public.administradores CASCADE;
DROP TABLE IF EXISTS public.tipos_equipo CASCADE;
DROP TABLE IF EXISTS public.areas CASCADE;
DROP TABLE IF EXISTS public.empresas CASCADE;
DROP TABLE IF EXISTS public.nodos CASCADE;
DROP TABLE IF EXISTS public.tipos_trabajo CASCADE;
DROP TABLE IF EXISTS public.niveles_acceso CASCADE;
DROP TABLE IF EXISTS public.tipos_documento CASCADE;

-- Funciones antiguas que no siempre dependen formalmente de
-- las tablas y pueden sobrevivir a DROP TABLE ... CASCADE.
DROP FUNCTION IF EXISTS public.validar_acceso_instalaciones(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.procesar_movimiento(JSONB) CASCADE;
DROP FUNCTION IF EXISTS public.validar_ru_libre() CASCADE;
DROP FUNCTION IF EXISTS public.validar_ru_estado() CASCADE;
DROP FUNCTION IF EXISTS public.ocupar_ru() CASCADE;
DROP FUNCTION IF EXISTS public.ocupar_ru_multiple() CASCADE;
DROP FUNCTION IF EXISTS public.ocupar_ru_bloque() CASCADE;
DROP FUNCTION IF EXISTS public.liberar_ru_retiro() CASCADE;
DROP FUNCTION IF EXISTS public.liberar_ru_multiple() CASCADE;
DROP FUNCTION IF EXISTS public.liberar_ru_bloque() CASCADE;
DROP FUNCTION IF EXISTS public.procesar_reemplazo() CASCADE;
DROP FUNCTION IF EXISTS public.crear_ru_automatico() CASCADE;
DROP FUNCTION IF EXISTS public.validar_numero_personal() CASCADE;
DROP FUNCTION IF EXISTS public.procesar_prestamo_llave() CASCADE;

COMMIT;

-- Comprobacion: esta consulta debe devolver cero filas.
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'tipos_documento',
    'niveles_acceso',
    'tipos_trabajo',
    'empresas',
    'areas',
    'nodos',
    'administradores',
    'accesos',
    'personal_acceso',
    'acceso_documentos',
    'movimientos',
    'movimiento_detalle',
    'llaves_nodo',
    'prestamos_llave',
    'tipos_equipo',
    'racks',
    'rack_ru',
    'equipos',
    'reemplazos'
  )
ORDER BY table_name;
