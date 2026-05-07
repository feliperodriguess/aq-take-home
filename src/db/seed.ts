import { db } from "@/db/drizzle"
import { jobs, type NewJob } from "@/db/schema"

const JOBS: NewJob[] = [
  {
    slug: "frontend-engineer",
    title: "Frontend Engineer",
    shortDescription:
      "Build the candidate-facing surface area of a high-traffic product. React, TypeScript, and a real eye for craft.",
    longDescription:
      "We're looking for a frontend engineer who treats the browser as a product surface, not a frame. You'll partner with design on the look-and-feel of every interaction, own the React component architecture for new flows, and push for the kind of performance and accessibility that users notice without naming. Comfortable with TypeScript, Tailwind, and modern Next.js; opinionated about state management and component design; able to ship in slices.",
    questionPackSlug: "frontend-engineer",
  },
  {
    slug: "backend-engineer",
    title: "Backend Engineer",
    shortDescription:
      "Design APIs and data models that hold up under real traffic. Postgres, Node, and a bias for clarity.",
    longDescription:
      "We need a backend engineer who can take a vague product ask and return a clear API contract, a sound data model, and a plan for what happens when things go wrong. You'll own services end-to-end: schema, endpoints, observability, and the on-call pager that comes with them. Strong on Postgres, comfortable with distributed-systems trade-offs, allergic to over-engineering, and willing to push back on scope when it earns the team a better outcome.",
    questionPackSlug: "backend-engineer",
  },
  {
    slug: "product-manager",
    title: "Product Manager",
    shortDescription:
      "Frame the right problem, ship in slices, and close the loop with metrics that actually mean something.",
    longDescription:
      "We're hiring a PM who runs on clarity rather than process. You'll partner with engineering and design from problem-framing through launch, defend a roadmap with evidence, and write the kind of specs that unblock teams instead of just describing the work. Strong instincts on prioritisation, comfortable with experimentation and analytics, willing to say no to high-volume requests when they don't move the user outcome you've defined.",
    questionPackSlug: "product-manager",
  },
]

async function main() {
  // neon-http has no transaction support; each insert is idempotent via the
  // unique slug + onConflictDoNothing, so sequential awaits are safe and
  // re-running the seed is a no-op.
  let inserted = 0
  for (const job of JOBS) {
    const result = await db
      .insert(jobs)
      .values(job)
      .onConflictDoNothing({ target: jobs.slug })
      .returning({ id: jobs.id })
    inserted += result.length
  }

  const skipped = JOBS.length - inserted
  console.log(`Seed complete. Inserted ${inserted} job(s), skipped ${skipped} existing row(s).`)
  process.exit(0)
}

main().catch((err) => {
  console.error("Seed failed:", err)
  process.exit(1)
})
