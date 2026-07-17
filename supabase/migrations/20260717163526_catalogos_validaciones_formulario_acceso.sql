begin;

-- Nombres oficiales de las empresas mostradas en el formulario.
update public.empresas
set nombre = 'WI NET', activo = true
where nombre = 'WIN NET';

update public.empresas
set nombre = 'ON EMPRESAS', activo = true
where nombre = 'WIN EMPRESAS';

insert into public.empresas (nombre, activo)
values ('WI NET', true), ('ON EMPRESAS', true)
on conflict (nombre) do update set activo = excluded.activo;

-- Áreas por empresa. Las anteriores se conservan para el histórico, pero
-- quedan inactivas cuando no pertenecen al catálogo vigente.
with catalogo(empresa_nombre, area_nombre) as (
  values
    ('WI NET', 'CIBERSEGURIDAD-WIN'),
    ('WI NET', 'IMPLEMENTACIONES-WIN'),
    ('WI NET', 'INFRAESTRUCTURA-WIN'),
    ('WI NET', 'INGENIERIA-WIN'),
    ('WI NET', 'MANTENIMIENTO Y EMERGENCIAS PEXT-WIN'),
    ('WI NET', 'NOC-WIN'),
    ('WI NET', 'O&M-WIN'),
    ('WI NET', 'PLANIFICACION DE RED B2C-WIN'),
    ('WI NET', 'PROYECTOS PEXT-WIN'),
    ('ON EMPRESAS', 'CIBERSEGURIDAD-ON EMPRESAS'),
    ('ON EMPRESAS', 'CORE-ON EMPRESAS'),
    ('ON EMPRESAS', 'IMPLEMENTACIONES-ON EMPRESAS'),
    ('ON EMPRESAS', 'INFRAESTRUCTURA-ON EMPRESAS'),
    ('ON EMPRESAS', 'INGENIERIA-ON EMPRESAS'),
    ('ON EMPRESAS', 'NOC-ON EMPRESAS'),
    ('ON EMPRESAS', 'O&M-ON EMPRESAS'),
    ('ON EMPRESAS', 'PEXT-ON EMPRESAS'),
    ('ON EMPRESAS', 'SOS-ON EMPRESAS'),
    ('ON EMPRESAS', 'TAC-ON EMPRESAS')
)
insert into public.areas (empresa_id, nombre, activo)
select e.id, c.area_nombre, true
from catalogo c
join public.empresas e on e.nombre = c.empresa_nombre
on conflict (empresa_id, nombre) do update set activo = excluded.activo;

update public.areas a
set activo = false
from public.empresas e
where e.id = a.empresa_id
  and e.nombre in ('WI NET', 'ON EMPRESAS')
  and (e.nombre, a.nombre) not in (
    ('WI NET', 'CIBERSEGURIDAD-WIN'),
    ('WI NET', 'IMPLEMENTACIONES-WIN'),
    ('WI NET', 'INFRAESTRUCTURA-WIN'),
    ('WI NET', 'INGENIERIA-WIN'),
    ('WI NET', 'MANTENIMIENTO Y EMERGENCIAS PEXT-WIN'),
    ('WI NET', 'NOC-WIN'),
    ('WI NET', 'O&M-WIN'),
    ('WI NET', 'PLANIFICACION DE RED B2C-WIN'),
    ('WI NET', 'PROYECTOS PEXT-WIN'),
    ('ON EMPRESAS', 'CIBERSEGURIDAD-ON EMPRESAS'),
    ('ON EMPRESAS', 'CORE-ON EMPRESAS'),
    ('ON EMPRESAS', 'IMPLEMENTACIONES-ON EMPRESAS'),
    ('ON EMPRESAS', 'INFRAESTRUCTURA-ON EMPRESAS'),
    ('ON EMPRESAS', 'INGENIERIA-ON EMPRESAS'),
    ('ON EMPRESAS', 'NOC-ON EMPRESAS'),
    ('ON EMPRESAS', 'O&M-ON EMPRESAS'),
    ('ON EMPRESAS', 'PEXT-ON EMPRESAS'),
    ('ON EMPRESAS', 'SOS-ON EMPRESAS'),
    ('ON EMPRESAS', 'TAC-ON EMPRESAS')
  );

