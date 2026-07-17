-- ============================================================
-- PROYECTO ACCESOS V2 - ETAPA 6
-- Resolucion segura de solicitudes por administradores.
--
-- Requiere haber ejecutado 01 a 05.
-- Corrige ademas la validacion publica para impedir que una
-- solicitud PENDIENTE abra los formularios de equipos/llaves.
-- ============================================================

BEGIN;

ALTER TABLE public.accesos
  ADD COLUMN IF NOT EXISTS observacion_aprobacion TEXT;

CREATE OR REPLACE FUNCTION public.resolver_solicitud_acceso(
  p_acceso_id BIGINT,
  p_decision TEXT,
  p_observacion TEXT DEFAULT NULL
)
RETURNS public.accesos
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_decision TEXT := UPPER(BTRIM(COALESCE(p_decision, '')));
  v_observacion TEXT := NULLIF(BTRIM(COALESCE(p_observacion, '')), '');
  v_acceso public.accesos;
BEGIN
  IF auth.uid() IS NULL OR NOT public.es_admin() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF v_decision NOT IN ('APROBADO', 'DENEGADO', 'CANCELADO') THEN
    RAISE EXCEPTION 'La decision debe ser APROBADO, DENEGADO o CANCELADO';
  END IF;

  IF v_decision IN ('DENEGADO', 'CANCELADO') AND v_observacion IS NULL THEN
    RAISE EXCEPTION 'Debe indicar el motivo de la denegacion o cancelacion';
  END IF;

  SELECT * INTO v_acceso
  FROM public.accesos
  WHERE id = p_acceso_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La solicitud no existe';
  END IF;

  IF v_acceso.estado_aprobacion <> 'PENDIENTE' THEN
    RAISE EXCEPTION 'La solicitud ya fue resuelta';
  END IF;

  UPDATE public.accesos
  SET
    estado_aprobacion = v_decision,
    estado_acceso = CASE
      WHEN v_decision IN ('DENEGADO', 'CANCELADO') THEN 'CANCELADO'
      ELSE estado_acceso
    END,
    observacion_aprobacion = v_observacion,
    aprobado_por = auth.uid(),
    fecha_aprobacion = NOW()
  WHERE id = p_acceso_id
  RETURNING * INTO v_acceso;

  RETURN v_acceso;
END;
$$;

REVOKE ALL ON FUNCTION public.resolver_solicitud_acceso(
  BIGINT, TEXT, TEXT
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolver_solicitud_acceso(
  BIGINT, TEXT, TEXT
) FROM anon;
GRANT EXECUTE ON FUNCTION public.resolver_solicitud_acceso(
  BIGINT, TEXT, TEXT
) TO authenticated;

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
  JOIN public.tipos_trabajo tt ON tt.id = a.tipo_trabajo_id
  JOIN public.nodos n ON n.id = a.nodo_id
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
      SELECT 1 FROM public.movimientos m
      WHERE m.acceso_id = v_acceso.id
    ) THEN
      RETURN 'YA_REGISTRADO';
    END IF;

    RETURN 'AUTORIZADO';
  END IF;

  IF v_acceso.requiere_llave = FALSE THEN
    RETURN 'NO_AUTORIZADO';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.prestamos_llave pl
    WHERE pl.acceso_id = v_acceso.id
  ) THEN
    RETURN 'YA_REGISTRADO';
  END IF;

  RETURN 'AUTORIZADO';
END;
$$;

REVOKE ALL ON FUNCTION public.validar_codigo_formulario(UUID, TEXT)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validar_codigo_formulario(UUID, TEXT)
  TO anon, authenticated;

COMMIT;

-- Verificacion segura para la solicitud PENDIENTE de prueba:
-- SELECT public.validar_codigo_formulario(
--   'REEMPLAZAR-POR-CODIGO'::UUID,
--   'EQUIPOS'
-- );
-- Debe devolver NO_AUTORIZADO hasta que un administrador apruebe.
