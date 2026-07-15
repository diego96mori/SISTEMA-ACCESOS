-- ============================================================
-- PROYECTO ACCESOS V2 - ETAPA 4
-- Storage SCTR privado y consulta publica de seguimiento.
--
-- Requiere haber ejecutado las etapas 01, 02 y 03.
-- No elimina tablas ni datos.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. BUCKET PRIVADO SCTR
-- Maximo 10 MiB por archivo y solo PDF.
-- Los objetos seran cargados por una Edge Function con service
-- role. El visitante no recibe acceso directo de escritura.
-- ============================================================

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'sctr',
  'sctr',
  FALSE,
  10485760,
  ARRAY['application/pdf']::TEXT[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Solo los administradores pueden operar directamente sobre
-- los documentos. Las Edge Functions usan service_role.
DROP POLICY IF EXISTS sctr_admin_select ON storage.objects;
CREATE POLICY sctr_admin_select
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'sctr'
  AND public.es_admin()
);

DROP POLICY IF EXISTS sctr_admin_insert ON storage.objects;
CREATE POLICY sctr_admin_insert
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'sctr'
  AND public.es_admin()
);

DROP POLICY IF EXISTS sctr_admin_update ON storage.objects;
CREATE POLICY sctr_admin_update
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'sctr'
  AND public.es_admin()
)
WITH CHECK (
  bucket_id = 'sctr'
  AND public.es_admin()
);

DROP POLICY IF EXISTS sctr_admin_delete ON storage.objects;
CREATE POLICY sctr_admin_delete
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'sctr'
  AND public.es_admin()
);

-- ============================================================
-- 2. CONSULTA PUBLICA DE SEGUIMIENTO
-- Devuelve solo informacion operacional. No expone nombres,
-- documentos, telefonos, correos ni rutas SCTR.
-- ============================================================

CREATE OR REPLACE FUNCTION public.consultar_seguimiento(
  p_codigo UUID
)
RETURNS TABLE (
  codigo_seguimiento UUID,
  nodo TEXT,
  tipo_trabajo TEXT,
  estado_aprobacion TEXT,
  estado_acceso TEXT,
  requiere_equipos BOOLEAN,
  requiere_llave BOOLEAN,
  estado_movimiento TEXT,
  estado_prestamo_llave TEXT,
  fecha_solicitud TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.codigo_seguimiento,
    n.nombre AS nodo,
    tt.nombre AS tipo_trabajo,
    a.estado_aprobacion,
    a.estado_acceso,
    tt.gestiona_equipos AS requiere_equipos,
    n.requiere_llave,
    m.estado AS estado_movimiento,
    pl.estado AS estado_prestamo_llave,
    a.created_at AS fecha_solicitud
  FROM public.accesos a
  JOIN public.nodos n
    ON n.id = a.nodo_id
  JOIN public.tipos_trabajo tt
    ON tt.id = a.tipo_trabajo_id
  LEFT JOIN public.movimientos m
    ON m.acceso_id = a.id
  LEFT JOIN public.prestamos_llave pl
    ON pl.acceso_id = a.id
  WHERE a.codigo_seguimiento = p_codigo;
$$;

REVOKE ALL ON FUNCTION public.consultar_seguimiento(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consultar_seguimiento(UUID)
  TO anon, authenticated;

-- ============================================================
-- 3. VALIDACION DEL CODIGO PARA ABRIR FORMULARIOS
-- Respuestas esperadas:
--   NO_EXISTE, NO_AUTORIZADO, DENEGADO, CANCELADO,
--   YA_REGISTRADO, AUTORIZADO
-- ============================================================

CREATE OR REPLACE FUNCTION public.validar_codigo_formulario(
  p_codigo UUID,
  p_formulario TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acceso RECORD;
  v_formulario TEXT := UPPER(BTRIM(COALESCE(p_formulario, '')));
BEGIN
  IF v_formulario NOT IN ('EQUIPOS', 'LLAVES') THEN
    RETURN 'NO_AUTORIZADO';
  END IF;

  SELECT
    a.id,
    a.estado_aprobacion,
    a.estado_acceso,
    tt.gestiona_equipos,
    n.requiere_llave
  INTO v_acceso
  FROM public.accesos a
  JOIN public.tipos_trabajo tt
    ON tt.id = a.tipo_trabajo_id
  JOIN public.nodos n
    ON n.id = a.nodo_id
  WHERE a.codigo_seguimiento = p_codigo;

  IF NOT FOUND THEN
    RETURN 'NO_EXISTE';
  END IF;

  IF v_acceso.estado_aprobacion = 'DENEGADO' THEN
    RETURN 'DENEGADO';
  END IF;

  IF v_acceso.estado_aprobacion = 'CANCELADO'
     OR v_acceso.estado_acceso = 'CANCELADO' THEN
    RETURN 'CANCELADO';
  END IF;

  IF v_acceso.estado_aprobacion <> 'APROBADO' THEN
    RETURN 'NO_AUTORIZADO';
  END IF;

  IF v_formulario = 'EQUIPOS' THEN
    IF v_acceso.gestiona_equipos = FALSE THEN
      RETURN 'NO_AUTORIZADO';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.movimientos m
      WHERE m.acceso_id = v_acceso.id
    ) THEN
      RETURN 'YA_REGISTRADO';
    END IF;

    RETURN 'AUTORIZADO';
  END IF;

  IF v_formulario = 'LLAVES' THEN
    IF v_acceso.requiere_llave = FALSE THEN
      RETURN 'NO_AUTORIZADO';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.prestamos_llave pl
      WHERE pl.acceso_id = v_acceso.id
    ) THEN
      RETURN 'YA_REGISTRADO';
    END IF;

    RETURN 'AUTORIZADO';
  END IF;

  RETURN 'NO_AUTORIZADO';
END;
$$;

REVOKE ALL ON FUNCTION public.validar_codigo_formulario(UUID, TEXT)
  FROM PUBLIC;
GRANT EXECUTE
  ON FUNCTION public.validar_codigo_formulario(UUID, TEXT)
  TO anon, authenticated;

COMMIT;

-- ============================================================
-- VERIFICACION MANUAL DESPUES DE EJECUTAR
-- ============================================================
-- SELECT id, name, public, file_size_limit, allowed_mime_types
-- FROM storage.buckets
-- WHERE id = 'sctr';
--
-- SELECT routine_name
-- FROM information_schema.routines
-- WHERE routine_schema = 'public'
--   AND routine_name IN (
--     'consultar_seguimiento',
--     'validar_codigo_formulario'
--   )
-- ORDER BY routine_name;
