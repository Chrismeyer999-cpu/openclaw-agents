import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getDeliveryStatus } from '@/lib/dashboard/getDeliveryStatus'
import { DeliveryStatusBoard } from '@/components/dashboard/DeliveryStatusBoard'

export default async function DashboardStatusPage() {
  const items = await getDeliveryStatus()

  const bySite = {
    platform: items.filter((i) => i.site === 'platform'),
    zwijsen: items.filter((i) => i.site === 'zwijsen.net'),
    brikx: items.filter((i) => i.site === 'brikxai.nl'),
    kavel: items.filter((i) => i.site === 'kavelarchitect.nl')
  }

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Roadmap & Status</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Centrale plek om bij te houden wat werkt, wat nog niet werkt en wat de volgende stap is.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card><CardHeader><CardTitle className="text-base">platform</CardTitle><CardDescription>{bySite.platform.length} onderwerpen</CardDescription></CardHeader><CardContent /></Card>
        <Card><CardHeader><CardTitle className="text-base">zwijsen.net</CardTitle><CardDescription>{bySite.zwijsen.length} onderwerpen</CardDescription></CardHeader><CardContent /></Card>
        <Card><CardHeader><CardTitle className="text-base">brikxai.nl</CardTitle><CardDescription>{bySite.brikx.length} onderwerpen</CardDescription></CardHeader><CardContent /></Card>
        <Card><CardHeader><CardTitle className="text-base">kavelarchitect.nl</CardTitle><CardDescription>{bySite.kavel.length} onderwerpen</CardDescription></CardHeader><CardContent /></Card>
      </div>

      <DeliveryStatusBoard items={items} />
    </section>
  )
}
