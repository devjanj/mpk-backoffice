'use server'

import { login, logout } from '@/lib/session'
import { redirect } from 'next/navigation'

export async function loginAction(state: any, formData: FormData) {
    const password = formData.get('password') as string

    try {
        await login(password)
    } catch (error) {
        return { error: 'Invalid secure password.' }
    }

    redirect('/')
}

export async function logoutAction() {
    await logout()
    redirect('/login')
}
