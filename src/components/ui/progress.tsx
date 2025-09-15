import * as React from 'react'

export function Progress({ value, className }: { value: number, className?: string }) {
  return (
    <div className={`w-full h-2 rounded-full overflow-hidden bg-white/10 ${className ?? ''}`}>
      <div className="h-full bg-white transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}
