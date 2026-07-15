-- ============================================================
-- PROYECTO ACCESOS V2 - ETAPA 8
-- Preparacion y cierre atomico de instalaciones, retiros y
-- reemplazos procesados por el proxy interno de NetBox.
--
-- Requiere haber ejecutado 01 a 07.
-- No realiza llamadas ni cambios directos en NetBox.
-- ============================================================

BEGIN;

ALTER TABLE public.movimiento_detalle
  ADD COLUMN IF NOT EXISTS device_role_netbox_id INTEGER,
  ADD COLUMN IF NOT EXISTS device_role_nombre TEXT;

ALTER TABLE public.movimiento_detalle
  DROP CONSTRAINT IF EXISTS movimiento_detalle_device_role_check;

ALTER TABLE public.movimiento_detalle
  ADD CONSTRAINT movimiento_detalle_device_role_check
  CHECK (device_role_netbox_id IS NULL OR device_role_netbox_id > 0);

CREATE OR REPLACE FUNCTION public.preparar_procesamiento_movimiento(
  p_movimiento_id BIGINT,
  p_aprobaciones JSONB
)
RETURNS public.movimientos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_movimiento public.movimientos;
  v_instalaciones INTEGER;
  v_actualizados INTEGER;
BEGIN
  IF auth.uid() IS NULL OR NOT public.es_admin() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF p_aprobaciones IS NULL OR jsonb_typeof(p_aprobaciones) <> 'array' THEN
    RAISE EXCEPTION 'Las aprobaciones deben enviarse como una lista';
  END IF;

  SELECT * INTO v_movimiento
  FROM public.movimientos
  WHERE id = p_movimiento_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El movimiento no existe';
  END IF;

  IF v_movimiento.estado NOT IN ('PENDIENTE', 'EN_REVISION', 'ERROR') THEN
    RAISE EXCEPTION 'El movimiento ya fue procesado o esta siendo procesado';
  END IF;

  SELECT COUNT(*) INTO v_instalaciones
  FROM public.movimiento_detalle
  WHERE movimiento_id = p_movimiento_id
    AND accion = 'INSTALACION';

  IF jsonb_array_length(p_aprobaciones) <> v_instalaciones THEN
    RAISE EXCEPTION 'Debe confirmar todos los equipos que seran instalados';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_aprobaciones) AS x(
      detalle_id BIGINT,
      nombre_aprobado TEXT,
      device_role_netbox_id INTEGER,
      device_role_nombre TEXT,
      rack_aprobado_netbox_id INTEGER,
      rack_aprobado_nombre TEXT,
      ru_inicio_aprobada INTEGER
    )
    WHERE x.detalle_id IS NULL
       OR NULLIF(BTRIM(x.nombre_aprobado), '') IS NULL
       OR x.device_role_netbox_id IS NULL
       OR x.device_role_netbox_id <= 0
  ) THEN
    RAISE EXCEPTION 'Cada instalacion requiere nombre y rol de dispositivo';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_aprobaciones) AS x(
      detalle_id BIGINT,
      nombre_aprobado TEXT,
      device_role_netbox_id INTEGER,
      device_role_nombre TEXT,
      rack_aprobado_netbox_id INTEGER,
      rack_aprobado_nombre TEXT,
      ru_inicio_aprobada INTEGER
    )
    GROUP BY LOWER(BTRIM(x.nombre_aprobado))
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Los nombres aprobados no pueden repetirse';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_aprobaciones) AS x(
      detalle_id BIGINT,
      nombre_aprobado TEXT,
      device_role_netbox_id INTEGER,
      device_role_nombre TEXT,
      rack_aprobado_netbox_id INTEGER,
      rack_aprobado_nombre TEXT,
      ru_inicio_aprobada INTEGER
    )
    LEFT JOIN public.movimiento_detalle d
      ON d.id = x.detalle_id
     AND d.movimiento_id = p_movimiento_id
     AND d.accion = 'INSTALACION'
    WHERE d.id IS NULL
       OR (
         d.es_rackeable = TRUE
         AND (
           x.rack_aprobado_netbox_id IS NULL
           OR x.rack_aprobado_netbox_id <= 0
           OR x.ru_inicio_aprobada IS NULL
           OR x.ru_inicio_aprobada <= 0
         )
       )
       OR (
         d.es_rackeable = FALSE
         AND (
           x.rack_aprobado_netbox_id IS NOT NULL
           OR x.ru_inicio_aprobada IS NOT NULL
         )
       )
  ) THEN
    RAISE EXCEPTION 'La seleccion de rack o RU no es valida';
  END IF;

  IF EXISTS (
    WITH seleccion AS (
      SELECT
        x.detalle_id,
        x.rack_aprobado_netbox_id AS rack_id,
        x.ru_inicio_aprobada AS ru_inicio,
        d.cantidad_ru
      FROM jsonb_to_recordset(p_aprobaciones) AS x(
        detalle_id BIGINT,
        nombre_aprobado TEXT,
        device_role_netbox_id INTEGER,
        device_role_nombre TEXT,
        rack_aprobado_netbox_id INTEGER,
        rack_aprobado_nombre TEXT,
        ru_inicio_aprobada INTEGER
      )
      JOIN public.movimiento_detalle d ON d.id = x.detalle_id
      WHERE d.movimiento_id = p_movimiento_id
        AND d.es_rackeable = TRUE
    )
    SELECT 1
    FROM seleccion a
    JOIN seleccion b
      ON a.detalle_id < b.detalle_id
     AND a.rack_id = b.rack_id
     AND a.ru_inicio <= b.ru_inicio + b.cantidad_ru - 1
     AND b.ru_inicio <= a.ru_inicio + a.cantidad_ru - 1
  ) THEN
    RAISE EXCEPTION 'Dos equipos de la solicitud ocupan unidades RU incompatibles';
  END IF;

  WITH aprobaciones AS (
    SELECT *
    FROM jsonb_to_recordset(p_aprobaciones) AS x(
      detalle_id BIGINT,
      nombre_aprobado TEXT,
      device_role_netbox_id INTEGER,
      device_role_nombre TEXT,
      rack_aprobado_netbox_id INTEGER,
      rack_aprobado_nombre TEXT,
      ru_inicio_aprobada INTEGER
    )
  )
  UPDATE public.movimiento_detalle d
  SET
    nombre_aprobado = BTRIM(a.nombre_aprobado),
    device_role_netbox_id = a.device_role_netbox_id,
    device_role_nombre = NULLIF(BTRIM(a.device_role_nombre), ''),
    rack_aprobado_netbox_id = CASE
      WHEN d.es_rackeable THEN a.rack_aprobado_netbox_id
      ELSE NULL
    END,
    rack_aprobado_nombre = CASE
      WHEN d.es_rackeable THEN NULLIF(BTRIM(a.rack_aprobado_nombre), '')
      ELSE NULL
    END,
    ru_inicio_aprobada = CASE
      WHEN d.es_rackeable THEN a.ru_inicio_aprobada
      ELSE NULL
    END
  FROM aprobaciones a
  WHERE d.id = a.detalle_id
    AND d.movimiento_id = p_movimiento_id
    AND d.accion = 'INSTALACION';

  GET DIAGNOSTICS v_actualizados = ROW_COUNT;
  IF v_actualizados <> v_instalaciones THEN
    RAISE EXCEPTION 'No se pudieron confirmar todos los detalles';
  END IF;

  UPDATE public.movimiento_detalle
  SET
    equipo_resultado_netbox_id = NULL,
    estado_ejecucion = 'PENDIENTE',
    respuesta_netbox = NULL,
    error_netbox = NULL,
    ejecutado_at = NULL
  WHERE movimiento_id = p_movimiento_id;

  UPDATE public.movimientos
  SET
    estado = 'PROCESANDO',
    error_general = NULL,
    observacion_admin = NULL,
    aprobado_por = NULL,
    fecha_aprobacion = NULL
  WHERE id = p_movimiento_id
  RETURNING * INTO v_movimiento;

  RETURN v_movimiento;
