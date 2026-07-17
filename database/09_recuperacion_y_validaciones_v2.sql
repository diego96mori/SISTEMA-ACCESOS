-- ============================================================
-- PROYECTO ACCESOS V2 - ETAPA 9
-- Recuperacion de procesamientos interrumpidos y validaciones
-- adicionales para impedir retiros duplicados.
-- Requiere haber ejecutado 01 a 08.
-- ============================================================

BEGIN;

ALTER TABLE public.movimientos
  ADD COLUMN IF NOT EXISTS procesamiento_iniciado_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.marcar_inicio_procesamiento()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.estado = 'PROCESANDO'
     AND (TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM 'PROCESANDO') THEN
    NEW.procesamiento_iniciado_at := NOW();
  ELSIF NEW.estado <> 'PROCESANDO' THEN
    NEW.procesamiento_iniciado_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS movimientos_inicio_procesamiento
  ON public.movimientos;

CREATE TRIGGER movimientos_inicio_procesamiento
BEFORE INSERT OR UPDATE OF estado ON public.movimientos
FOR EACH ROW
EXECUTE FUNCTION public.marcar_inicio_procesamiento();

UPDATE public.movimientos
SET procesamiento_iniciado_at = COALESCE(created_at, NOW())
WHERE estado = 'PROCESANDO'
  AND procesamiento_iniciado_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'movimiento_detalle_netbox_id_positivo'
      AND conrelid = 'public.movimiento_detalle'::regclass
  ) THEN
    ALTER TABLE public.movimiento_detalle
      ADD CONSTRAINT movimiento_detalle_netbox_id_positivo
      CHECK (
        equipo_anterior_netbox_id IS NULL
        OR equipo_anterior_netbox_id > 0
      );
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS
  movimiento_detalle_retiro_equipo_unique
ON public.movimiento_detalle (
  movimiento_id,
  equipo_anterior_netbox_id
)
WHERE accion = 'RETIRO'
  AND equipo_anterior_netbox_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.recuperar_procesamientos_vencidos()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recuperados INTEGER;
BEGIN
  IF auth.uid() IS NULL OR NOT public.es_admin() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  WITH vencidos AS (
    UPDATE public.movimientos
    SET
      estado = 'ERROR',
      error_general = 'El procesamiento anterior fue interrumpido y puede reintentarse',
      aprobado_por = NULL,
      fecha_aprobacion = NULL
    WHERE estado = 'PROCESANDO'
      AND procesamiento_iniciado_at < NOW() - INTERVAL '1 hour'
    RETURNING id
  )
  SELECT COUNT(*) INTO v_recuperados FROM vencidos;

  UPDATE public.movimiento_detalle d
  SET
    estado_ejecucion = 'ERROR',
    error_netbox = 'El procesamiento anterior fue interrumpido',
    ejecutado_at = NOW()
  FROM public.movimientos m
  WHERE d.movimiento_id = m.id
    AND m.estado = 'ERROR'
    AND m.error_general =
      'El procesamiento anterior fue interrumpido y puede reintentarse'
    AND d.estado_ejecucion <> 'EJECUTADO';

  RETURN v_recuperados;
END;
$$;

REVOKE ALL ON FUNCTION public.recuperar_procesamientos_vencidos()
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recuperar_procesamientos_vencidos()
  TO authenticated;

COMMIT;
