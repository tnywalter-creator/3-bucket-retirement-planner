import { cn } from '@/lib/utils';

/**
 * Brand mark: three stacked rounded rectangles representing the cash / bridge / growth buckets.
 * Inline SVG so it inherits color via CSS and works on both light and dark backgrounds.
 */
export function Logo({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      role="img"
      aria-label="3-Bucket Plan"
      className={cn('shrink-0', className)}
    >
      <rect x="22" y="8"  width="20" height="12" rx="3" fill="currentColor" opacity="0.55" />
      <rect x="14" y="24" width="36" height="14" rx="3" fill="currentColor" opacity="0.78" />
      <rect x="6"  y="42" width="52" height="16" rx="3" fill="currentColor" />
    </svg>
  );
}
