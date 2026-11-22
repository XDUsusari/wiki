-- Test helpers (local test database only).
create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

create or replace function tests.create_user(p_username text, p_confirmed boolean default true) returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  insert into auth.users(email, email_confirmed_at, raw_user_meta_data)
  values (p_username || '@test.local', case when p_confirmed then now() end,
          jsonb_build_object('username', p_username, 'terms_version', '2026-11', 'locale', 'ca'))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function tests.assert(p_cond boolean, p_msg text) returns void
language plpgsql as $$
begin
  if p_cond is distinct from true then
    raise exception 'ASSERTION FAILED: %', p_msg;
  end if;
  raise notice 'ok - %', p_msg;
end;
$$;

-- Runs p_sql and checks it fails with a message containing p_expected.
create or replace function tests.assert_raises(p_sql text, p_expected text, p_msg text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if position(p_expected in sqlerrm) > 0 then
      raise notice 'ok - % (raised: %)', p_msg, sqlerrm;
      return;
    end if;
    raise exception 'ASSERTION FAILED: % — expected error containing "%", got "%"', p_msg, p_expected, sqlerrm;
  end;
  raise exception 'ASSERTION FAILED: % — expected an error containing "%"', p_msg, p_expected;
end;
$$;

create or replace function tests.count_rows(p_sql text) returns bigint
language plpgsql as $$
declare v bigint;
begin
  execute 'select count(*) from (' || p_sql || ') q' into v;
  return v;
end;
$$;

grant execute on all functions in schema tests to anon, authenticated;

-- Impersonates a user exactly like PostgREST does (role + JWT sub claim).
-- Use "reset role;" to return to the superuser.
create or replace function tests.login(p_user uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), false);
  perform set_config('role', case when p_user is null then 'anon' else 'authenticated' end, false);
end;
$$;
grant execute on function tests.login(uuid) to anon, authenticated;
