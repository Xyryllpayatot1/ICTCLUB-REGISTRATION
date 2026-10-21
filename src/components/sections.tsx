import { SectionHeading, ButtonLink } from "@/components/ui";
import { getProgramConfig } from "@/lib/config/program";

const STEPS = [
  { title: "Register online", body: "Fill in the registration form with your details and choose your primary learning track." },
  { title: "Receive a registration confirmation", body: "We'll email you a registration reference once your submission is received." },
  { title: "Watch for official announcements", body: "Program announcements and participation instructions arrive in your inbox." },
  { title: "Join the designated online session", body: "Connect via Zoom or the designated group call at the scheduled time." },
  { title: "Learn, practice, and build", body: "Take part in discussions, activities, and hands-on projects." },
];

/** How it works — the registration-to-session journey as a numbered process. */
export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="How it works"
          title="From registration to your first session"
        />
        <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((step, i) => (
            <li key={step.title} className="relative rounded-xl border border-navy-100 bg-navy-50/60 p-5">
              <span className="code-decoration inline-flex h-8 w-8 items-center justify-center rounded-full bg-navy-800 text-sm font-bold text-gold-400">
                {i + 1}
              </span>
              <h3 className="mt-4 text-sm font-semibold text-navy-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-navy-600">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/**
 * Schedule section — the general program schedule (days, time, platform,
 * session length). All values come from configuration; no start date,
 * deadline, or meeting link is ever invented here.
 */
export function ScheduleSection() {
  const program = getProgramConfig();
  const items = [
    {
      label: "Days",
      value: program.schedule.replace("-", "\u2013"),
      note: "Weekly schedule",
    },
    {
      label: "Time",
      value: `${program.startTime}\u2013${program.endTime}`,
      note: program.timezoneLabel,
    },
    {
      label: "Platform",
      value: program.platformLabel,
      note: "Join from home",
    },
    {
      label: "Session length",
      value: "Approximately 30\u201360 minutes",
      note: "Depending on the topic and activities",
    },
  ];

  return (
    <section id="schedule" className="relative scroll-mt-20 overflow-hidden bg-navy-800 py-16 text-white sm:py-20">
      <div className="circuit-bg pointer-events-none absolute inset-0 opacity-50" aria-hidden="true" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Schedule"
          title="General program schedule"
          description="The regular weekly slot for the ICT Club Teaching Program. Announcements with session specifics are sent to registered participants."
          tone="dark"
        />
        <dl className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-navy-600 bg-navy-900/60 p-5"
            >
              <dt className="code-decoration text-xs font-semibold uppercase tracking-wider text-gold-400">
                {item.label}
              </dt>
              <dd className="mt-2 text-base font-semibold leading-snug text-white">
                {item.value}
              </dd>
              <dd className="mt-1 text-sm text-navy-200">{item.note}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "Who can register?",
    a: "The program is open to interested ICT students. Grade 11, Grade 12, and other students may register; the organizers may review registrations before confirming participation.",
  },
  {
    q: "Do I need prior programming experience?",
    a: "No. Beginners are welcome. The program is designed to introduce topics from the ground up, and experienced students can explore advanced tracks.",
  },
  {
    q: "Is the program online?",
    a: "Yes. Sessions are held online via Zoom or a group call, so you can join from home.",
  },
  {
    q: "What time are the sessions?",
    a: "Sessions run Sunday to Saturday, 7:00 PM to 8:00 PM Philippine Time (Asia/Manila).",
  },
  {
    q: "How long does a session last?",
    a: "The scheduled slot is one hour, but individual sessions may last approximately 30–60 minutes depending on the topic and activities.",
  },
  {
    q: "How will I receive announcements?",
    a: "Program announcements and participation instructions are sent to the email address you provide during registration, so please use an email address you check regularly.",
  },
  {
    q: "How can I update my registration?",
    a: "Contact the program organizers using the contact details published by the school and provide your registration reference. For your safety, registrations cannot be edited publicly by reference alone.",
  },
  {
    q: "Does submitting the form guarantee acceptance?",
    a: "No. Submitting the form registers your interest. If registration review is required, the organizers will confirm participation afterwards — submitting the form does not automatically guarantee acceptance.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 bg-navy-50 py-16 sm:py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <SectionHeading eyebrow="FAQ" title="Frequently asked questions" />
        <div className="mt-10 space-y-3">
          {FAQS.map((item) => (
            <details key={item.q} className="group rounded-xl border border-navy-100 bg-white p-5">
              <summary className="cursor-pointer list-none text-sm font-semibold text-navy-900 marker:content-none">
                <span className="flex items-center justify-between gap-4">
                  {item.q}
                  <span
                    aria-hidden="true"
                    className="select-none text-navy-400 transition-transform group-open:rotate-45 group-open:text-gold-600"
                  >
                    +
                  </span>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-navy-600">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Final call to action — closes the page and links into the registration flow. */
export function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-navy-900 py-16 text-white sm:py-20">
      <div className="h-1 w-full bg-gold-400" aria-hidden="true" />
      <div className="circuit-bg pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
      <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
        <p className="code-decoration mb-3 text-sm font-semibold uppercase tracking-[0.25em] text-gold-400">
          Learn. Build. Advance.
        </p>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Ready to Start Your ICT Journey?</h2>
        <p className="mt-4 text-lg text-navy-100">
          Register your interest today and take your first step into programming, networking, and
          beyond.
        </p>
        <div className="mt-8">
          <ButtonLink href="#register" className="px-8 py-3 text-base">
            Join the Program
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
