import * as React from 'react'
import { clsx } from 'clsx'

type TabsContext = {
  value: string
  setValue: (v: string) => void
}
const Ctx = React.createContext<TabsContext | null>(null)

export function Tabs({ defaultValue, className, children }: { defaultValue: string, className?: string, children: React.ReactNode }) {
  const [value, setValue] = React.useState(defaultValue)
  return <div className={className}><Ctx.Provider value={{ value, setValue }}>{children}</Ctx.Provider></div>
}
export function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('inline-flex rounded-2xl p-1 border border-white/20', className)} {...props} />
}
export function TabsTrigger({ value, className, children }: { value: string, className?: string, children: React.ReactNode }) {
  const ctx = React.useContext(Ctx)!
  const active = ctx.value === value
  return (
    <button
      data-state={active ? 'active' : 'inactive'}
      onClick={() => ctx.setValue(value)}
      className={clsx('px-3 py-1.5 text-sm rounded-xl transition', active ? 'bg-white text-violet-700' : 'text-white')}
    >
      {children}
    </button>
  )
}
export function TabsContent({ value, children }: { value: string, children: React.ReactNode }) {
  const ctx = React.useContext(Ctx)!
  if (ctx.value !== value) return null
  return <div className="mt-4">{children}</div>
}
