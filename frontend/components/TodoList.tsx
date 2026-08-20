import type { Todo, UpdateTodoInput } from "@/types/todo";
import { TodoItem } from "./TodoItem";

interface TodoListProps {
  todos: Todo[];
  isMutating: boolean;
  onUpdate: (id: number, input: UpdateTodoInput) => Promise<boolean>;
  onDelete: (id: number) => Promise<boolean>;
}

export function TodoList({ todos, isMutating, onUpdate, onDelete }: TodoListProps) {
  if (todos.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 px-4 py-12 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
        No todos yet. Add your first one above.
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {todos.map((todo) => (
        <TodoItem key={todo.id} todo={todo} isMutating={isMutating} onUpdate={onUpdate} onDelete={onDelete} />
      ))}
    </ul>
  );
}