-- Tipos de trabajo vigentes. gestiona_equipos mantiene el flujo adicional
-- de equipos para las actividades que los manipulan directamente.
with catalogo(nombre, gestiona_equipos) as (
  values
    ('ACONDICIONAMIENTO, ETIQUETADO ODF / LIMPIEZA DE PICTELES', false),
    ('ACTIVACIÓN DE ENLACE', false),
    ('ATENCIÓN DE INCIDENCIA', false),
    ('AUDITORIA DE EQUIPOS WIN', true),
    ('CABLEADO DE F.O.', false),
    ('CAMBIO DE BATERIAS UPS', true),
    ('CAMBIO DE PATCH CORD', false),
    ('CAMBIO DE TARJETA CONTROLADORA EN OLT.', true),
    ('CAMBIO DE TRANSCEIVER', true),
    ('FUSIONES DE F.O.', false),
    ('IMPLEMENTACIÓN DE UN ENLACE', false),
    ('IMPLEMENTACIÓN DE UN NUEVO CIRCUITO', false),
    ('INGRESO DE F.O.', false),
    ('INSTALACIÓN DE EQUIPOS', true),
    ('INSTALACIÓN DE PATCH CORD Y TRANSCEIVER', true),
    ('INSTALACIÓN DE TRANSCEIVER', true),
    ('INVENTARIO DE EQUIPOS', true),
    ('INVENTARIO DE HILOS', false),
    ('JUMPEO DE PATCH CORD', false),
    ('MANTENIMIENTO', false),
    ('MAPEO DE ESPACIO EN RACK WIN Y PATCH CORD', false),
    ('MEDICIONES REFLECTOMÉTRICAS', false),
    ('MEDICIONES REFLECTOMÉTRICAS, INSTALACIÓN DE PATCH CORD Y TRANSCEIVER', true),
    ('REEMPLAZO DE EQUIPO', true),
    ('REEMPLAZO DE TRANCEIVERS', true),
    ('REINICIO DE EQUIPOS', true),
    ('RETIRO DE EQUIPOS', true),
    ('RETIRO DE TRANCEIVERS', true),
    ('ROTULADO', false),
    ('TRABAJOS ELECTRICOS', false),
    ('TROUBLESHOOTING', false),
    ('UPGRADE DE ENLACES', false),
    ('VALIDACIÓN DE ENLACES', false),
    ('VALIDACIÓN DE PUERTO Y JUMPEO', false),
    ('VISITA TÉCNICA', false)
)
insert into public.tipos_trabajo (nombre, gestiona_equipos, activo)
select nombre, gestiona_equipos, true
from catalogo
on conflict (nombre) do update
set gestiona_equipos = excluded.gestiona_equipos,
    activo = excluded.activo;

