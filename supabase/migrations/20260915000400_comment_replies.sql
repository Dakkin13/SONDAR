-- ─────────────────────────────────────────────────────────────────────────────
-- Comment replies and comment likes (Instagram-style threads).
--
-- A reply is a comment with parent_id set to a TOP-LEVEL comment. Replies to
-- a reply are stored under the same top-level parent (one level deep, like
-- Instagram) and the UI prefixes "@name" so context is kept.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.post_comments
  add column if not exists parent_id uuid references public.post_comments(id) on delete cascade;

create index if not exists post_comments_parent_id_idx
  on public.post_comments (parent_id, created_at) where parent_id is not null;

-- ── comment likes ────────────────────────────────────────────────────────────
create table if not exists public.post_comment_likes (
  comment_id uuid not null references public.post_comments(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
alter table public.post_comment_likes enable row level security;

drop policy if exists "post_comment_likes_select_authenticated" on public.post_comment_likes;
create policy "post_comment_likes_select_authenticated" on public.post_comment_likes
  for select to authenticated using (true);
drop policy if exists "post_comment_likes_insert_own" on public.post_comment_likes;
create policy "post_comment_likes_insert_own" on public.post_comment_likes
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "post_comment_likes_delete_own" on public.post_comment_likes;
create policy "post_comment_likes_delete_own" on public.post_comment_likes
  for delete to authenticated using (user_id = auth.uid());
