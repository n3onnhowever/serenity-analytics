import * as React from 'react'
import { clsx } from 'clsx'

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={clsx('block mb-1 text-sm font-medium', className)} {...props} />
}
