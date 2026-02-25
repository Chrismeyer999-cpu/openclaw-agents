import { createClient } from '@/lib/supabase/server'

export type DeliveryStatus = 'working' | 'partial' | 'planned' | 'blocked'

export interface DeliveryStatusItem {
  id: string
  site: 'zwijsen.net' | 'brikxai.nl' | 'kavelarchitect.nl' | 'platform'
  domain_area: string
  status: DeliveryStatus
  works_now: string | null
  not_working_yet: string | null
  next_step: string | null
  owner: string
  updated_at: string
}

export async function getDeliveryStatus(): Promise<DeliveryStatusItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('delivery_status_items')
    .select('id,site,domain_area,status,works_now,not_working_yet,next_step,owner,updated_at')
    .order('site', { ascending: true })
    .order('updated_at', { ascending: false })

  if (error) return []
  return (data ?? []) as DeliveryStatusItem[]
}
