'use client'

import { useActionState, useEffect } from 'react'
import { loginAction } from '@/app/actions/auth'
import { Loader2, LockKeyhole } from 'lucide-react'
import { motion } from 'framer-motion'

export default function LoginPage() {
    const [state, formAction, isPending] = useActionState(loginAction, null)

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden">
            {/* Decorative background elements matching the carpentry theme */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/20 rounded-full blur-[120px] pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="relative z-10 w-full max-w-md mx-auto p-8 bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl flex flex-col items-center"
            >
                <div className="w-14 h-14 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-6">
                    <LockKeyhole className="w-7 h-7" strokeWidth={1.5} />
                </div>

                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-foreground mb-2">Backoffice Access</h1>
                    <p className="text-muted-foreground text-sm">
                        Mizarstvo Pravi Kot Internal Dashboard
                    </p>
                </div>

                <form action={formAction} className="w-full space-y-5">
                    <div className="space-y-2">
                        <label htmlFor="password" className="text-sm font-medium text-foreground ml-1">
                            Secure Password
                        </label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            required
                            className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/60"
                            placeholder="Enter master password..."
                        />
                    </div>

                    {state?.error && (
                        <motion.p
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="text-red-500 text-sm font-medium text-center bg-red-500/10 py-2 rounded-lg"
                        >
                            {state.error}
                        </motion.p>
                    )}

                    <button
                        type="submit"
                        disabled={isPending}
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 px-4 rounded-xl transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isPending ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            'Enter Dashboard'
                        )}
                    </button>
                </form>
            </motion.div>
        </div>
    )
}
