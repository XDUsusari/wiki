-- Millores d'accés: obligar a canviar la contrasenya (comptes creats per un admin, com «root»)

alter table public.profiles
  add column must_change_password boolean not null default false;

-- L'usuari pot llegir aquest camp del seu perfil, però no modificar-lo
-- (només el servidor el posa a false després d'un canvi de contrasenya real).
grant select (must_change_password) on public.profiles to authenticated;
