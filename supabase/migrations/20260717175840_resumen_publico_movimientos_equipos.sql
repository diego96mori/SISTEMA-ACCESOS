begin;

-- Actualiza las equivalencias sin cambiar las firmas públicas existentes.
do $migration$
declare
  v_definition text;
  v_function_name text;
begin
  foreach v_function_name in array array[
    'obtener_contexto_equipos',
    'registrar_movimiento_equipos'
  ]
  loop
    select pg_get_functiondef(p.oid)
    into v_definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = v_function_name
    limit 1;

    if v_definition is null then
      raise exception 'No existe la funcion public.%', v_function_name;
    end if;

    v_definition := replace(v_definition, '''INSTALACION DE EQUIPOS''', '''INSTALACIÓN DE EQUIPOS''');
    v_definition := replace(v_definition, '''REEMPLAZO DE EQUIPOS''', '''REEMPLAZO DE EQUIPO''');
    v_definition := replace(
      v_definition,
      'WHEN ''INGRESO_FO'' THEN ''INGRESO_FO''',
      'WHEN ''INGRESO DE F.O.'' THEN ''INGRESO_FO'''
    );
    execute v_definition;
  end loop;
end;
$migration$;

create or replace function public.obtener_resumen_movimiento_equipos(
  p_codigo uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'movimiento_id', m.id,
    'estado', m.estado,
    'tipo_movimiento', m.tipo_movimiento,
    'cantidad_items', m.cantidad_items,
    'detalles', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', d.id,
          'numero_item', d.numero_item,
          'accion', d.accion,
          'equipo', case
            when d.accion = 'RETIRO' then d.equipo_anterior_nombre
            else coalesce(d.nombre_aprobado, d.nombre_propuesto)
          end,
          'condicion', case when d.es_rackeable then 'RACKEABLE' else 'NO_RACKEABLE' end,
          'rack', coalesce(d.rack_aprobado_nombre, d.equipo_anterior_rack_nombre),
          'ru', coalesce(d.ru_inicio_aprobada, d.equipo_anterior_ru_inicio),
          'fabricante', coalesce(d.fabricante, d.equipo_anterior_fabricante),
          'modelo', coalesce(d.modelo, d.equipo_anterior_modelo),
          'estado_ejecucion', d.estado_ejecucion
        )
        order by d.numero_item, d.accion
      ),
      '[]'::jsonb
    )
  )
  from public.accesos a
  join public.tipos_trabajo tt on tt.id = a.tipo_trabajo_id
  join public.movimientos m on m.acceso_id = a.id
  join public.movimiento_detalle d on d.movimiento_id = m.id
  where a.codigo_seguimiento = p_codigo
    and a.estado_aprobacion = 'APROBADO'
    and a.estado_acceso <> 'CANCELADO'
    and tt.gestiona_equipos = true
  group by m.id;
$$;

revoke all on function public.obtener_resumen_movimiento_equipos(uuid)
  from public;
grant execute on function public.obtener_resumen_movimiento_equipos(uuid)
  to anon, authenticated;

commit;
