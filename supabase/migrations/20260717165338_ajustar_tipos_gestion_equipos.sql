begin;

-- El formulario de equipos debe abrirse únicamente para estos cuatro tipos.
update public.tipos_trabajo
set gestiona_equipos = nombre in (
  'INSTALACIÓN DE EQUIPOS',
  'INGRESO DE F.O.',
  'REEMPLAZO DE EQUIPO',
  'RETIRO DE EQUIPOS'
);

commit;
