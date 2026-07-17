begin;

create or replace function public.resolver_solicitud_acceso(
  p_acceso_id bigint,
  p_decision text,
  p_observacion text default null
)
returns public.accesos
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_decision text := upper(btrim(coalesce(p_decision, '')));
  v_observacion text := nullif(btrim(coalesce(p_observacion, '')), '');
  v_acceso public.accesos;
begin
  if auth.uid() is null or not public.es_admin() then
    raise exception 'No autorizado';
  end if;

  if v_decision not in ('APROBADO', 'DENEGADO', 'CANCELADO') then
    raise exception 'La decision debe ser APROBADO, DENEGADO o CANCELADO';
  end if;

  if v_decision in ('DENEGADO', 'CANCELADO') and v_observacion is null then
    raise exception 'Debe indicar el motivo de la denegacion o cancelacion';
  end if;

  select * into v_acceso
  from public.accesos
  where id = p_acceso_id
  for update;

  if not found then
    raise exception 'La solicitud no existe';
  end if;

  if v_acceso.estado_aprobacion <> 'PENDIENTE' then
    raise exception 'La solicitud ya fue resuelta';
  end if;

  update public.accesos
  set
    estado_aprobacion = v_decision,
    estado_acceso = case
      when v_decision in ('DENEGADO', 'CANCELADO') then 'CANCELADO'
      else estado_acceso
    end,
    observacion_aprobacion = v_observacion,
    aprobado_por = auth.uid(),
    fecha_aprobacion = now()
  where id = p_acceso_id
  returning * into v_acceso;

  return v_acceso;
end;
$$;

revoke all on function public.resolver_solicitud_acceso(
  bigint, text, text
) from public;
revoke all on function public.resolver_solicitud_acceso(
  bigint, text, text
) from anon;
grant execute on function public.resolver_solicitud_acceso(
  bigint, text, text
) to authenticated;

commit;
