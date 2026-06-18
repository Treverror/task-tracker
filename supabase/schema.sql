-- ============================================================
-- Task Progression Tracker – Supabase Schema
-- Run this in Supabase SQL Editor (Database → SQL Editor)
-- ============================================================

create extension if not exists "uuid-ossp";

-- ----------------------------------------------------------------
-- PROFILES  (extends Supabase auth.users)
-- ----------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz default now()
);

alter table public.profiles enable row level security;
create policy "Users can view all profiles" on public.profiles for select using (auth.role() = 'authenticated');
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- ----------------------------------------------------------------
-- PROJECTS
-- ----------------------------------------------------------------
create table public.projects (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  description text,
  owner_id    uuid references public.profiles(id) on delete set null,
  start_date  date,
  end_date    date,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table public.projects enable row level security;
create policy "View projects" on public.projects for select using (auth.role() = 'authenticated');
create policy "Create projects" on public.projects for insert with check (auth.role() = 'authenticated');
create policy "Update own projects" on public.projects for update using (auth.uid() = owner_id);
create policy "Delete own projects" on public.projects for delete using (auth.uid() = owner_id);

-- ----------------------------------------------------------------
-- TASKS
-- ----------------------------------------------------------------
create type public.task_status as enum ('not_started','in_progress','blocked','in_review','completed');

create table public.tasks (
  id           uuid primary key default uuid_generate_v4(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  title        text not null,
  description  text,
  status       public.task_status not null default 'not_started',
  progress     integer not null default 0 check (progress between 0 and 100),
  assignee_id  uuid references public.profiles(id) on delete set null,
  start_date   date,
  due_date     date,
  sort_order   integer default 0,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

alter table public.tasks enable row level security;
create policy "View tasks" on public.tasks for select using (auth.role() = 'authenticated');
create policy "Create tasks" on public.tasks for insert with check (auth.role() = 'authenticated');
create policy "Update tasks" on public.tasks for update using (auth.role() = 'authenticated');
create policy "Delete tasks" on public.tasks for delete using (
  auth.uid() = created_by or
  auth.uid() in (select owner_id from public.projects where id = project_id)
);

-- ----------------------------------------------------------------
-- TASK UPDATES (activity log)
-- ----------------------------------------------------------------
create table public.task_updates (
  id            uuid primary key default uuid_generate_v4(),
  task_id       uuid not null references public.tasks(id) on delete cascade,
  author_id     uuid references public.profiles(id) on delete set null,
  comment       text,
  old_status    public.task_status,
  new_status    public.task_status,
  old_progress  integer,
  new_progress  integer,
  created_at    timestamptz default now()
);

alter table public.task_updates enable row level security;
create policy "View updates" on public.task_updates for select using (auth.role() = 'authenticated');
create policy "Add updates" on public.task_updates for insert with check (auth.role() = 'authenticated');

-- ----------------------------------------------------------------
-- FILE ATTACHMENTS
-- ----------------------------------------------------------------
create table public.task_files (
  id            uuid primary key default uuid_generate_v4(),
  task_id       uuid not null references public.tasks(id) on delete cascade,
  uploaded_by   uuid references public.profiles(id) on delete set null,
  file_name     text not null,
  file_path     text not null,
  file_size     bigint,
  mime_type     text,
  created_at    timestamptz default now()
);

alter table public.task_files enable row level security;
create policy "View files" on public.task_files for select using (auth.role() = 'authenticated');
create policy "Upload files" on public.task_files for insert with check (auth.role() = 'authenticated');
create policy "Delete own files" on public.task_files for delete using (auth.uid() = uploaded_by);

-- ----------------------------------------------------------------
-- auto-update updated_at
-- ----------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger set_projects_updated_at before update on public.projects for each row execute procedure public.set_updated_at();
create trigger set_tasks_updated_at before update on public.tasks for each row execute procedure public.set_updated_at();

-- ----------------------------------------------------------------
-- STORAGE BUCKET  (run in Supabase dashboard Storage section)
-- Create a bucket named "task-files" set to private, then run:
-- ----------------------------------------------------------------
-- insert into storage.buckets (id, name, public) values ('task-files', 'task-files', false);
