import { getWorkspaceAnalytics } from '@/lib/dashboard/getWorkspaceAnalytics'
import { TrafficChart } from '@/components/dashboard/TrafficChart'
import { TrendingUp, TrendingDown, Search, Globe, Target, AlertTriangle, CheckCircle, ArrowUpRight, Lightbulb, BarChart2, MousePointerClick, Info, RefreshCw } from 'lucide-react'
import Link from 'next/link'

export default async function WorkspacePagesPage({
  params
}: {
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params
  const data = await getWorkspaceAnalytics(workspaceId)

  if (!data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
        Kon analytics-data niet laden voor deze workspace.
      </div>
    )
  }

  const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
  const fmtCtr = (n: number) => `${(n * 100).toFixed(1)}%`

  const hasNoGscData = data.totalClicks === 0 && data.totalImpressions === 0
  const hasNoGa4Data = data.totalSessions === 0

  return (
    <div className="space-y-8 pb-12">

      {/* ───── Diagnose Banner ───── */}
      {(hasNoGscData || hasNoGa4Data) && (
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 p-5 dark:border-amber-800/40 dark:bg-amber-900/20">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="space-y-3 flex-1">
              <div>
                <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">Geen data beschikbaar — actie vereist</h3>
                <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
                  De grafieken zijn leeg omdat de Google integratie niet volledig is geconfigureerd of de eerste sync nog niet is gedraaid.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {hasNoGscData && (
                  <div className="rounded-xl border border-amber-200 bg-white/70 p-3 dark:border-amber-900/50 dark:bg-amber-950/30">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">🔍 Search Console (clicks/impressies)</p>
                    <ul className="mt-1.5 space-y-1 text-xs text-gray-600 dark:text-gray-300">
                      <li>1. Ga naar <Link href="/dashboard/google" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">Google Connections</Link></li>
                      <li>2. Koppel je Google account via OAuth</li>
                      <li>3. Klik op <strong>Run Sync</strong> om data op te halen</li>
                      <li className="text-amber-600 dark:text-amber-400">⚠ Vul <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/50">GOOGLE_OAUTH_CLIENT_ID</code> en <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/50">GOOGLE_OAUTH_CLIENT_SECRET</code> in .env.local</li>
                    </ul>
                  </div>
                )}
                {hasNoGa4Data && (
                  <div className="rounded-xl border border-amber-200 bg-white/70 p-3 dark:border-amber-900/50 dark:bg-amber-950/30">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">📊 Google Analytics 4 (sessies)</p>
                    <ul className="mt-1.5 space-y-1 text-xs text-gray-600 dark:text-gray-300">
                      <li>1. Maak een <strong>Service Account</strong> aan in Google Cloud Console</li>
                      <li>2. Geef het service account <strong>Viewer</strong>-toegang in GA4</li>
                      <li>3. Vul <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/50">GOOGLE_SERVICE_ACCOUNT_EMAIL</code> en <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/50">GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY</code> in .env.local</li>
                    </ul>
                  </div>
                )}
              </div>
              <Link href="/dashboard/google" className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 transition-colors">
                <RefreshCw className="h-3.5 w-3.5" />
                Ga naar Google Connections &amp; Sync
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ───── KPI Strip ───── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
        <KpiTile
          label="Organic Clicks"
          value={data.totalClicks.toLocaleString('nl-NL')}
          delta={data.deltaClicksPct}
          icon={<MousePointerClick className="h-4 w-4" />}
          color="orange"
        />
        <KpiTile
          label="Impressions"
          value={data.totalImpressions.toLocaleString('nl-NL')}
          delta={data.deltaImpressionsPct}
          icon={<Search className="h-4 w-4" />}
          color="indigo"
        />
        <KpiTile
          label="Sessions"
          value={data.totalSessions.toLocaleString('nl-NL')}
          delta={data.deltaSessionsPct}
          icon={<Globe className="h-4 w-4" />}
          color="emerald"
        />
        <KpiTile
          label="Gem. positie"
          value={data.avgPosition > 0 ? data.avgPosition.toFixed(1) : '—'}
          icon={<BarChart2 className="h-4 w-4" />}
          color="sky"
          invertDelta
        />
        <KpiTile
          label="Gem. CTR"
          value={fmtCtr(data.avgCtr)}
          icon={<Target className="h-4 w-4" />}
          color="violet"
        />
      </div>

      {/* ───── Traffic Chart ───── */}
      <div className="rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm dark:border-gray-800/50 dark:bg-gray-900/40">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Traffic Over Time (30 dagen)</h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Klik op een metriek om te wisselen · hover voor detail</p>
          </div>
          <div className="flex gap-4 text-right">
            <div>
              <p className="text-xs text-gray-400">vs vorige periode</p>
              <div className="mt-1 flex flex-col gap-0.5">
                <p className={`text-sm font-bold ${data.deltaClicksPct >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {fmtPct(data.deltaClicksPct)} clicks
                </p>
                <p className={`text-sm font-bold ${data.deltaImpressionsPct >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {fmtPct(data.deltaImpressionsPct)} vertoningen
                </p>
                <p className={`text-sm font-bold ${data.deltaSessionsPct >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {fmtPct(data.deltaSessionsPct)} sessies
                </p>
              </div>
            </div>
          </div>
        </div>
        <TrafficChart points={data.trend} />
      </div>

      {/* ───── 2-col: Opportunities + Low CTR ───── */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* Ranking Opportunities */}
        <div className="rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm dark:border-gray-800/50 dark:bg-gray-900/40">
          <div className="mb-4 flex items-center gap-2">
            <div className="rounded-lg bg-amber-100 p-1.5 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Quick Win Ranking Kansen</h2>
              <p className="text-xs text-gray-500">Pagina's op positie 4–20 met veel impressions — één push naar top-3 verdubbelt clicks</p>
            </div>
          </div>

          {data.opportunities.length === 0 ? (
            <EmptyHint text="Geen duidelijke quick wins gevonden. Zorg dat GSC data gesynchroniseerd is." />
          ) : (
            <div className="space-y-3">
              {data.opportunities.map((opp) => (
                <div key={opp.url} className="group flex items-start gap-3 rounded-xl border border-gray-100 p-3 transition-all hover:border-amber-200 hover:bg-amber-50/50 dark:border-gray-800 dark:hover:border-amber-900/50 dark:hover:bg-amber-900/10">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-xs font-bold text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/30 dark:text-amber-400">
                    {opp.avgPosition.toFixed(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{opp.title}</p>
                    <p className="mt-0.5 truncate text-[11px] text-gray-400">{opp.url}</p>
                    <div className="mt-1.5 flex items-center gap-3 text-[11px] text-gray-500">
                      <span className="text-indigo-600 dark:text-indigo-400">{opp.impressions.toLocaleString()} impr.</span>
                      <span className="text-orange-600 dark:text-orange-400">{opp.clicks} clicks</span>
                      <span>CTR {fmtCtr(opp.ctr)}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                      pos {opp.avgPosition.toFixed(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low CTR – title/meta improvement tips */}
        <div className="rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm dark:border-gray-800/50 dark:bg-gray-900/40">
          <div className="mb-4 flex items-center gap-2">
            <div className="rounded-lg bg-rose-100 p-1.5 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
              <MousePointerClick className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Lage CTR – Optimaliseer Title & Meta</h2>
              <p className="text-xs text-gray-500">Hoge impressions, maar mensen klikken nauwelijks — betere title/meta = meer verkeer zonder hogere positie</p>
            </div>
          </div>

          {data.lowCtrPages.length === 0 ? (
            <EmptyHint text="Alle pagina's hebben een gezonde CTR. Goed werk!" positive />
          ) : (
            <div className="space-y-3">
              {data.lowCtrPages.map((p) => (
                <div key={p.url} className="group flex items-start gap-3 rounded-xl border border-gray-100 p-3 transition-all hover:border-rose-200 hover:bg-rose-50/50 dark:border-gray-800 dark:hover:border-rose-900/50 dark:hover:bg-rose-900/10">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-xs font-bold text-rose-700 dark:border-rose-900/50 dark:bg-rose-900/30 dark:text-rose-400">
                    {fmtCtr(p.ctr)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{p.title}</p>
                    <p className="mt-0.5 truncate text-[11px] text-gray-400">{p.url}</p>
                    <div className="mt-1.5 flex items-center gap-3 text-[11px] text-gray-500">
                      <span className="text-indigo-600 dark:text-indigo-400">{p.impressions.toLocaleString()} impr.</span>
                      <span>pos {p.avgPosition.toFixed(1)}</span>
                    </div>
                  </div>
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-300">
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ───── Top Pages Table ───── */}
      <div className="rounded-2xl border border-gray-200/60 bg-white shadow-sm dark:border-gray-800/50 dark:bg-gray-900/40">
        <div className="flex items-center justify-between border-b border-gray-200/60 px-6 py-4 dark:border-gray-800/60">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Top Pagina's (30 dagen)</h2>
            <p className="text-xs text-gray-500">Gesorteerd op organische clicks · {data.topPages.length} pagina's met data</p>
          </div>
        </div>

        {data.topPages.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-400">
            Nog geen GSC-data gevonden. Koppel Google Search Console en run een synchronisatie.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Pagina</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">Clicks</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">Impr.</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">CTR</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">Positie</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">Sessions</th>
                  <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-400">Schema</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                {data.topPages.map((page, i) => (
                  <tr key={page.id} className="group transition-colors hover:bg-gray-50/70 dark:hover:bg-gray-800/30">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <span className="w-5 text-right text-[11px] text-gray-300 dark:text-gray-600">{i + 1}</span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-gray-900 dark:text-gray-100 max-w-xs">{page.title}</p>
                          <p className="truncate text-[11px] text-gray-400 max-w-xs">{page.url}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-orange-600 dark:text-orange-400">{page.clicks.toLocaleString('nl-NL')}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{page.impressions.toLocaleString('nl-NL')}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-xs font-medium ${page.ctr < 0.02 ? 'text-rose-500' : page.ctr > 0.05 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500'}`}>
                        {fmtCtr(page.ctr)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <PositionBadge pos={page.avgPosition} />
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">{page.sessions.toLocaleString('nl-NL')}</td>
                    <td className="px-4 py-3 text-center">
                      {page.has_schema ? (
                        <CheckCircle className="mx-auto h-4 w-4 text-emerald-500" />
                      ) : (
                        <AlertTriangle className="mx-auto h-4 w-4 text-amber-400" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ───── SEO Tips ───── */}
      {(data.missingSchemaPages.length > 0 || data.opportunities.length > 0) && (
        <div className="rounded-2xl border border-indigo-200/60 bg-indigo-50/40 p-6 dark:border-indigo-900/30 dark:bg-indigo-950/20">
          <div className="mb-4 flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-indigo-500" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">SEO Verbeterpunten</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {data.missingSchemaPages.length > 0 && (
              <Tip
                title={`${data.missingSchemaPages.length} pagina's missen schema markup`}
                body="Gestructureerde data (Schema.org) laat zoekmachines beter begrijpen wat een pagina over gaat en kan leiden tot rich results in Google."
                action="Voeg Article, FAQPage of HowTo schema toe"
                severity="warning"
                pages={data.missingSchemaPages.slice(0, 3).map(p => p.title)}
              />
            )}
            {data.opportunities.length > 0 && (
              <Tip
                title={`${data.opportunities.length} pagina's staan net buiten top-3`}
                body="Pagina's op positie 4-10 zijn de grootste kans: een kleine verbetering in content kwaliteit of interne links kan ze naar top-3 duwen – dat geeft tot 3× meer clicks."
                action="Verbeter contentkwaliteit, voeg interne links toe, update de alinea's"
                severity="info"
                pages={data.opportunities.slice(0, 3).map(p => p.title)}
              />
            )}
            {data.lowCtrPages.length > 0 && (
              <Tip
                title={`${data.lowCtrPages.length} pagina's hebben lage CTR`}
                body="Google toont ze al hoog, maar gebruikers klikken er niet op. Een pakkendere title tag en meta description kan de click-through rate snel verdubbelen."
                action="Test nieuwe title tags en schrijf actief-gestelde meta descriptions"
                severity="warning"
                pages={data.lowCtrPages.slice(0, 3).map(p => p.title)}
              />
            )}
            <Tip
              title="Maak content voor LLM-zichtbaarheid"
              body="ChatGPT, Gemini en Perplexity citeren vaker pagina's met FAQ schema, duidelijke Author info en factual, goed gestructureerde alinea's."
              action="Ga naar het LLM tabblad voor AI mention tracking"
              severity="info"
            />
          </div>
        </div>
      )}

    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiTile({
  label, value, delta, icon, color, invertDelta
}: {
  label: string
  value: string
  delta?: number
  icon: React.ReactNode
  color: 'orange' | 'indigo' | 'emerald' | 'sky' | 'violet'
  invertDelta?: boolean
}) {
  const colors = {
    orange: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-900/30',
    indigo: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-900/30',
    emerald: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/30',
    sky: 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/20 border-sky-100 dark:border-sky-900/30',
    violet: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 border-violet-100 dark:border-violet-900/30'
  }
  const up = delta !== undefined ? (invertDelta ? delta < 0 : delta >= 0) : null

  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <div className="flex items-center justify-between mb-2 text-current opacity-70">
        <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{label}</span>
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      {delta !== undefined && (
        <div className="mt-1 flex items-center gap-1">
          {up ? <TrendingUp className="h-3 w-3 text-emerald-500" /> : <TrendingDown className="h-3 w-3 text-rose-500" />}
          <span className={`text-[11px] font-medium ${up ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
            {delta >= 0 ? '+' : ''}{delta.toFixed(1)}% vs vorige periode
          </span>
        </div>
      )}
    </div>
  )
}

function PositionBadge({ pos }: { pos: number }) {
  if (pos <= 0) return <span className="text-xs text-gray-300">—</span>
  const color = pos <= 3 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
    : pos <= 10 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
      : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
  return (
    <span className={`ml-auto inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${color}`}>
      {pos.toFixed(1)}
    </span>
  )
}

function Tip({
  title, body, action, severity, pages
}: {
  title: string
  body: string
  action: string
  severity: 'warning' | 'info'
  pages?: string[]
}) {
  return (
    <div className={`rounded-xl border p-4 ${severity === 'warning' ? 'border-amber-200 bg-white dark:border-amber-900/40 dark:bg-amber-950/20' : 'border-indigo-200 bg-white dark:border-indigo-900/40 dark:bg-indigo-950/20'}`}>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{title}</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{body}</p>
      {pages && pages.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {pages.map((p, i) => (
            <li key={i} className="text-[11px] text-gray-400 truncate">· {p}</li>
          ))}
        </ul>
      )}
      <p className={`mt-2 text-[11px] font-semibold ${severity === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
        → {action}
      </p>
    </div>
  )
}

function EmptyHint({ text, positive }: { text: string; positive?: boolean }) {
  return (
    <div className={`flex items-center gap-2 rounded-xl border border-dashed p-4 text-sm ${positive ? 'border-emerald-200 text-emerald-600 dark:border-emerald-900/50 dark:text-emerald-400' : 'border-gray-200 text-gray-400 dark:border-gray-700'}`}>
      {positive ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
      {text}
    </div>
  )
}
