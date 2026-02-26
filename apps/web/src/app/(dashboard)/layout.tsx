import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return redirect('/login')
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Top Header */}
            <header className="bg-white border-b h-16 flex items-center justify-between px-6 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="font-bold text-xl text-blue-600">HQBMS</div>
                    <nav className="flex items-center gap-4 ml-8 text-sm font-medium text-gray-600">
                        <Link href="/staff" className="hover:text-blue-600 transition">Dashboard</Link>
                        <Link href="/staff/beds" className="hover:text-blue-600 transition">Bed Management</Link>
                        <Link href="/doctor/queue" className="hover:text-blue-600 transition">Queues</Link>
                    </nav>
                </div>
                <div className="flex items-center gap-4 text-sm">
                    <div className="text-gray-500">{user.email}</div>
                    <form action="/auth/signout" method="post">
                        <button className="text-red-500 font-medium hover:underline">Sign out</button>
                    </form>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
                {children}
            </main>
        </div>
    )
}
