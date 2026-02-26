import { createClient } from '@/lib/supabase/server'
import BedGrid from '@/components/hospital/BedGrid'
import { redirect } from 'next/navigation'

export default async function BedManagementPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // To properly mount the BedGrid, we need the user's hospital_id
    const { data: userData } = await supabase
        .from('users')
        .select('hospital_id')
        .eq('id', user.id)
        .single()

    if (!userData?.hospital_id) {
        return (
            <div className="p-8 text-red-500 font-medium">
                Error: You are not assigned to a hospital unit. Please contact your State Administrator.
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-6 w-full">
            <div className="flex justify-between items-center w-full">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Bed Management</h1>
                    <p className="text-gray-500 mt-1">Live monitoring via Supabase Realtime CDC.</p>
                </div>
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors shadow-sm">
                    + Add Bed
                </button>
            </div>

            <BedGrid unitId={userData.hospital_id} />
        </div>
    )
}
