-- ─────────────────────────────────────────────────────────────────────────────
-- Chat features: replies, emoji reactions, image messages, edit/delete.
--
-- Adds the same five columns to both message tables, migrates the legacy
-- liked_by likes into the new reactions map as ❤️ (liked_by is kept for now
-- and can be dropped in a later migration once nothing reads it), and adds a
-- BEFORE UPDATE trigger that enforces what RLS alone can't express:
--   • only the sender can edit content or delete a message
--   • edits are only allowed within 15 minutes of sending
--   • deleting blanks the content, drops the image and reactions server-side
--   • identity columns (from_id, created_at, reply_to, image_url) are immutable
-- Recipients can still update read_at / read_by and reactions, which the
-- existing UPDATE policies permit.
--
-- Apply with: npm run db:push
-- ─────────────────────────────────────────────────────────────────────────────

-- ── messages ─────────────────────────────────────────────────────────────────
alter table public.messages add column if not exists reply_to   uuid references public.messages(id) on delete set null;
alter table public.messages add column if not exists reactions  jsonb not null default '{}'::jsonb;
alter table public.messages add column if not exists image_url  text;
alter table public.messages add column if not exists deleted_at timestamptz;
alter table public.messages add column if not exists edited_at  timestamptz;

-- ── band_messages ────────────────────────────────────────────────────────────
alter table public.band_messages add column if not exists reply_to   uuid references public.band_messages(id) on delete set null;
alter table public.band_messages add column if not exists reactions  jsonb not null default '{}'::jsonb;
alter table public.band_messages add column if not exists image_url  text;
alter table public.band_messages add column if not exists deleted_at timestamptz;
alter table public.band_messages add column if not exists edited_at  timestamptz;

-- ── Migrate existing likes → ❤️ reactions (idempotent: only touches rows whose
--    reactions map is still empty) ─────────────────────────────────────────────
update public.messages
   set reactions = jsonb_build_object('❤️', to_jsonb(liked_by))
 where reactions = '{}'::jsonb
   and coalesce(array_length(liked_by, 1), 0) > 0;

update public.band_messages
   set reactions = jsonb_build_object('❤️', to_jsonb(liked_by))
 where reactions = '{}'::jsonb
   and coalesce(array_length(liked_by, 1), 0) > 0;

-- ── Edit / delete rules ──────────────────────────────────────────────────────
create or replace function public.enforce_message_edit_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_admin boolean := coalesce(auth.role(), '') = 'service_role';
  is_sender boolean := auth.uid() = old.from_id;
begin
  -- Identity columns never change (checked against what the client sent,
  -- before this trigger mutates anything below).
  if new.id <> old.id
     or new.from_id <> old.from_id
     or new.created_at <> old.created_at
     or new.reply_to is distinct from old.reply_to
     or new.image_url is distinct from old.image_url then
    raise exception 'Message identity fields cannot be changed' using errcode = 'P0001';
  end if;

  -- Only the sender may change the text, edit-stamp, or delete.
  if (new.content <> old.content
      or new.edited_at is distinct from old.edited_at
      or new.deleted_at is distinct from old.deleted_at)
     and not is_admin and not is_sender then
    raise exception 'Only the sender can edit or delete a message' using errcode = 'P0001';
  end if;

  -- A deleted message is frozen.
  if old.deleted_at is not null and new.deleted_at is not null
     and (new.content <> old.content or new.reactions <> old.reactions) then
    raise exception 'This message was deleted' using errcode = 'P0001';
  end if;

  -- Edits: 15-minute window, server stamps edited_at.
  if new.content <> old.content and new.deleted_at is null then
    if not is_admin and old.created_at < now() - interval '15 minutes' then
      raise exception 'Messages can only be edited within 15 minutes of sending' using errcode = 'P0001';
    end if;
    new.edited_at := now();
  end if;

  -- Deletion: blank everything server-side so the client can't keep a copy alive.
  if new.deleted_at is not null and old.deleted_at is null then
    new.content   := '';
    new.image_url := null;
    new.reactions := '{}'::jsonb;
  end if;

  return new;
end;
$$;

drop trigger if exists messages_edit_rules on public.messages;
create trigger messages_edit_rules
  before update on public.messages
  for each row execute function public.enforce_message_edit_rules();

drop trigger if exists band_messages_edit_rules on public.band_messages;
create trigger band_messages_edit_rules
  before update on public.band_messages
  for each row execute function public.enforce_message_edit_rules();
