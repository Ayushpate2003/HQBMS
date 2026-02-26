import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

export default async function LoginPage() {
    const supabase = await createClient()

    // if user is already logged in, send them to dashboard
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
        redirect('/staff')
    }

    const signIn = async (formData: FormData) => {
        'use server'

        const email = formData.get('email') as string
        const password = formData.get('password') as string
        const supabase = await createClient()

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) {
            return redirect('/login?message=Could not authenticate user')
        }

        return redirect('/staff')
    }

    return (
        <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-2 mx-auto mt-20">
            <form
                className="flex-1 flex flex-col w-full justify-center gap-2 text-foreground"
                action={signIn}
            >
                <h1 className="text-3xl font-bold mb-6">HQBMS Login</h1>

                <label className="text-md font-medium" htmlFor="email">
                    Email
                </label>
                <input
                    className="rounded-md px-4 py-2 bg-inherit border mb-6"
                    name="email"
                    placeholder="you@hospital.org"
                    required
                />

                <label className="text-md font-medium" htmlFor="password">
                    Password
                </label>
                <input
                    className="rounded-md px-4 py-2 bg-inherit border mb-6"
                    type="password"
                    name="password"
                    placeholder="••••••••"
                    required
                />

                <button className="bg-foreground text-background rounded-md px-4 py-2 mb-2">
                    Sign In
                </button>

            </form>
        </div>
    )
}
