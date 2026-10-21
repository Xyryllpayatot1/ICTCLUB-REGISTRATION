import { SectionHeading } from "@/components/ui";

/** Program introduction: what it is, who can join, what to expect, why it matters. */
export function ProgramIntro() {
  const points = [
    {
      title: "What it is",
      body: "A structured teaching program run by the MRMNHS ICT Club that introduces students to programming, networking, and other ICT disciplines through regular online learning sessions.",
    },
    {
      title: "Who can participate",
      body: "Interested ICT students — no prior programming experience is required. Beginners are welcome; the program is designed to help you start from where you are.",
    },
    {
      title: "What you can expect to learn",
      body: "Intended learning areas include programming and web development, computer networking, databases and backend development, cybersecurity fundamentals, and advanced ICT skills.",
    },
    {
      title: "How online sessions work",
      body: "Sessions run online via Zoom or a group call, giving you the flexibility to learn from home while collaborating with fellow students on practical activities.",
    },
    {
      title: "Why practical ICT skills matter",
      body: "Hands-on ICT skills build confidence for higher studies, capstone projects, and future careers in technology — and they sharpen problem-solving in everyday life.",
    },
  ];

  return (
    <section id="program" className="scroll-mt-20 bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="The program"
          title="A practical introduction to ICT, taught by students, for students"
          description="Learn by doing: short online sessions, collaborative activities, and real projects across the major areas of information and communications technology."
        />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {points.map((p) => (
            <article key={p.title} className="rounded-xl border border-navy-100 bg-navy-50/60 p-6">
              <h3 className="flex items-center gap-2 text-base font-semibold text-navy-900">
                <span className="h-2 w-2 rounded-full bg-gold-400" aria-hidden="true" />
                {p.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-navy-600">{p.body}</p>
            </article>
          ))}
          <div className="rounded-xl border border-navy-200 bg-navy-800 p-6 text-white sm:col-span-2 lg:col-span-1">
            <h3 className="code-decoration text-sm font-semibold uppercase tracking-wider text-gold-400">
              Note
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-navy-100">
              Topics rotate and are announced by the program organizers. This program does not
              promise certificates, employment, or guaranteed mastery of any subject — it is an
              opportunity to learn, practice, and participate.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
