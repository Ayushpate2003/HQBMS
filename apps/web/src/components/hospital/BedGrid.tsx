'use client'

import { useState } from 'react'
import { useBeds, Bed } from '@/hooks/useBeds'
import AdmissionModal from './modals/AdmissionModal'

export default function BedGrid({ unitId }: { unitId: string }) {
    const { beds, loading } = useBeds(unitId)
    const [selectedBed, setSelectedBed] = useState<Bed | null>(null)

    if (loading) {
        return <div className="animate-pulse bg-gray-200 h-64 rounded-xl w-full"></div>
    }

    if (beds.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 border border-dashed rounded-xl bg-gray-50 text-gray-500">
                No beds configured for this unit.
            </div>
        )
    }

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 mt-8">
            {beds.map((bed) => {
                let bgColor = 'bg-white border-gray-200'
                let textColor = 'text-gray-700'
                let statusText = 'Free'

                switch (bed.status) {
                    case 'free':
                        bgColor = 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                        textColor = 'text-emerald-700'
                        break
                    case 'occupied':
                        bgColor = 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                        textColor = 'text-rose-700'
                        statusText = 'Occupied'
                        break
                    case 'blocked':
                        bgColor = 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                        textColor = 'text-amber-700'
                        statusText = 'Blocked'
                        break
                }

                return (
                    <button
                        key={bed.id}
                        className={`
              flex flex-col items-center justify-center p-4 h-24 rounded-lg border shadow-sm transition-all
              ${bgColor}
            `}
                        title={bed.blocked_reason || `Bed ${bed.bed_code}`}
                        onClick={() => setSelectedBed(bed)}
                    >
                        <span className={`text-lg font-bold ${textColor}`}>{bed.bed_code}</span>
                        <span className={`text-xs font-medium uppercase mt-1 ${textColor} opacity-80`}>
                            {statusText}
                        </span>
                    </button>
                )
            })}

            <AdmissionModal
                isOpen={!!selectedBed}
                bed={selectedBed}
                onClose={() => setSelectedBed(null)}
            />
        </div>
    )
}
