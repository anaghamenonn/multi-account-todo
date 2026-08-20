"use client";

import { useState, type FormEvent } from "react";
import type { CreateTodoInput } from "@/types/todo";

interface TodoFormProps {
  onSubmit: (input: CreateTodoInput) => Promise<boolean>;
  isSubmitting: boolean;
}

export function TodoForm({ onSubmit, isSubmitting }: TodoFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    // isSubmitting guards against a double-click firing a second POST
    // while the first is still in flight.
    if (isSubmitting || !title.trim()) return;

    const ok = await onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
    });
    if (ok) {
      setTitle("");
      setDescription("");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="What needs doing?"
        maxLength={255}
        disabled={isSubmitting}
        aria-label="Todo title"
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900"
      />
      <textarea
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Description (optional)"
        rows={2}
        disabled={isSubmitting}
        aria-label="Todo description"
        className="resize-none rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900"
      />
      <button
        type="submit"
        disabled={isSubmitting || !title.trim()}
        className="self-end rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {isSubmitting ? "Adding…" : "Add Todo"}
      </button>
    </form>
  );
}
