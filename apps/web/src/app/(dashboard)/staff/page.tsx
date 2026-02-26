import { createClient } from '@/lib/supabase/server'
import OccupancyChart from '@/components/hospital/OccupancyChart'

export default async function StaffOverviewPage() {
    const supabase = await createClient()

    // Fetch staff user data and corresponding hospital details
    const { data: { user } } = await supabase.auth.getUser()

    const { data: userData } = await supabase
        .from('users')
        .select('hospital_id')
        .eq('id', user?.id)
        .single()

    return (
        <div className="flex flex-col gap-6">
            <h1 className="text-3xl font-bold tracking-tight">Staff Overview</h1>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Placeholder cards to be replaced by actual data hooks */}
                <div className="rounded-xl border bg-white p-6 shadow-sm">
                    <div className="text-sm font-medium text-gray-500">Available Beds</div>
                    <div className="mt-2 text-3xl font-bold text-green-600">--</div>
                </div>
                <div className="rounded-xl border bg-white p-6 shadow-sm">
                    <div className="text-sm font-medium text-gray-500">Wait Times (Avg)</div>
                    <div className="mt-2 text-3xl font-bold text-amber-500">-- min</div>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 mt-4">
                {userData?.hospital_id ? (
                    <OccupancyChart unitId={userData.hospital_id} />
                ) : (
                    <div className="w-full h-[300px] bg-white rounded-xl shadow-sm border p-4 flex items-center justify-center text-gray-500">
                        No hospital unit assigned to this staff member.
                    </div>
                )}
            </div>
        </div>
    )
}
