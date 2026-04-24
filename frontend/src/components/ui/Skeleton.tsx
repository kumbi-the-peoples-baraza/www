import { cn } from '@/lib/utils'

interface SkeletonProps { className?: string }

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={cn('rounded-lg shimmer-bg bg-muted', className)} />
  )
}
