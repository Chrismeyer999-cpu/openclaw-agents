import { createClient } from '@/lib/supabase/server'

export interface CostOverview {
  todayUsd: number
  monthUsd: number
  activeAgents: number
  overBudgetAgents: number
}

export async function getCostOverview(): Promise<CostOverview | null> {
  const supabase = await createClient()

  const now = new Date()
  const dayStart = new Date(now)
  dayStart.setHours(0, 0, 0, 0)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [todayRes, monthRes, budgetsRes] = await Promise.all([
    supabase.from('cost_tracking').select('cost_usd').gte('run_at', dayStart.toISOString()),
    supabase.from('cost_tracking').select('agent_name,cost_usd').gte('run_at', monthStart.toISOString()),
    supabase.from('agent_budgets').select('agent_name,monthly_budget_usd,enabled')
  ])

  if (todayRes.error || monthRes.error || budgetsRes.error) {
    // Tables may not exist yet in some environments
    return null
  }

  const todayUsd = (todayRes.data ?? []).reduce((sum, row) => sum + Number(row.cost_usd ?? 0), 0)
  const monthRows = monthRes.data ?? []
  const monthUsd = monthRows.reduce((sum, row) => sum + Number(row.cost_usd ?? 0), 0)

  const byAgent = new Map<string, number>()
  monthRows.forEach((row) => {
    const key = row.agent_name ?? 'unknown'
    byAgent.set(key, (byAgent.get(key) ?? 0) + Number(row.cost_usd ?? 0))
  })

  let overBudgetAgents = 0
  const enabledBudgets = (budgetsRes.data ?? []).filter((item) => item.enabled)
  enabledBudgets.forEach((item) => {
    const spent = byAgent.get(item.agent_name) ?? 0
    if (Number(item.monthly_budget_usd ?? 0) > 0 && spent >= Number(item.monthly_budget_usd)) {
      overBudgetAgents += 1
    }
  })

  return {
    todayUsd,
    monthUsd,
    activeAgents: enabledBudgets.length,
    overBudgetAgents
  }
}
