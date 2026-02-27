import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSession } from './lib/session'

const protectedRoutes = ['/', '/projects', '/invoices', '/earnings']

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    const isProtectedRoute = protectedRoutes.some(route =>
        pathname === route || pathname.startsWith(`${route}/`)
    )

    if (isProtectedRoute) {
        const session = await getSession()

        if (!session?.authenticated) {
            const loginUrl = new URL('/login', request.url)
            // Redirect to login if not authenticated
            return NextResponse.redirect(loginUrl)
        }
    }

    // If user is already logged in, redirect them away from the login page
    if (pathname === '/login') {
        const session = await getSession()
        if (session?.authenticated) {
            return NextResponse.redirect(new URL('/', request.url))
        }
    }

    return NextResponse.next()
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
