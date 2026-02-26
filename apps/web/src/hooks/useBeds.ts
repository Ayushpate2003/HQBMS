'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type Bed = {
    id: string
    unit_id: string
    bed_code: string
    type: string
    status: 'free' | 'occupied' | 'blocked'
    blocked_reason: string | null
    updated_at: string
}

export function useBeds(unitId: string | undefined) {
    const supabase = createClient()
    const [beds, setBeds] = useState<Bed[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!unitId) return

        // 1. Fetch initial state
        const fetchBeds = async () => {
            setLoading(true)
            const { data, error } = await supabase
                .from('beds')
                .select('*')
                .eq('unit_id', unitId)
                .order('bed_code')

            if (!error && data) {
                setBeds(data as Bed[])
            }
            setLoading(false)
        }

        fetchBeds()

        // 2. Subscribe to realtime changes via Postgres CDC
        const channel = supabase
            .channel(`beds-unit-${unitId}`)
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen to INSERT, UPDATE, DELETE
                    schema: 'public',
                    table: 'beds',
                    filter: `unit_id=eq.${unitId}`,
                },
                (payload) => {
                    console.log('Realtime Bed Update received:', payload)

                    if (payload.eventType === 'INSERT') {
                        setBeds((prev) => [...prev, payload.new as Bed].sort((a, b) => a.bed_code.localeCompare(b.bed_code)))
                    } else if (payload.eventType === 'UPDATE') {
                        setBeds((prev) => prev.map((bed) => (bed.id === payload.new.id ? (payload.new as Bed) : bed)))
                    } else if (payload.eventType === 'DELETE') {
                        setBeds((prev) => prev.filter((bed) => bed.id !== payload.old.id))
                    }
                }
            )
            .subscribe()

        // Cleanup subscription
        return () => {
            supabase.removeChannel(channel)
        }
    }, [unitId, supabase])

    return { beds, loading }
}
