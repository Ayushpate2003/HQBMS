'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bed } from '@/hooks/useBeds'

export default function AdmissionModal({
    bed,
    isOpen,
    onClose,
}: {
    bed: Bed | null
    isOpen: boolean
    onClose: () => void
}) {
    const supabase = createClient()
    const [loading, setLoading] = useState(false)

    if (!isOpen || !bed) return null

    const handleAction = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)

        // In a full implementation, this creates a patient record, 
        // an admission record, and triggers the transaction.
        // MVP simulates the update transaction directly on the Bed status.

        const formData = new FormData(e.currentTarget)
        const action = formData.get('action') as string // 'admit' | 'discharge' | 'block'

        let newStatus = bed.status
        if (action === 'admit') newStatus = 'occupied'
        if (action === 'discharge') newStatus = 'free'
        if (action === 'block') newStatus = 'blocked'

        await supabase
            .from('beds')
            .update({ status: newStatus })
            .eq('id', bed.id)

        setLoading(false)
        onClose()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
                    <h2 className="text-lg font-bold">Bed {bed.bed_code} Actions</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>

                <form onSubmit={handleAction} className="p-6">
                    <div className="mb-6">
                        <p className="text-sm text-gray-500 mb-2">Current Status:
                            <span className="font-semibold text-gray-800 ml-2 uppercase">{bed.status}</span>
                        </p>
                    </div>

                    <div className="space-y-3">
                        {bed.status === 'free' && (
                            <button
                                type="submit"
                                name="action"
                                value="admit"
                                disabled={loading}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 rounded-md transition"
                            >
                                Admit Patient
                            </button>
                        )}

                        {bed.status === 'occupied' && (
                            <button
                                type="submit"
                                name="action"
                                value="discharge"
                                disabled={loading}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-md transition"
                            >
                                Discharge Patient
                            </button>
                        )}

                        {bed.status !== 'blocked' && (
                            <button
                                type="submit"
                                name="action"
                                value="block"
                                disabled={loading}
                                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-medium py-2 rounded-md transition"
                            >
                                Block Bed (Maintenance)
                            </button>
                        )}

                        {bed.status === 'blocked' && (
                            <button
                                type="submit"
                                name="action"
                                value="discharge" // Releases block to free
                                disabled={loading}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 rounded-md transition"
                            >
                                Unblock Bed
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    )
}
