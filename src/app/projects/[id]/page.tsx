"use client";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import type { Task, TaskStatus, TaskUpdate, TaskFile, Project } from "@/lib/supabase";
import { STATUS_CONFIG, formatDate, cn } from "@/lib/utils";
import Link from "next/link";

const STATUSES: TaskStatus[] = ["not_started", "in_progress", "blocked", "in_review", "completed"];

export default function ProjectPage({ params }: { params: { id: string } }) {
  const [project, setProject]       = useState<Project | null>(null);
  const [tasks, setTasks]           = useState<Task[]>([]);
  const [loading, setLoading]       = useState(true);
  const [view, setView]             = useState<"board" | "timeline">("board");
  const [selectedTask, setSelected] = useState<Task | null>(null);
  const [updates, setUpdates]       = useState<TaskUpdate[]>([]);
  const [files, setFiles]           = useState<TaskFile[]>([]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [userId, setUserId]         = useState<string | null>(null);

  // Task form state
  const [title, setTitle]       = useState("");
  const [desc, setDesc]         = useState("");
  const [startD, setStartD]     = useState("");
  const [dueD, setDueD]         = useState("");
  const [saving, setSaving]     = useState(false);

  // Update form state
  const [comment, setComment]   = useState("");
  const [newStatus, setNewStatus] = useState<TaskStatus | "">("");
  const [newProgress, setNewProgress] = useState<number | "">("");
  const [submitting, setSubmitting] = useState(false);

  const supabase = createClient();

  const loadProject = useCallback(async () => {
    const { data } = await supabase.from("projects").select("*").eq("id", params.id).single();
    setProject(data);
  }, [params.id]);

  const loadTasks = useCallback(async () => {
    const { data } = await supabase
      .from("tasks")
      .select("*, assignee:profiles!tasks_assignee_id_fkey(id,full_name,avatar_url)")
      .eq("project_id", params.id)
      .order("sort_order", { ascending: true });
    setTasks(data ?? []);
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    loadProject();
    loadTasks();
  }, [loadProject, loadTasks]);

  async function loadTaskDetail(task: Task) {
    setSelected(task);
    const [{ data: upd }, { data: fil }] = await Promise.all([
      supabase.from("task_updates")
        .select("*, author:profiles!task_updates_author_id_fkey(id,full_name,avatar_url)")
        .eq("task_id", task.id).order("created_at", { ascending: false }),
      supabase.from("task_files").select("*").eq("task_id", task.id).order("created_at", { ascending: false }),
    ]);
    setUpdates(upd ?? []);
    setFiles(fil ?? []);
    setNewStatus(task.status);
    setNewProgress(task.progress);
    setComment("");
  }

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await supabase.from("tasks").insert({
      project_id: params.id, title, description: desc || null,
      start_date: startD || null, due_date: dueD || null,
      created_by: userId,
    });
    setTitle(""); setDesc(""); setStartD(""); setDueD("");
    setShowTaskForm(false);
    setSaving(false);
    loadTasks();
  }

  async function submitUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTask || (!comment && !newStatus && newProgress === "")) return;
    setSubmitting(true);

    const updates: Record<string, unknown> = {};
    const taskUpdate: Record<string, unknown> = {
      task_id: selectedTask.id, author_id: userId, comment: comment || null,
    };

    if (newStatus && newStatus !== selectedTask.status) {
      updates.status = newStatus;
      taskUpdate.old_status = selectedTask.status;
      taskUpdate.new_status = newStatus;
    }
    if (newProgress !== "" && newProgress !== selectedTask.progress) {
      updates.progress = newProgress;
      taskUpdate.old_progress = selectedTask.progress;
      taskUpdate.new_progress = newProgress;
    }

    await Promise.all([
      Object.keys(updates).length > 0
        ? supabase.from("tasks").update(updates).eq("id", selectedTask.id)
        : Promise.resolve(),
      supabase.from("task_updates").insert(taskUpdate),
    ]);

    setSubmitting(false);
    setComment("");
    await loadTasks();
    const refreshed = (await supabase.from("tasks")
      .select("*, assignee:profiles!tasks_assignee_id_fkey(id,full_name,avatar_url)")
      .eq("id", selectedTask.id).single()).data;
    if (refreshed) loadTaskDetail(refreshed);
  }

  async function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    if (!selectedTask || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    const path = `${userId}/${selectedTask.id}/${Date.now()}_${file.name}`;
    await supabase.storage.from("task-files").upload(path, file);
    await supabase.from("task_files").insert({
      task_id: selectedTask.id, uploaded_by: userId,
      file_name: file.name, file_path: path,
      file_size: file.size, mime_type: file.type,
    });
    const { data: fil } = await supabase.from("task_files").select("*")
      .eq("task_id", selectedTask.id).order("created_at", { ascending: false });
    setFiles(fil ?? []);
    e.target.value = "";
  }

  async function getFileUrl(path: string) {
    const { data } = await supabase.storage.from("task-files").createSignedUrl(path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  const tasksByStatus = STATUSES.reduce((acc, s) => {
    acc[s] = tasks.filter(t => t.status === s);
    return acc;
  }, {} as Record<TaskStatus, Task[]>);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <nav className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-4 sticky top-0 z-10">
        <Link href="/dashboard" className="text-slate-400 hover:text-slate-700 text-sm">← Projects</Link>
        <span className="text-slate-300">/</span>
        <span className="font-semibold text-slate-800">{project?.name ?? "Loading…"}</span>
        <div className="ml-auto flex gap-2">
          {(["board", "timeline"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={cn("px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                view === v ? "bg-indigo-100 text-indigo-700" : "text-slate-500 hover:bw-slate-100")}>
              {v === "board" ? "📋 Board" : "📅 Timeline"}
            </button>
          ))}
          <button onClick={() => setShowTaskForm(true)}
            className="ml-2 px-3 py-1.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700">
            + Task
          </button>
        </div>
      </nav>

      {/* New task modal */}
      {showTaskForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">New Task</h2>
            <form onSubmit={createTask} className="space-y-3">
              <input required value={title} onChange={e => setTitle(e.target.value)} placeholder="Task title"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description" rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Start date</label>
                  <input type="date" value={startD} onChange={e => setStartD(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Due date</label>
                  <input type="date" value={dueD} onChange={e => setDueD(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowTaskForm(false)}
                  className="flex-1 py-2 border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                  {saving ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="px-6 py-6">
        {loading ? (
          <div className="text-center py-20 text-slate-400">Loading tasks…</div>
        ) : view === "board" ? (
          /* KANBAN BOARD */
          <div className="flex gap-4 overflow-x-auto pb-4">
            {STATUSES.map(status => {
              const cfg = STATUS_CONFIG[status];
              const col = tasksByStatus[status];
              return (
                <div key={status} className="flex-shrink-0 w-72">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={cn("w-2 h-2 rounded-full", cfg.dot)} />
                    <span className="text-sm font-semibold text-slate-700">{cfg.label}</span>
                    <span className="ml-auto text-xs text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">{col.length}</span>
                  </div>
                  <div className="space-y-2">
                    {col.map(task => (
                      <button key={task.id} onClick={() => loadTaskDetail(task)}
                        className="w-full text-left bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md hover:border-indigo-200 transition-all">
                        <p className="font-medium text-slate-800 text-sm">{task.title}</p>
                        {task.description && (
                          <p className="text-slate-400 text-xs mt-1 line-clamp-2">{task.description}</p>
                        )}
                        {/* Progress bar */}
                        <div className="mt-3">
                          <div className="flex justify-between text-xs text-slate-400 mb-1">
                            <span>Progress</span><span>{task.progress}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full transition-all"
                              style={{ width: `${task.progress}%` }} />
                          </div>
                        </div>
                        {task.due_date && (
                          <p className="text-xs text-slate-400 mt-2">Due {formatDate(task.due_date)}</p>
                        )}
                        {task.assignee && (
                          <div className="mt-2 flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-xs text-indigo-700 font-medium">
                              {(task.assignee.full_name ?? "?")[0].toUpperCase()}
                            </div>
                            <span className="text-xs text-slate-400">{task.assignee.full_name}</span>
                          </div>
                        )}
                      </button>
                    ))}
                    {col.length === 0 && (
                      <div className="text-center py-6 text-slate-300 text-xs border-2 border-dashed border-slate-200 rounded-xl">
                        No tasks
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* GANTT TIMELINE */
          <GanttView tasks={tasks} project={project} onTaskClick={loadTaskDetail} />
        )}
      </div>

      {/* Task detail panel */}
      {selectedTask && (
        <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-white shadow-2xl border-l border-slate-200 z-40 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <div>
              <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", STATUS_CONFIG[selectedTask.status].bg, STATUS_CONFIG[selectedTask.status].color)}>
                {STATUS_CONFIG[selectedTask.status].label}
              </span>
            </div>
            <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{selectedTask.title}</h2>
              {selectedTask.description && <p className="text-slate-500 text-sm mt-1">{selectedTask.description}</p>}
            </div>

            {/* Progress */}
            <div>
              <div className="flex justify-between text-sm text-slate-600 mb-2">
                <span className="font-medium">Progress</span>
                <span className="font-bold text-indigo-600">{selectedTask.progress}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${selectedTask.progress}%` }} />
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-slate-400 text-xs mb-1">Start</p>
                <p className="font-medium text-slate-700">{formatDate(selectedTask.start_date)}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-slate-400 text-xs mb-1">Due</p>
                <p className="font-medium text-slate-700">{formatDate(selectedTask.due_date)}</p>
              </div>
            </div>

            {/* Post update form */}
            <div className="border border-slate-200 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Post Update</h3>
              <form onSubmit={submitUpdate} className="space-y-3">
                <textarea value={comment} onChange={e => setComment(e.target.value)}
                  placeholder="Add a comment or note…" rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Update status</label>
                    <select value={newStatus} onChange={e => setNewStatus(e.target.value as TaskStatus)}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none">
                      {STATUSES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Progress %</label>
                    <input type="number" min={0} max={100} value={newProgress}
                      onChange={e => setNewProgress(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none" />
                  </div>
                </div>
                <button type="submit" disabled={submitting}
                  className="w-full py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                  {submitting ? "Posting…" : "Post Update"}
                </button>
              </form>
            </div>

            {/* File upload */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Attachments</h3>
              <label className="flex items-center gap-2 px-3 py-2 border-2 border-dashed border-slate-300 rounded-lg text-sm text-slate-500 cursor-pointer hover:border-indigo-400 hover:text-indigo-600 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Upload file
                <input type="file" className="hidden" onChange={uploadFile} />
              </label>
              {files.length > 0 && (
                <div className="mt-2 space-y-1">
                  {files.map(f => (
                    <button key={f.id} onClick={() => getFileUrl(f.file_path)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 text-left">
                      <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      <span className="text-sm text-slate-700 truncate">{f.file_name}</span>
                      <span className="text-xs text-slate-400 ml-auto flex-shrink-0">
                        {f.file_size ? `${Math.round(f.file_size / 1024)}KB` : ""}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Activity log */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Activity</h3>
              {updates.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-4">No updates yet</p>
              ) : (
                <div className="space-y-3">
                  {updates.map(u => (
                    <div key={u.id} className="flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-600 font-medium flex-shrink-0 mt-0.5">
                        {(u.author?.full_name ?? "?")[0].toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-slate-700">{u.author?.full_name ?? "Someone"}</span>
                          <span className="text-xs text-slate-400">
                            {new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        {u.comment && <p className="text-sm text-slate-600">{u.comment}</p>}
                        {u.new_status && u.new_status !== u.old_status && (
                          <p className="text-xs text-slate-400 mt-1">
                            Status: <span className={STATUS_CONFIG[u.old_status!]?.color}>{STATUS_CONFIG[u.old_status!]?.label}</span>
                            {" → "}
                            <span className={STATUS_CONFIG[u.new_status].color}>{STATUS_CONFIG[u.new_status].label}</span>
                          </p>
                        )}
                        {u.new_progress !== null && u.new_progress !== u.old_progress && (
                          <p className="text-xs text-slate-400 mt-0.5">
                            Progress: {u.old_progress}% → {u.new_progress}%
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------
// Gantt / Timeline view
// ----------------------------------------------------------------
function GanttView({ tasks, project, onTaskClick }: {
  tasks: Task[];
  project: Project | null;
  onTaskClick: (t: Task) => void;
}) {
  const tasksWithDates = tasks.filter(t => t.start_date && t.due_date);
  if (tasksWithDates.length === 0) return (
    <div className="text-center py-20 text-slate-400">
      <p>No tasks with dates yet.</p>
      <p className="text-sm mt-1">Add start and due dates to tasks to see them on the timeline.</p>
    </div>
  );

  const allDates = tasksWithDates.flatMap(t => [new Date(t.start_date!), new Date(t.due_date!)]);
  const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
  minDate.setDate(minDate.getDate() - 2);
  maxDate.setDate(maxDate.getDate() + 2);

  const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / 86400000);
  const DAY_W = 36;
  const totalWidth = totalDays * DAY_W;

  const days: Date[] = [];
  for (let i = 0; i <= totalDays; i++) {
    const d = new Date(minDate);
    d.setDate(d.getDate() + i);
    days.push(d);
  }

  function left(dateStr: string) {
    return Math.floor((new Date(dateStr).getTime() - minDate.getTime()) / 86400000) * DAY_W;
  }
  function width(start: string, end: string) {
    return Math.max(DAY_W, Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000) * DAY_W);
  }

  const today = new Date();
  const todayLeft = Math.floor((today.getTime() - minDate.getTime()) / 86400000) * DAY_W;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="gantt-scroll" style={{ minHeight: 200 }}>
        <div style={{ width: totalWidth + 220, minWidth: "100%" }}>
          {/* Header */}
          <div className="flex border-b border-slate-200 sticky top-0 bg-white z-10">
            <div className="w-52 flex-shrink-0 px-4 py-3 text-xs font-semibold text-slate-500 border-r border-slate-200">TASK</div>
            <div className="flex relative" style={{ width: totalWidth }}>
              {days.filter((_, i) => i % 7 === 0).map((d, i) => (
                <div key={i} className="absolute text-xs text-slate-400 py-3 px-1"
                  style={{ left: i * 7 * DAY_W }}>
                  {d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </div>
              ))}
            </div>
          </div>

          {/* Rows */}
          {tasksWithDates.map(task => {
            const cfg = STATUS_CONFIG[task.status];
            const bar = {
              left: left(task.start_date!),
              width: width(task.start_date!, task.due_date!),
            };
            return (
              <div key={task.id} className="flex items-center border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                onClick={() => onTaskClick(task)}>
                <div className="w-52 flex-shrink-0 px-4 py-3 border-r border-slate-100">
                  <p className="text-sm font-medium text-slate-700 truncate">{task.title}</p>
                  <span className={cn("text-xs px-1.5 py-0.5 rounded-full mt-0.5 inline-block", cfg.bg, cfg.color)}>
                    {cfg.label}
                  </span>
                </div>
                <div className="relative flex-1 py-3" style={{ width: totalWidth, height: 56 }}>
                  {/* today line */}
                  {todayLeft >= 0 && todayLeft <= totalWidth && (
                    <div className="absolute top-0 bottom-0 w-px bg-red-400 opacity-50 z-10"
                      style={{ left: todayLeft }} />
                  )}
                  {/* bar */}
                  <div className="absolute top-3 h-7 rounded-lg flex items-center px-2 overflow-hidden"
                    style={{
                      left: bar.left,
                      width: bar.width,
                      backgroundColor: task.status === "completed" ? "#22c55e"
                        : task.status === "blocked" ? "#ef4444"
                        : task.status === "in_review" ? "#eab308"
                        : task.status === "in_progress" ? "#6366f1"
                        : "#94a3b8",
                    }}>
                    {/* progress fill */}
                    <div className="absolute inset-y-0 left-0 opacity-30 rounded-lg"
                      style={{ width: `${task.progress}%`, backgroundColor: "white" }} />
                    <span className="text-white text-xs font-medium truncate relative z-10">{task.title}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
