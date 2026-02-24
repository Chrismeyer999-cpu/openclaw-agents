import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { createClient } from '@/lib/supabase/server'

export default async function WorkspaceLlmPage({
  params
}: {
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params
  const supabase = await createClient()

  const { data: clusters, error: clustersError } = await supabase
    .from('intent_clusters')
    .select('id, cluster_name')
    .eq('workspace_id', workspaceId)

  if (clustersError) {
    throw new Error(`Kon intent clusters niet laden: ${clustersError.message}`)
  }

  const clusterIds = (clusters ?? []).map((cluster) => cluster.id)
  const clusterNameById = new Map((clusters ?? []).map((cluster) => [cluster.id, cluster.cluster_name]))
  let mentions: { id: string; prompt: string; llm_source: string; mentioned: boolean; checked_at: string; intent_cluster_id: string }[] = []

  if (clusterIds.length > 0) {
    const { data, error } = await supabase
      .from('llm_mentions')
      .select('id, prompt, llm_source, mentioned, checked_at, intent_cluster_id')
      .in('intent_cluster_id', clusterIds)
      .order('checked_at', { ascending: false })
      .limit(50)

    if (error) {
      throw new Error(`Kon LLM mentions niet laden: ${error.message}`)
    }
    mentions = data ?? []
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cluster</TableHead>
            <TableHead>Prompt</TableHead>
            <TableHead>Bron</TableHead>
            <TableHead>Mentioned</TableHead>
            <TableHead className="text-right">Checked</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {mentions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-sm text-gray-500 dark:text-gray-400">
                Nog geen LLM mentions in deze workspace.
              </TableCell>
            </TableRow>
          ) : (
            mentions.map((mention) => (
              <TableRow key={mention.id}>
                <TableCell className="font-medium">{clusterNameById.get(mention.intent_cluster_id) ?? '-'}</TableCell>
                <TableCell className="max-w-[320px] truncate">{mention.prompt}</TableCell>
                <TableCell>{mention.llm_source}</TableCell>
                <TableCell>
                  <Badge variant={mention.mentioned ? 'secondary' : 'outline'}>{mention.mentioned ? 'Ja' : 'Nee'}</Badge>
                </TableCell>
                <TableCell className="text-right text-xs text-gray-500 dark:text-gray-400">
                  {new Date(mention.checked_at).toLocaleDateString('nl-NL')}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
