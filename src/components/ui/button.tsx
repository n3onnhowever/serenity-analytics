import * as React from 'react'
import { clsx } from 'clsx'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'secondary'
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant='default', ...props }, ref) => {
    const base = 'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-white/40 disabled:opacity-50 disabled:pointer-events-none'
    const styles = variant === 'secondary'
      ? 'bg-white/20 hover:bg-white/30 text-white'
      : 'bg-white text-violet-700 hover:bg-white/90'
    return <button ref={ref} className={clsx(base, styles, className)} {...props} />
  }
)
Button.displayName = 'Button'