update public.tipos_trabajo
set activo = false
where nombre not in (
  'ACONDICIONAMIENTO, ETIQUETADO ODF / LIMPIEZA DE PICTELES',
  'ACTIVACIÓN DE ENLACE', 'ATENCIÓN DE INCIDENCIA',
  'AUDITORIA DE EQUIPOS WIN', 'CABLEADO DE F.O.',
  'CAMBIO DE BATERIAS UPS', 'CAMBIO DE PATCH CORD',
  'CAMBIO DE TARJETA CONTROLADORA EN OLT.', 'CAMBIO DE TRANSCEIVER',
  'FUSIONES DE F.O.', 'IMPLEMENTACIÓN DE UN ENLACE',
  'IMPLEMENTACIÓN DE UN NUEVO CIRCUITO', 'INGRESO DE F.O.',
  'INSTALACIÓN DE EQUIPOS', 'INSTALACIÓN DE PATCH CORD Y TRANSCEIVER',
  'INSTALACIÓN DE TRANSCEIVER', 'INVENTARIO DE EQUIPOS',
  'INVENTARIO DE HILOS', 'JUMPEO DE PATCH CORD', 'MANTENIMIENTO',
  'MAPEO DE ESPACIO EN RACK WIN Y PATCH CORD', 'MEDICIONES REFLECTOMÉTRICAS',
  'MEDICIONES REFLECTOMÉTRICAS, INSTALACIÓN DE PATCH CORD Y TRANSCEIVER',
  'REEMPLAZO DE EQUIPO', 'REEMPLAZO DE TRANCEIVERS',
  'REINICIO DE EQUIPOS', 'RETIRO DE EQUIPOS', 'RETIRO DE TRANCEIVERS',
  'ROTULADO', 'TRABAJOS ELECTRICOS', 'TROUBLESHOOTING',
  'UPGRADE DE ENLACES', 'VALIDACIÓN DE ENLACES',
  'VALIDACIÓN DE PUERTO Y JUMPEO', 'VISITA TÉCNICA'
);

-- NOT VALID conserva el único registro histórico que no cumple el formato;
-- la restricción sí se aplica a toda nueva inserción o actualización.
alter table public.accesos
  add constraint accesos_solicitante_nombres_formato_check check (
    btrim(solicitante_nombre) ~ '^[A-ZÁÉÍÓÚÜÑ ]+$'
    and btrim(solicitante_ap_paterno) ~ '^[A-ZÁÉÍÓÚÜÑ ]+$'
    and btrim(solicitante_ap_materno) ~ '^[A-ZÁÉÍÓÚÜÑ ]+$'
  ) not valid,
  add constraint accesos_solicitante_telefono_formato_check
    check (solicitante_telefono ~ '^9[0-9]{8}$') not valid,
  add constraint accesos_solicitante_documento_formato_check
    check (solicitante_num_doc ~ '^[0-9]{8}$') not valid,
  add constraint accesos_solicitante_correo_formato_check
    check (solicitante_correo !~ '[[:space:]]' and solicitante_correo ~ '^[^@]+@[^@]+$') not valid,
  add constraint accesos_detalle_longitud_check
    check (char_length(coalesce(detalle_trabajo, '')) <= 400) not valid;

alter table public.personal_acceso
  add constraint personal_acceso_nombres_formato_check check (
    btrim(nombre) ~ '^[A-ZÁÉÍÓÚÜÑ ]+$'
    and btrim(ap_paterno) ~ '^[A-ZÁÉÍÓÚÜÑ ]+$'
    and btrim(ap_materno) ~ '^[A-ZÁÉÍÓÚÜÑ ]+$'
  ) not valid,
  add constraint personal_acceso_telefono_formato_check
    check (telefono ~ '^9[0-9]{8}$') not valid,
  add constraint personal_acceso_documento_formato_check
    check (num_doc ~ '^[0-9]{8}$') not valid;

-- Impide combinar áreas de otra empresa, incluso si se omite el formulario.
create or replace function public.validar_areas_empresa_acceso()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.areas
    where id = new.area_responsable_id
      and empresa_id = new.empresa_id
      and activo = true
  ) then
    raise exception 'El area responsable no corresponde a la empresa seleccionada.';
  end if;

  if new.area_apoyo_id is not null and not exists (
    select 1 from public.areas
    where id = new.area_apoyo_id
      and empresa_id = new.empresa_id
      and activo = true
  ) then
    raise exception 'El area de apoyo no corresponde a la empresa seleccionada.';
  end if;

  return new;
end;
$$;

revoke all on function public.validar_areas_empresa_acceso() from public;

drop trigger if exists accesos_validar_areas_empresa_trigger on public.accesos;
create trigger accesos_validar_areas_empresa_trigger
before insert or update of empresa_id, area_responsable_id, area_apoyo_id
on public.accesos
for each row execute function public.validar_areas_empresa_acceso();

commit;
