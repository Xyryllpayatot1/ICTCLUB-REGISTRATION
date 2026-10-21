import type { Metadata } from "next";
import Link from "next/link";
import { SCHOOL_NAME, CLUB_NAME, PROGRAM_NAME } from "@/lib/config/program";
import { getEnv } from "@/lib/config/env";

export const metadata: Metadata = {
  title: "Privacy notice",
  description: `Privacy notice for the ${PROGRAM_NAME} registration.`,
};

export const dynamic = "force-dynamic";

export default function PrivacyPage() {
  let contactEmail = "";
  try {
    contactEmail = getEnv().CONTACT_EMAIL;
  } catch {
    contactEmail = "";
  }

  return (
    <main id="main-content" className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
      <h1 className="text-3xl font-bold text-navy-900">Privacy notice</h1>
      <p className="mt-2 text-sm text-navy-500">
        {SCHOOL_NAME} — {CLUB_NAME} {PROGRAM_NAME}
      </p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-navy-700">
        <section>
          <h2 className="text-lg font-semibold text-navy-900">Who we are</h2>
          <p className="mt-2">
            This registration system is operated by the {CLUB_NAME} of the {SCHOOL_NAME} for the
            administration of the {PROGRAM_NAME}.
            {contactEmail ? (
              <>
                {" "}
                For any question about your data, contact{" "}
                <a className="text-navy-800 underline" href={`mailto:${contactEmail}`}>
                  {contactEmail}
                </a>
                {" "}or reach out to the program organizers through the school.
              </>
            ) : (
              " For any question about your data, reach out to the program organizers through the school."
            )}
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-navy-900">What information we collect</h2>
          <p className="mt-2">We collect only what is needed to administer the program:</p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Full name and, optionally, your preferred name</li>
            <li>Email address</li>
            <li>Grade level and, optionally, your section</li>
            <li>Your preferred learning track and optional experience level</li>
            <li>Optional learning goals and additional ICT interests</li>
            <li>Your communication preferences (essential vs. optional announcements)</li>
            <li>Technical records needed to run the service securely (registration timestamp, status, and security logs)</li>
          </ul>
          <p className="mt-2">
            We do <strong>not</strong> collect passwords, home addresses, government identification
            numbers, phone numbers, or payment information through this system.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-navy-900">Why we collect it</h2>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>To process your registration and send essential program communications (confirmations, participation instructions, schedule changes)</li>
            <li>To organize participants by learning track and grade level for the program</li>
            <li>To send optional program announcements, only if you explicitly opted in</li>
            <li>To keep the service secure (spam prevention, abuse monitoring)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-navy-900">Who can access it</h2>
          <p className="mt-2">
            Access is limited to authorized program organizers and administrators of this system.
            Student information is never shown on public pages. Data is stored in a managed
            database with access restricted to the application administrators.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-navy-900">How long we keep it</h2>
          <p className="mt-2">
            Registration records are retained only as long as needed for the current program run
            and any legitimate follow-up by the organizers, after which they are deleted or
            anonymized according to the school&apos;s retention policy. You may request deletion of your
            registration at any time by contacting the organizers.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-navy-900">Your choices and rights</h2>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Essential communications (confirmations, participation instructions) are required to run the program and cannot be disabled while your registration is active.</li>
            <li>Optional announcements are only sent if you gave separate, explicit consent — you may withdraw it at any time by contacting the organizers.</li>
            <li>You may request a copy of your data, a correction, or deletion of your registration by contacting the organizers.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-navy-900">Participants who are minors</h2>
          <p className="mt-2">
            Many participants are minors. Before this program launches publicly, the school must
            confirm the appropriate consent process (including parent or guardian consent where
            required by school policy and applicable law). If you are a parent or guardian with a
            concern, please contact the school directly.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-navy-900">Changes to this notice</h2>
          <p className="mt-2">
            Any material change to how student data is handled will be communicated through the
            school&apos;s official channels before it takes effect.
          </p>
        </section>
      </div>

      <p className="mt-10">
        <Link href="/" className="text-sm font-medium text-navy-800 underline">
          Back to the main page
        </Link>
      </p>
    </main>
  );
}
