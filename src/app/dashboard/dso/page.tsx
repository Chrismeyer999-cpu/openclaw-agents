import { DsoLookupForm } from '@/components/dashboard/DsoLookupForm'

export default function DsoPage() {
  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">DSO Informatie</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Startpunt voor adres-lookup via PDOK + Ruimtelijke Plannen (DSO-context).</p>
      </header>

      <DsoLookupForm />
    </section>
  )
}
