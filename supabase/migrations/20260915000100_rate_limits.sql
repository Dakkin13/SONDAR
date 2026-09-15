-- ─────────────────────────────────────────────────────────────────────────────
-- Server-side rate limiting for user-generated inserts.
--
-- Until now the only throttle was a 1.5 s timestamp check in the browser,
-- which anyone can bypass by calling the REST API directly. This enforces
-- limits in the database with BEFORE INSERT triggers, so they hold no matter
-- how the row arrives.
--
-- One generic trigger function; each table gets a trigger that passes
--   TG_ARGV[0] = column holding the acting user's id
--   TG_ARGV[1] = max rows allowed in the window
--   TG_ARGV[2] = window, as an interval literal
--   TG_ARGV[3] = message shown to the user when the limit is hit
--
-- The row count is scoped by that user column, which RLS already forces to
-- equal auth.uid() for client inserts. service_role (dashboard / admin
-- scripts) is exempt so bulk maintenance is never blocked.
--
-- Apply with: npm run db:push
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.enforce_insert_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_col text     := tg_argv[0];
  v_limit    integer  := tg_argv[1]::integer;
  v_window   interval := tg_argv[2]::interval;
  v_message  text     := tg_argv[3];
  v_user_id  uuid;
  v_count    integer;
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  v_user_id := (to_jsonb(new) ->> v_user_col)::uuid;
  if v_user_id is null then
    return new;
  end if;

  execute format(
    'select count(*) from %I.%I where %I = $1 and created_at > now() - $2',
    tg_table_schema, tg_table_name, v_user_col
  )
  into v_count
  using v_user_id, v_window;

  if v_count >= v_limit then
    raise exception using
      message = v_message,
      hint    = 'rate_limited',
      errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- ── messages (1:1 DMs): 30 per minute per sender ─────────────────────────────
drop trigger if exists messages_rate_limit on public.messages;
create trigger messages_rate_limit
  before insert on public.messages
  for each row execute function public.enforce_insert_rate_limit(
    'from_id', '30', '1 minute',
    'You are sending messages too quickly. Wait a minute and try again.'
  );

-- ── band_messages (group chat): 30 per minute per sender ─────────────────────
drop trigger if exists band_messages_rate_limit on public.band_messages;
create trigger band_messages_rate_limit
  before insert on public.band_messages
  for each row execute function public.enforce_insert_rate_limit(
    'from_id', '30', '1 minute',
    'You are sending messages too quickly. Wait a minute and try again.'
  );

-- ── bands: 5 created per hour per user ───────────────────────────────────────
drop trigger if exists bands_rate_limit on public.bands;
create trigger bands_rate_limit
  before insert on public.bands
  for each row execute function public.enforce_insert_rate_limit(
    'created_by', '5', '1 hour',
    'You have created too many bands recently. Try again in an hour.'
  );

-- ── band_join_requests: 20 invites per hour per inviter ──────────────────────
drop trigger if exists band_join_requests_rate_limit on public.band_join_requests;
create trigger band_join_requests_rate_limit
  before insert on public.band_join_requests
  for each row execute function public.enforce_insert_rate_limit(
    'invited_by', '20', '1 hour',
    'You have sent too many invites recently. Try again in an hour.'
  );
