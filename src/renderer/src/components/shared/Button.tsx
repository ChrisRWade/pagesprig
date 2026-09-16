import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './Button.module.css'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger' | 'tool'
  active?: boolean
  children: ReactNode
}

export function Button({ variant = 'primary', active, className, children, type = 'button', ...props }: Props) {
  return (
    <button
      type={type}
      className={[styles.button, styles[variant], active ? styles.active : '', className ?? ''].join(' ')}
      aria-pressed={variant === 'tool' ? Boolean(active) : undefined}
      {...props}
    >
      {children}
    </button>
  )
}
