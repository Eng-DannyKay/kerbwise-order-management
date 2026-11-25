interface SkeletonProps {
  className?: string
}

/** Placeholder bar shown while content loads; still when reduced motion is preferred. */
export function Skeleton({ className = '' }: SkeletonProps) {
  return <span className={`block h-3 rounded-md bg-skeleton motion-safe:animate-skeleton ${className}`} />
}
