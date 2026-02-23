'use client'

import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function SignOutButton() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSignOut = async () => {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  return (
    <Button variant="outline" size="sm" onClick={handleSignOut} disabled={loading} aria-label="Log uit">
      <LogOut className="size-4" />
      {loading ? 'Uitloggen...' : 'Uitloggen'}
    </Button>
  )
}
