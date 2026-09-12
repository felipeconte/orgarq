'use client'

import React from 'react'
import Link from 'next/link'
import { useBreadcrumb } from '@/contexts/BreadcrumbContext'

export function Breadcrumbs() {
  const { breadcrumbs } = useBreadcrumb()

  if (!breadcrumbs || breadcrumbs.length === 0) {
    return null
  }

  return (
    <nav
      aria-label="Navegação estrutural"
      className="flex items-center gap-2 text-sm font-medium text-slate-500 min-w-0"
    >
      {breadcrumbs.map((item, index) => {
        const isLast = index === breadcrumbs.length - 1

        return (
          <React.Fragment key={`${item.label}-${index}`}>
            {index > 0 && (
              <span
                className="text-slate-300 font-normal select-none"
                aria-hidden="true"
              >
                /
              </span>
            )}
            {isLast || !item.href ? (
              <span
                className="text-slate-900 font-bold truncate max-w-[200px] sm:max-w-[320px] md:max-w-[460px]"
                title={item.label}
                aria-current={isLast ? 'page' : undefined}
              >
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="text-slate-500 hover:text-blue-600 transition-colors duration-150 truncate max-w-[160px] sm:max-w-[220px]"
                title={item.label}
              >
                {item.label}
              </Link>
            )}
          </React.Fragment>
        )
      })}
    </nav>
  )
}
