"use client";

import { useAuth0 } from "@auth0/auth0-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loading } from "@/components/Loading";
import { LogoutButton } from "@/components/LogoutButton";
import { TodoForm } from "@/components/TodoForm";
import { TodoList } from "@/components/TodoList";
import { UserInfo } from "@/components/UserInfo";
import { useTodos } from "@/hooks/useTodos";
import type { TodoStatusFilter } from "@/types/todo";

const FILTERS: { value: TodoStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
];

export default function DashboardPage() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth0();
  const router = useRouter();

  const {
    todos,
    isLoading,
    isMutating,
    error,
    message,
    filter,
    setFilter,
    setSearch,
    createTodo,
    updateTodo,
    deleteTodo,
  } = useTodos();

  const [searchInput, setSearchInput] = useState("");

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthLoading, isAuthenticated, router]);

  // Debounce the search box so every keystroke doesn't trigger a request.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput, setSearch]);

  if (isAuthLoading || !isAuthenticated) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loading />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between gap-4">
        <UserInfo />
        <LogoutButton />
      </header>

      <TodoForm onSubmit={createTodo} isSubmitting={isMutating} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-md border border-zinc-200 p-1 dark:border-zinc-800">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              className={`rounded px-3 py-1 text-sm transition-colors ${
                filter === option.value
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Search by title…"
          aria-label="Search todos by title"
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      {message && (
        <p
          role="status"
          className="rounded-md border border-green-300 bg-green-50 px-4 py-2 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200"
        >
          {message}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          {error}
        </p>
      )}

      {isLoading ? (
        <Loading label="Loading your todos…" />
      ) : (
        <TodoList todos={todos} isMutating={isMutating} onUpdate={updateTodo} onDelete={deleteTodo} />
      )}
    </div>
  );
}
