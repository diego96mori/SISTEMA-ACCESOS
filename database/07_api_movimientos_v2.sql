-- ============================================================
-- PROYECTO ACCESOS V2 - ETAPA 7
-- API publica controlada para consultar y registrar el
-- formulario de equipos mediante codigo de seguimiento.
-- No realiza cambios en NetBox.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.obtener_contexto_equipos(
  p_codigo UUID
)
RETURNS TABLE (
  acceso_id BIGINT,
  codigo_seguimiento UUID,
  nodo TEXT,
  netbox_site_id INTEGER,
  tipo_trabajo TEXT,
  tipo_movimiento TEXT,
  solicitante TEXT,
  empresa TEXT,
  estado_aprobacion TEXT,
  movimiento_id BIGINT,
  movimiento_estado TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id,
    a.codigo_seguimiento,
    n.nombre,
    n.netbox_site_id,
    tt.nombre,
    CASE tt.nombre
      WHEN 'INSTALACION DE EQUIPOS' THEN 'INSTALACION'
      WHEN 'RETIRO DE EQUIPOS' THEN 'RETIRO'
      WHEN 'REEMPLAZO DE EQUIPOS' THEN 'REEMPLAZO'
      WHEN 'INGRESO_FO' THEN 'INGRESO_FO'
    END,
    CONCAT_WS(
      ' ',
      a.solicitante_nombre,
      a.solicitante_ap_paterno,
      a.solicitante_ap_materno
    ),
    COALESCE(a.nombre_contrata, e.nombre),
    a.estado_aprobacion,
    m.id,
    m.estado
  FROM public.accesos a
  JOIN public.nodos n ON n.id = a.nodo_id
  JOIN public.tipos_trabajo tt ON tt.id = a.tipo_trabajo_id
  JOIN public.empresas e ON e.id = a.empresa_id
  LEFT JOIN public.movimientos m ON m.acceso_id = a.id
  WHERE a.codigo_seguimiento = p_codigo
    AND a.estado_aprobacion = 'APROBADO'
    AND a.estado_acceso <> 'CANCELADO'
    AND tt.gestiona_equipos = TRUE;
$$;

REVOKE ALL ON FUNCTION public.obtener_contexto_equipos(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obtener_contexto_equipos(UUID)
  TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.registrar_movimiento_equipos(
  p_codigo UUID,
  p_detalles JSONB
)
RETURNS TABLE (
  movimiento_id BIGINT,
  estado TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acceso RECORD;
  v_movimiento_id BIGINT;
  v_tipo TEXT;
  v_detalle JSONB;
  v_numero_item INTEGER;
  v_accion TEXT;
  v_cantidad INTEGER;
  v_insertados INTEGER := 0;
BEGIN
  IF p_detalles IS NULL OR jsonb_typeof(p_detalles) <> 'array' THEN
    RAISE EXCEPTION 'Los detalles deben enviarse como una lista';
  END IF;

  IF jsonb_array_length(p_detalles) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'La solicitud debe contener entre 1 y 100 detalles';
  END IF;

  SELECT
    a.id AS acceso_id,
    a.estado_aprobacion,
    a.estado_acceso,
    tt.nombre AS tipo_trabajo,
    tt.gestiona_equipos
  INTO v_acceso
  FROM public.accesos a
  JOIN public.tipos_trabajo tt ON tt.id = a.tipo_trabajo_id
  WHERE a.codigo_seguimiento = p_codigo
  FOR UPDATE OF a;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El codigo de seguimiento no existe';
  END IF;

  IF v_acceso.estado_aprobacion <> 'APROBADO'
     OR v_acceso.estado_acceso = 'CANCELADO'
     OR v_acceso.gestiona_equipos = FALSE THEN
    RAISE EXCEPTION 'La solicitud no esta autorizada para equipos';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.movimientos
    WHERE acceso_id = v_acceso.acceso_id
  ) THEN
    RAISE EXCEPTION 'La solicitud de equipos ya fue registrada';
  END IF;

  v_tipo := CASE v_acceso.tipo_trabajo
    WHEN 'INSTALACION DE EQUIPOS' THEN 'INSTALACION'
    WHEN 'RETIRO DE EQUIPOS' THEN 'RETIRO'
    WHEN 'REEMPLAZO DE EQUIPOS' THEN 'REEMPLAZO'
    WHEN 'INGRESO_FO' THEN 'INGRESO_FO'
    ELSE NULL
  END;

  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'El tipo de trabajo no tiene un movimiento asociado';
  END IF;

  SELECT COUNT(DISTINCT (value->>'numero_item')::INTEGER)
  INTO v_cantidad
  FROM jsonb_array_elements(p_detalles);

  IF v_cantidad NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'La cantidad de items debe estar entre 1 y 50';
  END IF;

  INSERT INTO public.movimientos (
    acceso_id,
    tipo_movimiento,
    cantidad_items
  ) VALUES (
    v_acceso.acceso_id,
    v_tipo,
    v_cantidad
  ) RETURNING id INTO v_movimiento_id;

  FOR v_detalle IN
    SELECT value FROM jsonb_array_elements(p_detalles)
  LOOP
    BEGIN
      v_numero_item := (v_detalle->>'numero_item')::INTEGER;
      v_accion := UPPER(BTRIM(v_detalle->>'accion'));
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Un detalle contiene identificadores invalidos';
    END;

    IF v_numero_item < 1 OR v_accion NOT IN ('RETIRO', 'INSTALACION') THEN
      RAISE EXCEPTION 'Un detalle contiene una accion o numero invalido';
    END IF;

    IF v_tipo = 'RETIRO' AND v_accion <> 'RETIRO' THEN
      RAISE EXCEPTION 'Un retiro solo admite detalles de retiro';
    END IF;

    IF v_tipo = 'INSTALACION' AND v_accion <> 'INSTALACION' THEN
      RAISE EXCEPTION 'Una instalacion solo admite detalles de instalacion';
    END IF;

    IF v_tipo = 'REEMPLAZO'
       AND NULLIF(v_detalle->>'grupo_reemplazo', '') IS NULL THEN
      RAISE EXCEPTION 'Cada detalle de reemplazo debe indicar su grupo';
    END IF;

    INSERT INTO public.movimiento_detalle (
      movimiento_id,
      numero_item,
      grupo_reemplazo,
      accion,
      es_rackeable,
      equipo_anterior_netbox_id,
      equipo_anterior_nombre,
      equipo_anterior_fabricante,
      equipo_anterior_modelo,
      equipo_anterior_serial,
      equipo_anterior_rack_netbox_id,
      equipo_anterior_rack_nombre,
      equipo_anterior_ru_inicio,
      equipo_anterior_cantidad_ru,
      manufacturer_netbox_id,
      device_type_netbox_id,
      fabricante,
      modelo,
      serial,
      nombre_propuesto,
      cantidad_ru
    ) VALUES (
      v_movimiento_id,
      v_numero_item,
      NULLIF(v_detalle->>'grupo_reemplazo', '')::INTEGER,
      v_accion,
      COALESCE((v_detalle->>'es_rackeable')::BOOLEAN, FALSE),
      NULLIF(v_detalle->>'equipo_anterior_netbox_id', '')::INTEGER,
      NULLIF(BTRIM(v_detalle->>'equipo_anterior_nombre'), ''),
      NULLIF(BTRIM(v_detalle->>'equipo_anterior_fabricante'), ''),
      NULLIF(BTRIM(v_detalle->>'equipo_anterior_modelo'), ''),
      NULLIF(BTRIM(v_detalle->>'equipo_anterior_serial'), ''),
      NULLIF(v_detalle->>'equipo_anterior_rack_netbox_id', '')::INTEGER,
      NULLIF(BTRIM(v_detalle->>'equipo_anterior_rack_nombre'), ''),
      NULLIF(v_detalle->>'equipo_anterior_ru_inicio', '')::INTEGER,
      NULLIF(v_detalle->>'equipo_anterior_cantidad_ru', '')::INTEGER,
      NULLIF(v_detalle->>'manufacturer_netbox_id', '')::INTEGER,
      NULLIF(v_detalle->>'device_type_netbox_id', '')::INTEGER,
      NULLIF(BTRIM(v_detalle->>'fabricante'), ''),
      NULLIF(BTRIM(v_detalle->>'modelo'), ''),
      NULLIF(BTRIM(v_detalle->>'serial'), ''),
      NULLIF(BTRIM(v_detalle->>'nombre_propuesto'), ''),
      COALESCE(NULLIF(v_detalle->>'cantidad_ru', '')::INTEGER, 1)
    );

    v_insertados := v_insertados + 1;
  END LOOP;

  IF v_tipo = 'REEMPLAZO' AND v_insertados <> v_cantidad * 2 THEN
    RAISE EXCEPTION 'Cada reemplazo debe incluir un retiro y una instalacion';
  END IF;

  IF v_tipo IN ('RETIRO', 'INSTALACION') AND v_insertados <> v_cantidad THEN
    RAISE EXCEPTION 'La cantidad de detalles no coincide con los items';
  END IF;

  IF v_tipo = 'REEMPLAZO' AND EXISTS (
    SELECT 1
    FROM (
      SELECT
        (value->>'numero_item')::INTEGER AS numero_item,
        COUNT(*) AS total,
        COUNT(DISTINCT UPPER(value->>'accion')) AS acciones
      FROM jsonb_array_elements(p_detalles)
      GROUP BY (value->>'numero_item')::INTEGER
    ) x
    WHERE x.total <> 2 OR x.acciones <> 2
  ) THEN
    RAISE EXCEPTION 'Cada reemplazo debe tener una accion RETIRO y otra INSTALACION';
  END IF;

  RETURN QUERY SELECT v_movimiento_id, 'PENDIENTE'::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_movimiento_equipos(UUID, JSONB)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_movimiento_equipos(UUID, JSONB)
  TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.denegar_movimiento_equipos(
  p_movimiento_id BIGINT,
  p_observacion TEXT
)
RETURNS public.movimientos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_movimiento public.movimientos;
  v_observacion TEXT := NULLIF(BTRIM(COALESCE(p_observacion, '')), '');
BEGIN
  IF auth.uid() IS NULL OR NOT public.es_admin() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF v_observacion IS NULL THEN
    RAISE EXCEPTION 'Debe indicar el motivo de la denegacion';
  END IF;

  UPDATE public.movimientos
  SET
    estado = 'DENEGADO',
    observacion_admin = v_observacion,
    aprobado_por = auth.uid(),
    fecha_aprobacion = NOW()
  WHERE id = p_movimiento_id
    AND estado IN ('PENDIENTE', 'EN_REVISION')
  RETURNING * INTO v_movimiento;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El movimiento no existe o ya fue procesado';
  END IF;

  RETURN v_movimiento;
END;
$$;

REVOKE ALL ON FUNCTION public.denegar_movimiento_equipos(BIGINT, TEXT)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.denegar_movimiento_equipos(BIGINT, TEXT)
  TO authenticated;

COMMIT;
