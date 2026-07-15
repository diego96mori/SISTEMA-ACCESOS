-- ============================================================
-- PROYECTO ACCESOS V2 - ETAPA 5
-- Funcion transaccional interna para registrar una solicitud.
--
-- Esta funcion solo puede ser ejecutada por service_role.
-- La futura Edge Function validara y subira los PDF antes de
-- invocarla. Si una insercion falla, PostgreSQL revierte todo.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.crear_solicitud_acceso_interna(
  p_acceso JSONB,
  p_personal JSONB,
  p_documentos JSONB
)
RETURNS TABLE (
  acceso_id BIGINT,
  codigo_seguimiento UUID,
  requiere_equipos BOOLEAN,
  requiere_llave BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acceso_id BIGINT;
  v_codigo UUID;
  v_numero_personal INTEGER;
  v_numero_documentos INTEGER;
  v_nodo_id INTEGER;
  v_empresa_id INTEGER;
  v_area_responsable_id INTEGER;
  v_area_apoyo_id INTEGER;
  v_tipo_trabajo_id INTEGER;
  v_tipo_documento_id INTEGER;
  v_nivel_acceso_id INTEGER;
  v_trabajo_contrata BOOLEAN;
  v_requiere_equipos BOOLEAN;
  v_requiere_llave BOOLEAN;
  v_persona JSONB;
  v_documento JSONB;
  v_orden INTEGER;
BEGIN
  IF p_acceso IS NULL OR jsonb_typeof(p_acceso) <> 'object' THEN
    RAISE EXCEPTION 'Los datos del acceso son invalidos';
  END IF;

  IF p_personal IS NULL OR jsonb_typeof(p_personal) <> 'array' THEN
    RAISE EXCEPTION 'El personal debe enviarse como una lista';
  END IF;

  IF p_documentos IS NULL OR jsonb_typeof(p_documentos) <> 'array' THEN
    RAISE EXCEPTION 'Los documentos deben enviarse como una lista';
  END IF;

  v_numero_personal := jsonb_array_length(p_personal);
  v_numero_documentos := jsonb_array_length(p_documentos);

  IF v_numero_personal NOT BETWEEN 1 AND 8 THEN
    RAISE EXCEPTION 'La solicitud debe incluir entre 1 y 8 personas';
  END IF;

  IF v_numero_documentos NOT BETWEEN 1 AND 3 THEN
    RAISE EXCEPTION 'La solicitud debe incluir entre 1 y 3 documentos SCTR';
  END IF;

  BEGIN
    v_nodo_id := (p_acceso->>'nodo_id')::INTEGER;
    v_empresa_id := (p_acceso->>'empresa_id')::INTEGER;
    v_area_responsable_id := (p_acceso->>'area_responsable_id')::INTEGER;
    v_area_apoyo_id := NULLIF(p_acceso->>'area_apoyo_id', '')::INTEGER;
    v_tipo_trabajo_id := (p_acceso->>'tipo_trabajo_id')::INTEGER;
    v_tipo_documento_id := (p_acceso->>'solicitante_tipo_doc_id')::INTEGER;
    v_nivel_acceso_id := (p_acceso->>'nivel_acceso_id')::INTEGER;
    v_trabajo_contrata := COALESCE(
      (p_acceso->>'trabajo_contrata')::BOOLEAN,
      FALSE
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Uno o mas identificadores del acceso son invalidos';
  END;

  SELECT n.requiere_llave, tt.gestiona_equipos
  INTO v_requiere_llave, v_requiere_equipos
  FROM public.nodos n
  CROSS JOIN public.tipos_trabajo tt
  WHERE n.id = v_nodo_id
    AND n.activo = TRUE
    AND tt.id = v_tipo_trabajo_id
    AND tt.activo = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El nodo o el tipo de trabajo no es valido';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = v_empresa_id AND e.activo = TRUE
  ) THEN
    RAISE EXCEPTION 'La empresa no es valida';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.areas ar
    WHERE ar.id = v_area_responsable_id
      AND ar.empresa_id = v_empresa_id
      AND ar.activo = TRUE
  ) THEN
    RAISE EXCEPTION 'El area responsable no pertenece a la empresa';
  END IF;

  IF v_area_apoyo_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.areas aa
    WHERE aa.id = v_area_apoyo_id AND aa.activo = TRUE
  ) THEN
    RAISE EXCEPTION 'El area de apoyo no es valida';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.tipos_documento td
    WHERE td.id = v_tipo_documento_id AND td.activo = TRUE
  ) THEN
    RAISE EXCEPTION 'El tipo de documento del solicitante no es valido';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.niveles_acceso na
    WHERE na.id = v_nivel_acceso_id AND na.activo = TRUE
  ) THEN
    RAISE EXCEPTION 'El nivel de acceso no es valido';
  END IF;

  IF NULLIF(BTRIM(p_acceso->>'solicitante_nombre'), '') IS NULL
     OR NULLIF(BTRIM(p_acceso->>'solicitante_ap_paterno'), '') IS NULL
     OR NULLIF(BTRIM(p_acceso->>'solicitante_ap_materno'), '') IS NULL
     OR NULLIF(BTRIM(p_acceso->>'solicitante_num_doc'), '') IS NULL
     OR NULLIF(BTRIM(p_acceso->>'solicitante_telefono'), '') IS NULL THEN
    RAISE EXCEPTION 'Los datos del solicitante estan incompletos';
  END IF;

  IF COALESCE(p_acceso->>'solicitante_correo', '')
     !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' THEN
    RAISE EXCEPTION 'El correo del solicitante no es valido';
  END IF;

  INSERT INTO public.accesos (
    nodo_id,
    fecha_ingreso,
    fecha_salida,
    hora_ingreso,
    hora_salida,
    solicitante_nombre,
    solicitante_ap_paterno,
    solicitante_ap_materno,
    solicitante_tipo_doc_id,
    solicitante_num_doc,
    solicitante_telefono,
    solicitante_correo,
    nivel_acceso_id,
    empresa_id,
    area_responsable_id,
    area_apoyo_id,
    tipo_trabajo_id,
    detalle_trabajo,
    trabajo_contrata,
    nombre_contrata,
    numero_personal
  )
  VALUES (
    v_nodo_id,
    (p_acceso->>'fecha_ingreso')::DATE,
    (p_acceso->>'fecha_salida')::DATE,
    (p_acceso->>'hora_ingreso')::TIME,
    (p_acceso->>'hora_salida')::TIME,
    BTRIM(p_acceso->>'solicitante_nombre'),
    BTRIM(p_acceso->>'solicitante_ap_paterno'),
    BTRIM(p_acceso->>'solicitante_ap_materno'),
    v_tipo_documento_id,
    BTRIM(p_acceso->>'solicitante_num_doc'),
    BTRIM(p_acceso->>'solicitante_telefono'),
    LOWER(BTRIM(p_acceso->>'solicitante_correo')),
    v_nivel_acceso_id,
    v_empresa_id,
    v_area_responsable_id,
    v_area_apoyo_id,
    v_tipo_trabajo_id,
    NULLIF(BTRIM(p_acceso->>'detalle_trabajo'), ''),
    v_trabajo_contrata,
    CASE
      WHEN v_trabajo_contrata
        THEN NULLIF(BTRIM(p_acceso->>'nombre_contrata'), '')
      ELSE NULL
    END,
    v_numero_personal
  )
  RETURNING id, accesos.codigo_seguimiento
  INTO v_acceso_id, v_codigo;

  FOR v_persona, v_orden IN
    SELECT value, ordinality::INTEGER
    FROM jsonb_array_elements(p_personal) WITH ORDINALITY
  LOOP
    IF NULLIF(BTRIM(v_persona->>'nombre'), '') IS NULL
       OR NULLIF(BTRIM(v_persona->>'ap_paterno'), '') IS NULL
       OR NULLIF(BTRIM(v_persona->>'ap_materno'), '') IS NULL
       OR NULLIF(BTRIM(v_persona->>'num_doc'), '') IS NULL
       OR NULLIF(BTRIM(v_persona->>'telefono'), '') IS NULL THEN
      RAISE EXCEPTION 'Los datos de la persona % estan incompletos', v_orden;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.tipos_documento td
      WHERE td.id = (v_persona->>'tipo_doc_id')::INTEGER
        AND td.activo = TRUE
    ) THEN
      RAISE EXCEPTION 'Tipo de documento invalido para la persona %', v_orden;
    END IF;

    INSERT INTO public.personal_acceso (
      acceso_id,
      orden,
      nombre,
      ap_paterno,
      ap_materno,
      tipo_doc_id,
      num_doc,
      telefono
    )
    VALUES (
      v_acceso_id,
      v_orden,
      BTRIM(v_persona->>'nombre'),
      BTRIM(v_persona->>'ap_paterno'),
      BTRIM(v_persona->>'ap_materno'),
      (v_persona->>'tipo_doc_id')::INTEGER,
      BTRIM(v_persona->>'num_doc'),
      BTRIM(v_persona->>'telefono')
    );
  END LOOP;

  FOR v_documento IN
    SELECT value FROM jsonb_array_elements(p_documentos)
  LOOP
    IF NULLIF(BTRIM(v_documento->>'storage_path'), '') IS NULL
       OR NULLIF(BTRIM(v_documento->>'nombre_original'), '') IS NULL THEN
      RAISE EXCEPTION 'Los metadatos de un documento estan incompletos';
    END IF;

    IF COALESCE(v_documento->>'mime_type', '') <> 'application/pdf' THEN
      RAISE EXCEPTION 'Solo se permiten documentos PDF';
    END IF;

    IF (v_documento->>'size_bytes')::BIGINT NOT BETWEEN 1 AND 10485760 THEN
      RAISE EXCEPTION 'Un documento supera el limite de 10 MiB';
    END IF;

    INSERT INTO public.acceso_documentos (
      acceso_id,
      storage_path,
      nombre_original,
      mime_type,
      size_bytes
    )
    VALUES (
      v_acceso_id,
      BTRIM(v_documento->>'storage_path'),
      BTRIM(v_documento->>'nombre_original'),
      v_documento->>'mime_type',
      (v_documento->>'size_bytes')::BIGINT
    );
  END LOOP;

  RETURN QUERY
  SELECT
    v_acceso_id,
    v_codigo,
    v_requiere_equipos,
    v_requiere_llave;
END;
$$;

REVOKE ALL ON FUNCTION public.crear_solicitud_acceso_interna(
  JSONB, JSONB, JSONB
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crear_solicitud_acceso_interna(
  JSONB, JSONB, JSONB
) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crear_solicitud_acceso_interna(
  JSONB, JSONB, JSONB
) TO service_role;

COMMIT;

-- ============================================================
-- VERIFICACION MANUAL DESPUES DE EJECUTAR
-- ============================================================
-- SELECT routine_name, security_type
-- FROM information_schema.routines
-- WHERE routine_schema = 'public'
--   AND routine_name = 'crear_solicitud_acceso_interna';

