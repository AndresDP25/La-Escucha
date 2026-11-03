import { useEffect, useState, type DragEvent, type FormEvent } from 'react';
import {
  createTask,
  deleteTask,
  fetchTasks,
  moveTask,
  renameTask,
  type BoardTask,
  type TaskStatus,
} from './api';
import { IconPencil } from './icons';

const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: 'TODO', label: 'Pendientes' },
  { id: 'DOING', label: 'En curso' },
  { id: 'DONE', label: 'Finalizadas' },
];

export function TasksPage({ accountName }: { accountName: string }) {
  const [tasks, setTasks] = useState<BoardTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<TaskStatus | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetchTasks()
      .then((rows) => {
        if (!cancelled) setTasks(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudieron cargar las tareas');
      });
    return () => {
      cancelled = true;
    };
  }, [accountName]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const title = draft.trim();
    if (!title || busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createTask(title);
      setTasks((current) => [...current, created]);
      setDraft('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la tarea');
    } finally {
      setBusy(false);
    }
  }

  async function onDrop(status: TaskStatus, beforeId: string | null) {
    const id = draggingId;
    setDraggingId(null);
    setOverColumn(null);
    if (!id || id === beforeId) return;
    const previous = tasks;
    setTasks((current) => {
      const moving = current.find((task) => task.id === id);
      if (!moving) return current;
      const rest = current.filter((task) => task.id !== id && task.status === status);
      const others = current.filter((task) => task.id !== id && task.status !== status);
      let index = rest.length;
      if (beforeId) {
        const at = rest.findIndex((task) => task.id === beforeId);
        if (at >= 0) index = at;
      }
      rest.splice(index, 0, { ...moving, status });
      return [...others, ...rest.map((task, position) => ({ ...task, position }))];
    });
    try {
      await moveTask(id, status, beforeId);
      const rows = await fetchTasks();
      setTasks(rows);
    } catch (err: unknown) {
      setTasks(previous);
      setError(err instanceof Error ? err.message : 'No se pudo mover la tarea');
    }
  }

  async function saveTitle(id: string) {
    const title = editingTitle.trim();
    setEditingId(null);
    const current = tasks.find((task) => task.id === id);
    if (!current || !title || title === current.title) return;
    setTasks((rows) => rows.map((task) => (task.id === id ? { ...task, title } : task)));
    try {
      await renameTask(id, title);
    } catch (err: unknown) {
      setTasks((rows) => rows.map((task) => (task.id === id ? current : task)));
      setError(err instanceof Error ? err.message : 'No se pudo renombrar la tarea');
    }
  }

  async function remove(id: string) {
    const previous = tasks;
    setTasks((rows) => rows.filter((task) => task.id !== id));
    try {
      await deleteTask(id);
    } catch (err: unknown) {
      setTasks(previous);
      setError(err instanceof Error ? err.message : 'No se pudo borrar la tarea');
    }
  }

  function allowDrop(event: DragEvent, status: TaskStatus) {
    event.preventDefault();
    setOverColumn(status);
  }

  return (
    <section className="tasks-page">
      <div className="page-head">
        <h2>Tareas</h2>
        <p>De {accountName}. Arrastrá una tarjeta para cambiar de columna.</p>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <div className="board">
        {COLUMNS.map((column) => {
          const cards = tasks
            .filter((task) => task.status === column.id)
            .sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));
          return (
            <div
              key={column.id}
              role="region"
              aria-label={column.label}
              className={`board-col${overColumn === column.id ? ' over' : ''}`}
              onDragOver={(event) => allowDrop(event, column.id)}
              onDragLeave={() => setOverColumn((current) => (current === column.id ? null : current))}
              onDrop={(event) => {
                event.preventDefault();
                void onDrop(column.id, null);
              }}
            >
              <h3>
                {column.label}
                <span className="board-count">{cards.length}</span>
              </h3>
              <div className="board-cards" role="list">
                {cards.map((task) => (
                  <article
                    key={task.id}
                    role="listitem"
                    aria-label={task.title}
                    className={`task-card${draggingId === task.id ? ' dragging' : ''}${
                      editingId === task.id ? ' editing' : ''
                    }`}
                    draggable={editingId !== task.id}
                    onDragStart={() => setDraggingId(task.id)}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setOverColumn(null);
                    }}
                    onDragOver={(event) => allowDrop(event, column.id)}
                    onDrop={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      void onDrop(column.id, task.id);
                    }}
                  >
                    {editingId === task.id ? (
                      <input
                        className="task-title-input"
                        value={editingTitle}
                        autoFocus
                        onChange={(event) => setEditingTitle(event.target.value)}
                        onBlur={() => void saveTitle(task.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            void saveTitle(task.id);
                          }
                          if (event.key === 'Escape') setEditingId(null);
                        }}
                      />
                    ) : (
                      <h4>{task.title}</h4>
                    )}
                    {editingId === task.id ? null : (
                    <div
                      className="task-actions"
                      onMouseDown={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="task-icon"
                        aria-label={`Editar ${task.title}`}
                        onClick={() => {
                          setEditingId(task.id);
                          setEditingTitle(task.title);
                        }}
                      >
                        <IconPencil size={14} />
                      </button>
                      <button
                        type="button"
                        className="task-icon"
                        aria-label={`Borrar ${task.title}`}
                        onClick={() => void remove(task.id)}
                      >
                        ×
                      </button>
                    </div>
                    )}
                  </article>
                ))}
              </div>
              {column.id === 'TODO' ? (
                <form className="task-add" onSubmit={(event) => void onCreate(event)}>
                  <input
                    value={draft}
                    placeholder="Nueva tarea"
                    onChange={(event) => setDraft(event.target.value)}
                    maxLength={200}
                  />
                  <button className="btn" type="submit" disabled={busy || !draft.trim()}>
                    Agregar
                  </button>
                </form>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
