export type Status = 'todo' | 'doing' | 'done'

export const STATUSES: Status[] = ['todo', 'doing', 'done']

export interface Task {
  id: string
  text: string
  status: Status
  position: number
  created_at: number
  updated_at: number
  deleted?: boolean
}

export interface User {
  id: string
  email: string
  name: string
  picture: string
}

export const MAX_TEXT = 2000
