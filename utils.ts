import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { TaskStatus } from "./supabase";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bg: string; dot: string }> = {
  not_started: { label: "Not Started", color: "text-gray-600", bg: "bg-gray-100", dot: "bg-gray-400" },
  in_progress: { label: "In Progress", color: "text-blue-700", bg: "bg-blue-100", dot: "bg-blue-500" },
  blocked:     { label: "Blocked",     color: "text-red-700",  bg: "bg-red-100",  dot: "bg-red-500"  },
  in_review:   { label: "In Review",   color: "text-yellow-700", bg: "bg-yellow-100", dot: "bg-yellow-500" },
  completed:   { label: "Completed",   color: "text-green-700", bg: "bg-green-100", dot: "bg-green-500" },
};

export function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function daysBetween(a: string, b: string) {
  return Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}
