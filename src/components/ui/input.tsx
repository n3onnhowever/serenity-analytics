import * as React from 'react'
import { clsx } from 'clsx'

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx('w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-white/30', className)} {...props} />
}
