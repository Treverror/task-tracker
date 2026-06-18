import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export type TaskStatus = "not_started" | "in_progress" | "blocked" | "in_review" | "completed";

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  owner_id: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  progress: number;
  assignee_id: string | null;
  start_date: string | null;
  due_date: string | null;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  assignee?: Profile | null;
}

export interface TaskUpdate {
  id: string;
  task_id: string;
  author_id: string | null;
  comment: string | null;
  old_status: TaskStatus | null;
  new_status: TaskStatus | null;
  old_progress: number | null;
  new_progress: number | null;
  created_at: string;
  author?: Profile | null;
}

export interface TaskFile {
  id: string;
  task_id: string;
  uploaded_by: string | null;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}
