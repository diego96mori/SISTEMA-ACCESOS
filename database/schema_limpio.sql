-- ============================================================
-- SCHEMA LIMPIO - SISTEMA DE ACCESOS Y MOVIMIENTOS NETBOX
-- ============================================================
-- Supabase guarda solicitudes, aprobaciones y movimientos.
-- NetBox guarda el inventario real de sites, racks, equipos y RU.
-- Este archivo NO incluye datos de prueba, DELETE, DROP ni resets.

-- ============================================================
-- 1. CATALOGOS BASE
-- ============================================================

CREATE TABLE IF NOT EXISTS tipos_documento (
  id SERIAL PRIMARY KEY,
  nombre TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS niveles_acceso (
  id SERIAL PRIMARY KEY,
  nombre TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS tipos_trabajo (
  id SERIAL PRIMARY KEY,
  nombre TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS empresas (
  id SERIAL PRIMARY KEY,
  nombre TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS areas (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  UNIQUE (empresa_id, nombre)
);

-- ============================================================
-- 2. NODOS
-- ============================================================
-- netbox_site_id conecta cada nodo de Supabase con el site de NetBox.

CREATE TABLE IF NOT EXISTS nodos (
  id SERIAL PRIMARY KEY,
  nombre TEXT UNIQUE NOT NULL,
  requiere_llave BOOLEAN DEFAULT FALSE,
  netbox_site_id INTEGER UNIQUE
);

-- ============================================================
-- 3. ACCESOS
-- ============================================================

CREATE TABLE IF NOT EXISTS accesos (
  id SERIAL PRIMARY KEY,
  nodo_id INTEGER REFERENCES nodos(id),

  fecha_ingreso DATE NOT NULL,
  fecha_salida DATE NOT NULL,
  hora_ingreso TIME NOT NULL,
  hora_salida TIME NOT NULL,

  solicitante_nombre TEXT NOT NULL,
  solicitante_ap_paterno TEXT NOT NULL,
  solicitante_ap_materno TEXT NOT NULL,
  solicitante_tipo_doc_id INTEGER REFERENCES tipos_documento(id),
  solicitante_num_doc TEXT NOT NULL,
  solicitante_telefono TEXT NOT NULL,
  solicitante_correo TEXT NOT NULL,

  nivel_acceso_id INTEGER REFERENCES niveles_acceso(id),
  empresa_id INTEGER REFERENCES empresas(id),
  area_responsable_id INTEGER REFERENCES areas(id),
  area_apoyo_id INTEGER REFERENCES areas(id),
  tipo_trabajo_id INTEGER REFERENCES tipos_trabajo(id),
  detalle_trabajo TEXT,

  trabajo_contrata BOOLEAN DEFAULT FALSE,
  nombre_contrata TEXT,

  sctr_path TEXT[] NOT NULL,
  sctr_filename TEXT[] NOT NULL,
  sctr_size INTEGER[] NOT NULL,

  numero_personal INTEGER NOT NULL CHECK (numero_personal BETWEEN 1 AND 8),

  hora_ingreso_real TIME,
  hora_salida_real TIME,
  estado_acceso TEXT DEFAULT 'PENDIENTE'
    CHECK (estado_acceso IN ('PENDIENTE', 'EN_NODO', 'ATENDIDO', 'CANCELADO')),
  motivo_cancelacion TEXT,

  estado_aprobacion TEXT
    CHECK (estado_aprobacion IN ('APROBADO', 'DENEGADO') OR estado_aprobacion IS NULL),

  created_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT chk_contrata CHECK (
    (trabajo_contrata = FALSE AND nombre_contrata IS NULL)
    OR
    (trabajo_contrata = TRUE AND nombre_contrata IS NOT NULL)
  )
);

-- ============================================================
-- 4. PERSONAL DEL ACCESO
-- ============================================================

CREATE TABLE IF NOT EXISTS personal_acceso (
  id SERIAL PRIMARY KEY,
  acceso_id INTEGER REFERENCES accesos(id) ON DELETE CASCADE,

  nombre TEXT NOT NULL,
  ap_paterno TEXT NOT NULL,
  ap_materno TEXT NOT NULL,
  tipo_doc_id INTEGER REFERENCES tipos_documento(id),
  num_doc TEXT NOT NULL,
  telefono TEXT NOT NULL
);

-- ============================================================
-- 5. MOVIMIENTOS DE EQUIPOS
-- ============================================================
-- El tecnico crea un movimiento PENDIENTE.
-- El admin revisa/edita y recien al aprobar se ejecuta en NetBox.

CREATE TABLE IF NOT EXISTS movimientos (
  id SERIAL PRIMARY KEY,
  acceso_id INTEGER REFERENCES accesos(id) ON DELETE CASCADE,
  tipo_movimiento TEXT NOT NULL,
  estado TEXT DEFAULT 'PENDIENTE'
    CHECK (estado IN ('PENDIENTE', 'APROBADO', 'DENEGADO', 'ERROR')),
  aprobado_por TEXT,
  fecha_aprobacion TIMESTAMP,
  observacion_admin TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS movimiento_detalle (
  id SERIAL PRIMARY KEY,
  movimiento_id INTEGER REFERENCES movimientos(id) ON DELETE CASCADE,

  -- RETIRO, INSTALACION
  -- REEMPLAZO se guarda como dos filas: una RETIRO y una INSTALACION.
  accion TEXT NOT NULL CHECK (accion IN ('RETIRO', 'INSTALACION')),

  -- Datos del equipo existente en NetBox para retiros.
  equipo_netbox_id INTEGER,
  equipo_name TEXT,

  -- Datos del equipo nuevo para instalaciones.
  nuevo_equipo_name TEXT,
  manufacturer_netbox_id INTEGER,
  device_type_netbox_id INTEGER,
  fabricante TEXT,
  modelo TEXT,
  serial TEXT,

  -- Ubicacion propuesta en NetBox.
  rack_netbox_id INTEGER,
  rack_name TEXT,
  ru_inicio INTEGER,
  ru_fin INTEGER,
  cantidad_ru INTEGER DEFAULT 1,

  -- Resultado de ejecucion contra NetBox.
  estado_ejecucion TEXT DEFAULT 'PENDIENTE'
    CHECK (estado_ejecucion IN ('PENDIENTE', 'EJECUTADO', 'ERROR')),
  respuesta_netbox JSONB,

  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 6. LLAVES
-- ============================================================

CREATE TABLE IF NOT EXISTS llaves_nodo (
  id SERIAL PRIMARY KEY,
  nodo_id INTEGER REFERENCES nodos(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  estado TEXT DEFAULT 'DISPONIBLE'
    CHECK (estado IN ('DISPONIBLE', 'OCUPADA')),
  UNIQUE (nodo_id, codigo)
);

CREATE TABLE IF NOT EXISTS prestamos_llave (
  id SERIAL PRIMARY KEY,
  acceso_id INTEGER REFERENCES accesos(id) ON DELETE CASCADE,
  llave_id INTEGER REFERENCES llaves_nodo(id),
  tipo_solicitud TEXT NOT NULL CHECK (tipo_solicitud IN ('RECOJO', 'ENTREGA')),
  nombre_persona TEXT NOT NULL,
  area_id INTEGER REFERENCES areas(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 7. FUNCIONES
-- ============================================================

CREATE OR REPLACE FUNCTION validar_acceso_instalaciones(p_id INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_requiere_llave BOOLEAN;
  v_tipo_trabajo TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM accesos WHERE id = p_id) THEN
    RETURN 'NO_EXISTE';
  END IF;

  SELECT n.requiere_llave, tt.nombre
  INTO v_requiere_llave, v_tipo_trabajo
  FROM accesos a
  JOIN nodos n ON a.nodo_id = n.id
  JOIN tipos_trabajo tt ON a.tipo_trabajo_id = tt.id
  WHERE a.id = p_id;

  IF v_requiere_llave = TRUE
     OR v_tipo_trabajo IN (
       'INSTALACION DE EQUIPOS',
       'RETIRO DE EQUIPOS',
       'REEMPLAZO DE EQUIPOS',
       'INGRESO_FO'
     ) THEN
    RETURN 'AUTORIZADO';
  END IF;

  RETURN 'NO_AUTORIZADO';
END;
$$;

CREATE OR REPLACE FUNCTION validar_numero_personal()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_cantidad_actual INTEGER;
  v_limite INTEGER;
BEGIN
  SELECT numero_personal
  INTO v_limite
  FROM accesos
  WHERE id = NEW.acceso_id;

  SELECT COUNT(*)
  INTO v_cantidad_actual
  FROM personal_acceso
  WHERE acceso_id = NEW.acceso_id;

  IF v_cantidad_actual >= v_limite THEN
    RAISE EXCEPTION 'No se pueden insertar mas personas. Limite permitido: %', v_limite;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_validar_numero_personal ON personal_acceso;
CREATE TRIGGER trigger_validar_numero_personal
BEFORE INSERT ON personal_acceso
FOR EACH ROW
EXECUTE FUNCTION validar_numero_personal();

CREATE OR REPLACE FUNCTION procesar_prestamo_llave()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_estado_actual TEXT;
  v_nodo_acceso INTEGER;
  v_nodo_llave INTEGER;
BEGIN
  SELECT nodo_id
  INTO v_nodo_acceso
  FROM accesos
  WHERE id = NEW.acceso_id;

  SELECT nodo_id, estado
  INTO v_nodo_llave, v_estado_actual
  FROM llaves_nodo
  WHERE id = NEW.llave_id;

  IF v_nodo_acceso <> v_nodo_llave THEN
    RAISE EXCEPTION 'La llave no pertenece al nodo del acceso';
  END IF;

  IF NEW.tipo_solicitud = 'RECOJO' THEN
    IF v_estado_actual = 'OCUPADA' THEN
      RAISE EXCEPTION 'La llave ya esta ocupada';
    END IF;

    UPDATE llaves_nodo
    SET estado = 'OCUPADA'
    WHERE id = NEW.llave_id;
  END IF;

  IF NEW.tipo_solicitud = 'ENTREGA' THEN
    UPDATE llaves_nodo
    SET estado = 'DISPONIBLE'
    WHERE id = NEW.llave_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_prestamo_llave ON prestamos_llave;
CREATE TRIGGER trigger_prestamo_llave
AFTER INSERT ON prestamos_llave
FOR EACH ROW
EXECUTE FUNCTION procesar_prestamo_llave();

-- ============================================================
-- 8. DATOS BASE
-- ============================================================

INSERT INTO tipos_documento (nombre)
VALUES ('DNI'), ('CE')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO niveles_acceso (nombre)
VALUES ('PROGRAMADO'), ('NO PROGRAMADO')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO tipos_trabajo (nombre)
VALUES
  ('INSTALACION DE EQUIPOS'),
  ('RETIRO DE EQUIPOS'),
  ('REEMPLAZO DE EQUIPOS'),
  ('INGRESO_FO'),
  ('MANTENIMIENTO')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO empresas (nombre)
VALUES ('WIN NET'), ('WIN EMPRESAS')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO areas (empresa_id, nombre)
SELECT e.id, v.nombre
FROM empresas e
JOIN (
  VALUES
    ('WIN NET', 'NOC-WIN'),
    ('WIN NET', 'INGENIERIA-WIN'),
    ('WIN EMPRESAS', 'NOC-EMPRESAS'),
    ('WIN EMPRESAS', 'IMPLEMENTACIONES-EMPRESAS')
) AS v(empresa, nombre)
ON v.empresa = e.nombre
ON CONFLICT (empresa_id, nombre) DO NOTHING;

-- Ejemplo: ajusta estos site_id a los reales de NetBox.
INSERT INTO nodos (nombre, requiere_llave, netbox_site_id)
VALUES
  ('200_MILLAS', TRUE, 146),
  ('3_DE_MAYO', TRUE, 125)
ON CONFLICT (nombre) DO NOTHING;

NOTIFY pgrst, 'reload schema';
