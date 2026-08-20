import type {
  CreateTodoInput,
  Todo,
  TodoStatusFilter,
  UpdateTodoInput,
} from "@/types/todo";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** A failed API call, carrying the HTTP status so callers can branch on it
 * (e.g. 401 -> prompt re-login) instead of parsing message strings. */
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

function friendlyMessageFor(status: number, data: unknown): string {
  if (data && typeof data === "object") {
    const body = data as Record<string, unknown>;
    if (typeof body.detail === "string") {
      return body.detail;
    }
    // DRF validation errors look like { "title": ["This field may not be blank."] }
    const firstField = Object.keys(body)[0];
    const firstValue = firstField ? body[firstField] : undefined;
    if (Array.isArray(firstValue) && typeof firstValue[0] === "string") {
      return firstField === "non_field_errors" ? firstValue[0] : `${firstField}: ${firstValue[0]}`;
    }
  }

  switch (status) {
    case 400:
      return "That request was invalid. Please check the form and try again.";
    case 401:
      return "Your session has expired. Please log in again.";
    case 403:
      return "You don't have permission to do that.";
    case 404:
      return "That todo could not be found. It may have already been deleted.";
    default:
      return "Something went wrong. Please try again.";
  }
}

async function request<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError("Unable to reach the server. Check your connection and try again.", 0);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    throw new ApiError(friendlyMessageFor(response.status, data), response.status);
  }

  return data as T;
}

export const todosApi = {
  list(token: string, opts: { status?: TodoStatusFilter; search?: string } = {}) {
    const params = new URLSearchParams();
    if (opts.status && opts.status !== "all") params.set("status", opts.status);
    if (opts.search) params.set("search", opts.search);
    const query = params.toString();
    return request<Paginated<Todo>>(`/api/todos/${query ? `?${query}` : ""}`, token);
  },

  create(token: string, input: CreateTodoInput) {
    return request<Todo>("/api/todos/", token, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  update(token: string, id: number, input: UpdateTodoInput) {
    return request<Todo>(`/api/todos/${id}/`, token, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  remove(token: string, id: number) {
    return request<void>(`/api/todos/${id}/`, token, { method: "DELETE" });
  },
};
