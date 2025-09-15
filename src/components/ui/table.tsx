import * as React from 'react'

export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return <table className={className} {...props} />
}
export function TableHeader(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...props} />
}
export function TableBody(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />
}
export function TableRow(props: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr {...props} />
}
export function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={'px-3 py-2 text-left text-sm ' + (className ?? '')} {...props} />
}
export function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={'px-3 py-2 align-middle text-sm ' + (className ?? '')} {...props} />
}
