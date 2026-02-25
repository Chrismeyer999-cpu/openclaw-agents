import { createClient } from '@/lib/supabase/server'

export interface DashboardTodo {
  id: string
  title: string
  notes: string | null
  status: 'open' | 'doing' | 'done'
  priority: 'low' | 'medium' | 'high'
  due_date: string | null
  created_at: string
}

export async function getTodos(limit = 12): Promise<DashboardTodo[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('dashboard_todos')
    .select('id,title,notes,status,priority,due_date,created_at')
    .order('status', { ascending: true })
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return []
  return (data ?? []) as DashboardTodo[]
}
