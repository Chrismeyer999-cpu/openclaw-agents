import { Badge } from '@/components/ui/badge'

interface NewsStatusBadgeProps {
  status: string
}

export function NewsStatusBadge({ status }: NewsStatusBadgeProps) {
  if (status === 'published' || status === 'approved') {
    return <Badge variant="secondary">{status}</Badge>
  }

  if (status === 'rejected') {
    return <Badge variant="destructive">{status}</Badge>
  }

  return <Badge variant="outline">{status}</Badge>
}
