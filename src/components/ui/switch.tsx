import * as React from 'react'

export function Switch({ checked, onCheckedChange, disabled }: { checked: boolean, onCheckedChange?: (v: boolean)=>void, disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onCheckedChange && onCheckedChange(!checked)}
      aria-pressed={checked}
      className={`w-12 h-7 rounded-full relative transition ${checked ? 'bg-white' : 'bg-white/30'} ${disabled ? 'opacity-50' : ''}`}
    >
      <span className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-violet-700 transition-transform ${checked ? 'translate-x-5' : ''}`}></span>
    </button>
  )
}
