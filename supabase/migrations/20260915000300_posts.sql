-- ─────────────────────────────────────────────────────────────────────────────
-- Posts, likes, comments, and band followers.
--
-- A post is written by a person (author_id) and optionally published AS a
-- band (band_id) — any member can post as the band, admins can delete band
-- posts. Anyone signed in can follow a band; people are not followable.
--
-- Bands become public entities here: their name/avatar/bio and roster are
-- readable by any signed-in user (needed for follow buttons, public band
-- pages, and attributing band posts). Band messages stay members-only.
--
-- Apply with: npm run db:push
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Bands and rosters are now publicly readable ──────────────────────────────
drop policy if exists "bands_select_members" on public.bands;
create policy "bands_select_authenticated" on public.bands
  for select to authenticated using (true);

drop policy if exists "band_members_select_members" on public.band_members;
create policy "band_members_select_authenticated" on public.band_members
  for select to authenticated using (true);

-- ── posts ────────────────────────────────────────────────────────────────────
create table if not exists public.posts (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references public.profiles(id) on delete cascade,
  band_id    uuid references public.bands(id) on delete cascade,
  content    text not null default '',
  image_url  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint posts_has_content check (length(btrim(content)) > 0 or image_url is not null)
);
create index if not exists posts_created_at_idx on public.posts (created_at desc);
create index if not exists posts_author_id_idx  on public.posts (author_id, created_at desc);
create index if not exists posts_band_id_idx    on public.posts (band_id, created_at desc) where band_id is not null;

alter table public.posts enable row level security;

drop policy if exists "posts_select_authenticated" on public.posts;
create policy "posts_select_authenticated" on public.posts
  for select to authenticated using (true);

-- You post as yourself, or as a band you belong to.
drop policy if exists "posts_insert_author_or_member" on public.posts;
create policy "posts_insert_author_or_member" on public.posts
  for insert to authenticated with check (
    author_id = auth.uid()
    and (band_id is null or public.is_band_member(band_id))
  );

-- The author, or a band admin for band posts, can edit/delete.
drop policy if exists "posts_update_author_or_admin" on public.posts;
create policy "posts_update_author_or_admin" on public.posts
  for update to authenticated using (
    author_id = auth.uid() or (band_id is not null and public.is_band_admin(band_id))
  );

drop policy if exists "posts_delete_author_or_admin" on public.posts;
create policy "posts_delete_author_or_admin" on public.posts
  for delete to authenticated using (
    author_id = auth.uid() or (band_id is not null and public.is_band_admin(band_id))
  );

-- ── post_likes ───────────────────────────────────────────────────────────────
create table if not exists public.post_likes (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.post_likes enable row level security;

drop policy if exists "post_likes_select_authenticated" on public.post_likes;
create policy "post_likes_select_authenticated" on public.post_likes
  for select to authenticated using (true);
drop policy if exists "post_likes_insert_own" on public.post_likes;
create policy "post_likes_insert_own" on public.post_likes
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "post_likes_delete_own" on public.post_likes;
create policy "post_likes_delete_own" on public.post_likes
  for delete to authenticated using (user_id = auth.uid());

-- ── post_comments ────────────────────────────────────────────────────────────
create table if not exists public.post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  content    text not null check (length(btrim(content)) > 0),
  created_at timestamptz not null default now()
);
create index if not exists post_comments_post_id_idx on public.post_comments (post_id, created_at);
alter table public.post_comments enable row level security;

drop policy if exists "post_comments_select_authenticated" on public.post_comments;
create policy "post_comments_select_authenticated" on public.post_comments
  for select to authenticated using (true);
drop policy if exists "post_comments_insert_own" on public.post_comments;
create policy "post_comments_insert_own" on public.post_comments
  for insert to authenticated with check (author_id = auth.uid());
-- Your own comment, or any comment on a post you own / a band post you admin.
drop policy if exists "post_comments_delete_own_or_post_owner" on public.post_comments;
create policy "post_comments_delete_own_or_post_owner" on public.post_comments
  for delete to authenticated using (
    author_id = auth.uid()
    or exists (
      select 1 from public.posts p
      where p.id = post_id
        and (p.author_id = auth.uid() or (p.band_id is not null and public.is_band_admin(p.band_id)))
    )
  );

-- ── band_followers ───────────────────────────────────────────────────────────
create table if not exists public.band_followers (
  band_id    uuid not null references public.bands(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (band_id, user_id)
);
create index if not exists band_followers_user_id_idx on public.band_followers (user_id);
alter table public.band_followers enable row level security;

drop policy if exists "band_followers_select_authenticated" on public.band_followers;
create policy "band_followers_select_authenticated" on public.band_followers
  for select to authenticated using (true);
drop policy if exists "band_followers_insert_own" on public.band_followers;
create policy "band_followers_insert_own" on public.band_followers
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "band_followers_delete_own" on public.band_followers;
create policy "band_followers_delete_own" on public.band_followers
  for delete to authenticated using (user_id = auth.uid());

-- ── Rate limits (same trigger as messages) ───────────────────────────────────
drop trigger if exists posts_rate_limit on public.posts;
create trigger posts_rate_limit
  before insert on public.posts
  for each row execute function public.enforce_insert_rate_limit(
    'author_id', '10', '1 hour',
    'You have posted a lot recently. Try again in a bit.'
  );

drop trigger if exists post_comments_rate_limit on public.post_comments;
create trigger post_comments_rate_limit
  before insert on public.post_comments
  for each row execute function public.enforce_insert_rate_limit(
    'author_id', '30', '1 minute',
    'You are commenting too quickly. Wait a minute and try again.'
  );
