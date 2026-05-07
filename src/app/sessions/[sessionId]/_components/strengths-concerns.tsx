import { CheckIcon, WarningCircleIcon } from "@phosphor-icons/react/dist/ssr"

import { AccentLine } from "@/components/ui/accent-line"

interface StrengthsConcernsProps {
  strengths: string[]
  concerns: string[]
}

/**
 * Two-column "Strengths" / "Concerns" cards. Each side has a mono eyebrow,
 * an accent-line divider, then a bulleted list. Empty state is an italicised
 * "Nothing notable." line in fg-3.
 */
export function StrengthsConcerns({ strengths, concerns }: StrengthsConcernsProps) {
  return (
    <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <Column eyebrow="Strengths" tone="pass" items={strengths} />
      <Column eyebrow="Concerns" tone="warn" items={concerns} />
    </section>
  )
}

interface ColumnProps {
  eyebrow: string
  tone: "pass" | "warn"
  items: string[]
}

function Column({ eyebrow, tone, items }: ColumnProps) {
  const Icon = tone === "pass" ? CheckIcon : WarningCircleIcon
  const iconClass = tone === "pass" ? "text-accent" : "text-warn"

  return (
    <article className="flex flex-col gap-4 rounded-lg border border-border-default bg-bg-raised p-6">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-3">{eyebrow}</span>
      <AccentLine width={24} />
      {items.length === 0 ? (
        <p className="font-ui text-sm italic text-fg-3">Nothing notable.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item} className="grid grid-cols-[16px_1fr] items-start gap-3">
              <Icon size={14} weight="bold" className={`${iconClass} mt-[3px]`} />
              <span className="font-ui text-sm leading-relaxed text-fg-2">{item}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}
