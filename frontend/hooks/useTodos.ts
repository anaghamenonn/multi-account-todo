"use client";

import { useAuth0 } from "@auth0/auth0-react";
import { useCallback, useEffect, useState } from "react";
import { ApiError, todosApi } from "@/lib/api";
import type {
  CreateTodoInput,
  Todo,
  TodoStatusFilter,
  UpdateTodoInput,
} from "@/types/todo";

interface UseTodosResult {
  todos: Todo[];
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  message: string | null;
  filter: TodoStatusFilter;
  setFilter: (filter: TodoStatusFilter) => void;
  search: string;
  setSearch: (search: string) => void;
  createTodo: (input: CreateTodoInput) => Promise<boolean>;
  updateTodo: (id: number, input: UpdateTodoInput) => Promise<boolean>;
  deleteTodo: (id: number) => Promise<boolean>;
}

/** Loads and mutates the authenticated account's todos.
 *
 * Every call attaches a fresh Auth0 access token and scopes entirely to
 * whatever the Django API returns for that token - there is no client-side
 * filtering by user, because the server never returns another account's
 * todos in the first place.
 */
export function useTodos(): UseTodosResult {
  const { getAccessTokenSilently, loginWithRedirect } = useAuth0();

  const [todos, setTodos] = useState<Todo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<TodoStatusFilter>("all");
  const [search, setSearch] = useState("");

  // Returns true if the error was an expired/invalid session and has been handled.
  const handleAuthError = useCallback(
    async (err: unknown): Promise<boolean> => {
      if (err instanceof ApiError && err.status === 401) {
        setError("Your session has expired. Please log in again.");
        await loginWithRedirect();
        return true;
      }
      return false;
    },
    [loginWithRedirect],
  );

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = await getAccessTokenSilently();
      const page = await todosApi.list(token, { status: filter, search: search || undefined });
      setTodos(page.results);
    } catch (err) {
      if (!(await handleAuthError(err))) {
        setError(err instanceof ApiError ? err.message : "Unable to load todos.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [getAccessTokenSilently, filter, search, handleAuthError]);

  useEffect(() => {
    // Fetching on mount/filter-change is a sanctioned exception to
    // "don't setState synchronously in an effect" - refresh() is
    // synchronizing local state with the server, not reacting to a render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [message]);

  const createTodo = useCallback(
    async (input: CreateTodoInput) => {
      setIsMutating(true);
      setError(null);
      try {
        const token = await getAccessTokenSilently();
        const created = await todosApi.create(token, input);
        setTodos((prev) => [created, ...prev]);
        setMessage("Todo created successfully.");
        return true;
      } catch (err) {
        if (!(await handleAuthError(err))) {
          setError(err instanceof ApiError ? err.message : "Unable to create the todo.");
        }
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [getAccessTokenSilently, handleAuthError],
  );

  const updateTodo = useCallback(
    async (id: number, input: UpdateTodoInput) => {
      setIsMutating(true);
      setError(null);
      try {
        const token = await getAccessTokenSilently();
        const updated = await todosApi.update(token, id, input);
        setTodos((prev) => prev.map((todo) => (todo.id === id ? updated : todo)));
        setMessage("Todo updated successfully.");
        return true;
      } catch (err) {
        if (!(await handleAuthError(err))) {
          setError(err instanceof ApiError ? err.message : "Unable to update the todo.");
        }
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [getAccessTokenSilently, handleAuthError],
  );

  const deleteTodo = useCallback(
    async (id: number) => {
      setIsMutating(true);
      setError(null);
      try {
        const token = await getAccessTokenSilently();
        await todosApi.remove(token, id);
        setTodos((prev) => prev.filter((todo) => todo.id !== id));
        setMessage("Todo deleted successfully.");
        return true;
      } catch (err) {
        if (!(await handleAuthError(err))) {
          setError(err instanceof ApiError ? err.message : "Unable to delete the todo.");
        }
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [getAccessTokenSilently, handleAuthError],
  );

  return {
    todos,
    isLoading,
    isMutating,
    error,
    message,
    filter,
    setFilter,
    search,
    setSearch,
    createTodo,
    updateTodo,
    deleteTodo,
  };
}
