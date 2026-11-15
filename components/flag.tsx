import { AU, BR, CA, CH, CN, DE, FR, GB, HK, IN, JP, KR, SA, SG, US, ZA } from "country-flag-icons/react/3x2"
import { cn } from "@/lib/utils"

// SVG flags rather than emoji: Windows has no flag emoji and would show two letters instead
const FLAGS = { us: US, ca: CA, br: BR, uk: GB, de: DE, fr: FR, ch: CH, sa: SA, za: ZA, in: IN, cn: CN, hk: HK, jp: JP, kr: KR, sg: SG, au: AU }

/** The flag for a market id from lib/markets.ts; decorative next to the market's name */
export function Flag({ market, className }: { market: string; className?: string }) {
  const Svg = FLAGS[market as keyof typeof FLAGS]
  if (!Svg) return null
  return (
    <Svg
      aria-hidden="true"
      className={cn("inline-block h-[14px] w-[21px] shrink-0 rounded-[3px] shadow-[0_0_0_0.5px_rgba(0,0,0,0.18)]", className)}
    />
  )
}
