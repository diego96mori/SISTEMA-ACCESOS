-- ============================================================
-- PROYECTO ACCESOS V2 - ETAPA 10
-- Sincroniza los sites de NetBox con el catalogo public.nodos.
-- Requiere haber ejecutado 01 a 09.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.sincronizar_nodos_netbox(
  p_sites JSONB
)
RETURNS TABLE (
  insertados INTEGER,
  actualizados INTEGER,
  total INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_site RECORD;
  v_nodo public.nodos;
  v_insertados INTEGER := 0;
  v_actualizados INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.es_admin() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF p_sites IS NULL OR jsonb_typeof(p_sites) <> 'array' THEN
    RAISE EXCEPTION 'Los sites deben enviarse como una lista';
  END IF;

  IF jsonb_array_length(p_sites) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'La lista de sites no tiene una cantidad valida';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_sites) AS s(
      netbox_site_id INTEGER,
      nombre TEXT
    )
    WHERE s.netbox_site_id IS NULL
       OR s.netbox_site_id <= 0
       OR NULLIF(BTRIM(s.nombre), '') IS NULL
       OR LENGTH(BTRIM(s.nombre)) > 200
  ) THEN
    RAISE EXCEPTION 'Un site contiene un identificador o nombre invalido';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_sites) AS s(
      netbox_site_id INTEGER,
      nombre TEXT
    )
    GROUP BY s.netbox_site_id
    HAVING COUNT(*) > 1
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_sites) AS s(
      netbox_site_id INTEGER,
      nombre TEXT
    )
    GROUP BY LOWER(BTRIM(s.nombre))
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'NetBox devolvio sites duplicados';
  END IF;

  FOR v_site IN
    SELECT
      s.netbox_site_id,
      BTRIM(s.nombre) AS nombre
    FROM jsonb_to_recordset(p_sites) AS s(
      netbox_site_id INTEGER,
      nombre TEXT
    )
    ORDER BY s.netbox_site_id
  LOOP
    SELECT * INTO v_nodo
    FROM public.nodos
    WHERE netbox_site_id = v_site.netbox_site_id
    FOR UPDATE;

    IF FOUND THEN
      IF v_nodo.nombre IS DISTINCT FROM v_site.nombre
         OR v_nodo.activo IS DISTINCT FROM TRUE THEN
        UPDATE public.nodos
        SET
          nombre = v_site.nombre,
          activo = TRUE
        WHERE id = v_nodo.id;
        v_actualizados := v_actualizados + 1;
      END IF;
      CONTINUE;
    END IF;

    SELECT * INTO v_nodo
    FROM public.nodos
    WHERE LOWER(nombre) = LOWER(v_site.nombre)
    FOR UPDATE;

    IF FOUND THEN
      IF v_nodo.netbox_site_id IS NOT NULL
         AND v_nodo.netbox_site_id <> v_site.netbox_site_id THEN
        RAISE EXCEPTION
          'El nodo % ya esta asociado al site %',
          v_site.nombre,
          v_nodo.netbox_site_id;
      END IF;

      UPDATE public.nodos
      SET
        nombre = v_site.nombre,
        netbox_site_id = v_site.netbox_site_id,
        activo = TRUE
      WHERE id = v_nodo.id;
      v_actualizados := v_actualizados + 1;
    ELSE
      INSERT INTO public.nodos (
        nombre,
        requiere_llave,
        netbox_site_id,
        activo
      ) VALUES (
        v_site.nombre,
        FALSE,
        v_site.netbox_site_id,
        TRUE
      );
      v_insertados := v_insertados + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT
    v_insertados,
    v_actualizados,
    jsonb_array_length(p_sites);
END;
$$;

REVOKE ALL ON FUNCTION public.sincronizar_nodos_netbox(JSONB)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sincronizar_nodos_netbox(JSONB)
  TO authenticated;

COMMIT;

