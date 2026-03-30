import { cn } from '@/lib/utils/cn'
import { type HTMLAttributes } from 'react'

type BadgeVariant = 'default' | 'bausparen' | 'bkv' | 'success' | 'warning' | 'danger' | 'outline'

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-700',
  bausparen: 'bg-blue-100 text-[#2563EB]',
  bkv: 'bg-purple-100 text-[#7C3AED]',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
  outline: 'border border-[#E5E7EB] text-gray-600 bg-white',
}

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        variantStyles[variant],
        className
      )}
      {...props}
    />
  )
}
