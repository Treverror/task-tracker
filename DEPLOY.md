# Deploy Task Tracker — Step-by-Step

## What you're building
A private team task tracker with kanban board, Gantt timeline, file uploads, and activity logs.
Stack: Next.js → GitHub → Vercel (frontend) + Supabase (database + auth + storage)

---

## Step 1 — Supabase setup (~10 min)

1. Go to https://supabase.com → New project (pick a name + region)
2. Once created, go to **SQL Editor** → paste the entire contents of `supabase/schema.sql` → Run
3. Go to **Storage** → Create bucket → Name it `task-files` → Set to **Private**
4. Then in SQL Editor run these storage policies:
   ```sql
   create policy "Auth upload" on storage.objects for insert with check (bucket_id = 'task-files' and auth.role() = 'authenticated');
   create policy "Auth read"   on storage.objects for select using (bucket_id = 'task-files' and auth.role() = 'authenticated');
   create policy "Own delete"  on storage.objects for delete using (bucket_id = 'task-files' and auth.uid()::text = (storage.foldername(name))[1]);
   ```
5. Go to **Project Settings → API** and copy:
   - `Project URL`  → this is your `NEXT_PUBLIC_SUPABASE_URL`
   - `anon/public` key → this is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. Under **Authentication → URL Configuration**, set Site URL to your Vercel URL (you can update this after deploy)

---

## Step 2 — Push to GitHub (~5 min)

```bash
# In the task-tracker folder:
git init
git add .
git commit -m "Initial commit"

# Create a new repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/task-tracker.git
git push -u origin main
```

---

## Step 3 — Deploy to Vercel (~5 min)

1. Go to https://vercel.com → New Project → Import your GitHub repo
2. Framework: **Next.js** (auto-detected)
3. Add Environment Variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL       = https://xxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY  = your-anon-key
   ```
4. Click **Deploy**
5. Copy your Vercel URL (e.g. `https://task-tracker-abc.vercel.app`)
6. Back in Supabase → Authentication → URL Configuration → update Site URL to your Vercel URL
   Also add it to **Redirect URLs**: `https://task-tracker-abc.vercel.app/auth/callback`

---

## Step 4 — Local development (optional)

```bash
cd task-tracker
cp .env.local.example .env.local
# Fill in your Supabase values in .env.local

npm install
npm run dev
# Open http://localhost:3000
```

---

## How to use

1. Open your Vercel URL → Sign up with your email
2. Check email for confirmation link → Click it → You're in
3. Create a project → Add tasks with dates
4. Switch between **Board** (kanban) and **Timeline** (Gantt) views
5. Click any task to open the detail panel → post updates, change status/progress, upload files
6. Invite teammates: they sign up at the same URL and immediately see all projects

---

## Future enhancements (ask Claude Code to add these)

- Assign teammates to tasks from a dropdown
- Email notifications on task updates
- Drag-and-drop reordering on the kanban board
- Project-level permissions (restrict who can edit)
- CSV/PDF export of task status
