export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type TaskRecurrence = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'YEARLY';

export interface TaskList {
  id: string;
  name: string;
  color?: string | null;
  sortOrder: number;
  _count?: { tasks: number };
}

export interface Task {
  id: string;
  title: string;
  notes?: string | null;
  priority: TaskPriority;
  dueAt?: string | null;
  completedAt?: string | null;
  recurrence?: TaskRecurrence | null;
  taskListId?: string | null;
  taskList?: Pick<TaskList, 'id' | 'name' | 'color'> | null;
  createdAt: string;
}

export interface CreateTaskData {
  title: string;
  notes?: string;
  priority?: TaskPriority;
  dueAt?: string;
  recurrence?: TaskRecurrence;
  taskListId?: string;
}

export interface UpdateTaskData extends Partial<Omit<CreateTaskData, 'dueAt' | 'recurrence' | 'taskListId'>> {
  completed?: boolean;
  dueAt?: string | null;
  recurrence?: TaskRecurrence | null;
  taskListId?: string | null;
}

export interface TasksSummary {
  open: number;
  dueToday: number;
  overdue: number;
}
