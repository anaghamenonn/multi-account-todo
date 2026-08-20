"use client";

import { useState } from "react";
import type { Todo, UpdateTodoInput } from "@/types/todo";

interface TodoItemProps {
  todo: Todo;
  isMutating: boolean;
  onUpdate: (id: number, input: UpdateTodoInput) => Promise<boolean>;
  onDelete: (id: number) => Promise<boolean>;
}

export function TodoItem({ todo, isMutating, onUpdate, onDelete }: TodoItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(todo.title);
  const [description, setDescription] = useState(todo.description);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const handleToggleCompleted = () => {
    if (isMutating) return;
    onUpdate(todo.id, { completed: !todo.completed });
  };

  const handleSaveEdit = async () => {
    if (!title.trim() || isMutating) return;
    const ok = await onUpdate(todo.id, { title: title.trim(), description: description.trim() });
    if (ok) setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setTitle(todo.title);
    setDescription(todo.description);
    setIsEditing(false);
  };

  const handleConfirmDelete = async () => {
    const ok = await onDelete(todo.id);
    if (!ok) setConfirmingDelete(false);
  };

  if (isEditing) {
    return (
      <li className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={255}
          disabled={isMutating}
          aria-label="Edit todo title"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={2}
          disabled={isMutating}
          aria-label="Edit todo description"
          className="resize-none rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleCancelEdit}
            disabled={isMutating}
            className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveEdit}
            disabled={isMutating || !title.trim()}
            className="rounded-full bg-zinc-900 px-4 py-1.5 text-sm text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Save
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-start justify-between gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <label className="flex min-w-0 flex-1 items-start gap-3">
        <input
          type="checkbox"
          checked={todo.completed}
          onChange={handleToggleCompleted}
          disabled={isMutating}
          className="mt-1 h-4 w-4 shrink-0"
          aria-label={todo.completed ? "Mark as not completed" : "Mark as completed"}
        />
        <div className="min-w-0">
          <p
            className={`break-words text-sm font-medium ${
              todo.completed ? "text-zinc-400 line-through dark:text-zinc-600" : "text-zinc-900 dark:text-zinc-100"
            }`}
          >
            {todo.title}
          </p>
          {todo.description && (
            <p className="mt-0.5 break-words text-sm text-zinc-500 dark:text-zinc-400">{todo.description}</p>
          )}
        </div>
      </label>

      <div className="flex shrink-0 items-center gap-2">
        {confirmingDelete ? (
          <>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Delete?</span>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={isMutating}
              className="rounded-full bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50"
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              disabled={isMutating}
              className="rounded-full border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              No
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              disabled={isMutating}
              className="rounded-full border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              disabled={isMutating}
              className="rounded-full border border-red-300 px-3 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
            >
              Delete
            </button>
          </>
        )}
      </div>
    </li>
  );
}