END;
$$;

REVOKE ALL ON FUNCTION public.preparar_procesamiento_movimiento(BIGINT, JSONB)
  FROM PUBLIC;
GRANT EXECUTE
  ON FUNCTION public.preparar_procesamiento_movimiento(BIGINT, JSONB)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.finalizar_procesamiento_movimiento(
  p_movimiento_id BIGINT,
  p_exito BOOLEAN,
  p_resultados JSONB DEFAULT '[]'::JSONB,
  p_error TEXT DEFAULT NULL
)
RETURNS public.movimientos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_movimiento public.movimientos;
  v_total INTEGER;
  v_actualizados INTEGER;
  v_error TEXT := LEFT(
    COALESCE(NULLIF(BTRIM(p_error), ''), 'Error de sincronizacion con NetBox'),
    2000
  );
BEGIN
  IF auth.uid() IS NULL OR NOT public.es_admin() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT * INTO v_movimiento
  FROM public.movimientos
  WHERE id = p_movimiento_id
  FOR UPDATE;

  IF NOT FOUND OR v_movimiento.estado <> 'PROCESANDO' THEN
    RAISE EXCEPTION 'El movimiento no esta en procesamiento';
  END IF;

  IF p_exito THEN
    IF p_resultados IS NULL OR jsonb_typeof(p_resultados) <> 'array' THEN
      RAISE EXCEPTION 'Los resultados deben enviarse como una lista';
    END IF;

    SELECT COUNT(*) INTO v_total
    FROM public.movimiento_detalle
    WHERE movimiento_id = p_movimiento_id;

    IF jsonb_array_length(p_resultados) <> v_total THEN
      RAISE EXCEPTION 'Faltan resultados de equipos procesados';
    END IF;

    WITH resultados AS (
      SELECT *
      FROM jsonb_to_recordset(p_resultados) AS x(
        detalle_id BIGINT,
        netbox_id INTEGER,
        respuesta JSONB
      )
    )
    UPDATE public.movimiento_detalle d
    SET
      equipo_resultado_netbox_id = r.netbox_id,
      estado_ejecucion = 'EJECUTADO',
      respuesta_netbox = r.respuesta,
      error_netbox = NULL,
      ejecutado_at = NOW()
    FROM resultados r
    WHERE d.id = r.detalle_id
      AND d.movimiento_id = p_movimiento_id
      AND r.netbox_id IS NOT NULL;

    GET DIAGNOSTICS v_actualizados = ROW_COUNT;
    IF v_actualizados <> v_total THEN
      RAISE EXCEPTION 'Los resultados no corresponden al movimiento';
    END IF;

    UPDATE public.movimientos
    SET
      estado = 'APROBADO',
      error_general = NULL,
      aprobado_por = auth.uid(),
      fecha_aprobacion = NOW()
    WHERE id = p_movimiento_id
    RETURNING * INTO v_movimiento;
  ELSE
    UPDATE public.movimiento_detalle
    SET
      estado_ejecucion = 'ERROR',
      error_netbox = v_error,
      ejecutado_at = NOW()
    WHERE movimiento_id = p_movimiento_id;

    UPDATE public.movimientos
    SET
      estado = 'ERROR',
      error_general = v_error,
      aprobado_por = NULL,
      fecha_aprobacion = NULL
    WHERE id = p_movimiento_id
    RETURNING * INTO v_movimiento;
  END IF;

  RETURN v_movimiento;
END;
$$;

REVOKE ALL ON FUNCTION public.finalizar_procesamiento_movimiento(
  BIGINT, BOOLEAN, JSONB, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalizar_procesamiento_movimiento(
  BIGINT, BOOLEAN, JSONB, TEXT
) TO authenticated;

COMMIT;

-- Verificacion manual:
-- SELECT column_name
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'movimiento_detalle'
--   AND column_name IN ('device_role_netbox_id', 'device_role_nombre');
