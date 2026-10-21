import { CLUB_NAME, PROGRAM_NAME, TAGLINE, trackLabel, getProgramConfig } from "@/lib/config/program";
import { getEnv } from "@/lib/config/env";

/**
 * Email templates.
 *
 * Every template renders both an HTML body (table-based layout, inline styles
 * for broad client compatibility) and a plain-text alternative. All dynamic
 * values are HTML-escaped. Unconfirmed program details (meeting links, start
 * dates) are only rendered when actually configured — never invented.
 *
 * Visual identity matches the website: navy header, gold accent rule, white
 * surfaces, restrained red (not used here — nothing in these emails is an
 * error state), neutral gray for supporting text. Both official logos are
 * embedded from the site's public assets via absolute URLs.
 */

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const COLORS = {
  navy: "#132c5c",
  navySoft: "#1a3a78",
  yellow: "#f8d828",
  text: "#1f2933",
  muted: "#5b6b7c",
  border: "#dbe3ec",
  bg: "#f4f7fb",
};

/** Absolute URL for a public asset (logos must load in email clients). */
function assetUrl(path: string): string {
  const base = getEnv().APP_BASE_URL.replace(/\/+$/, "");
  return `${base}${path}`;
}

const SCHOOL_LOGO_URL = () => assetUrl("/images/mrmnhs-school-logo.png");
const CLUB_LOGO_URL = () => assetUrl("/images/ict-club-logo.jpg");

/**
 * Header: both official logos in white chips (works on any background and
 * keeps the artwork undistorted via object-fit:contain), followed by real
 * text — so the email stays readable when images are blocked.
 */
function brandHeader(): string {
  const chip = (src: string, alt: string, round = false) =>
    `<td style="padding:6px;background-color:#ffffff;border-radius:${round ? "50%" : "10px"};border:1px solid ${COLORS.border};">
       <img src="${src}" width="44" height="44" alt="${escapeHtml(alt)}" style="display:block;width:44px;height:44px;object-fit:contain;${round ? "border-radius:50%;" : ""}font-size:10px;color:${COLORS.muted};" />
     </td>`;
  return `<tr>
          <td style="background-color:${COLORS.navy};padding:20px 28px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate;">
              <tr>
                ${chip(SCHOOL_LOGO_URL(), "MRMNHS school logo")}
                <td style="width:10px;font-size:0;line-height:0;">&nbsp;</td>
                ${chip(CLUB_LOGO_URL(), "MRMNHS ICT Club logo", true)}
              </tr>
            </table>
            <p style="margin:12px 0 0;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:0.2px;">${CLUB_NAME}</p>
            <p style="margin:4px 0 0;font-size:13px;color:#c8d6e5;">${PROGRAM_NAME} &middot; ${escapeHtml(TAGLINE)}</p>
          </td>
        </tr>`;
}

const cellBase = "padding:8px 0;font-size:14px;";
const labelCell = `<td style="${cellBase}color:${COLORS.muted};">`;
const valueCell = (align = "right") => `<td style="${cellBase}color:${COLORS.text};text-align:${align};">`;
const dividerRow = `<tr><td colspan="2" style="border-top:1px solid ${COLORS.border};padding:0;line-height:0;">&nbsp;</td></tr>`;

function baseLayout(title: string, innerHtml: string): string {
  const program = getProgramConfig();
  const contactRow = program.contactEmail
    ? `<p style="margin:0 0 4px;font-size:13px;color:${COLORS.muted};">
         Questions? Contact us at <a href="mailto:${escapeHtml(program.contactEmail)}" style="color:${COLORS.navySoft};">${escapeHtml(program.contactEmail)}</a>
       </p>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:${COLORS.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${COLORS.text};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORS.bg};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:10px;overflow:hidden;border:1px solid ${COLORS.border};">
        ${brandHeader()}
        <tr><td style="height:4px;background-color:${COLORS.yellow};font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr>
          <td style="padding:28px;">
            ${innerHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 28px;border-top:1px solid ${COLORS.border};background-color:${COLORS.bg};">
            ${contactRow}
            <p style="margin:4px 0 0;font-size:12px;color:${COLORS.muted};">
              You received this message because a registration for the ${PROGRAM_NAME} of the ${CLUB_NAME} was submitted with your email address.
            </p>
            <p style="margin:8px 0 0;font-size:12px;color:${COLORS.muted};">${CLUB_NAME} &mdash; ${TAGLINE}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Shared "details" card: reference, track, schedule, platform, length. */
function detailsTable(rows: string): string {
  const program = getProgramConfig();
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORS.bg};border:1px solid ${COLORS.border};border-radius:8px;margin:0 0 20px;">
    <tr><td style="padding:0 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${rows}
        ${dividerRow}
        ${labelCell}Program schedule${valueCell()}${escapeHtml(program.scheduleLabel)}</td></tr>
        ${dividerRow}
        ${labelCell}Platform${valueCell()}${escapeHtml(program.platformLabel)}</td></tr>
        ${dividerRow}
        ${labelCell}Session length${valueCell()}Approx. 30&ndash;60 minutes</td></tr>
      </table>
    </td></tr>
  </table>`;
}

function referenceAndTrackRows(p: { reference: string; track: string }): string {
  return `
    ${labelCell}Registration reference</td>
    <td style="${cellBase}color:${COLORS.navy};text-align:right;font-weight:700;">${escapeHtml(p.reference)}</td></tr>
    ${dividerRow}
    ${labelCell}Learning track</td>
    ${valueCell()}${escapeHtml(trackLabel(p.track))}</td></tr>`;
}

// ---------------------------------------------------------------------------
// Payloads
// ---------------------------------------------------------------------------

export interface ConfirmationPayload {
  displayName: string;
  reference: string;
  track: string;
}

export interface StatusPayload {
  displayName: string;
  reference: string;
  track: string;
}

export interface AnnouncementPayload {
  displayName: string;
  subject: string;
  messageHtml: string;
  messageText: string;
  kind: "essential" | "marketing";
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

// ---------------------------------------------------------------------------
// Email A — registration confirmation
// ---------------------------------------------------------------------------

export function renderConfirmationEmail(p: ConfirmationPayload): RenderedEmail {
  const program = getProgramConfig();
  const subject = `Registration Received — ${PROGRAM_NAME}`;
  const html = baseLayout(
    subject,
    `
    <h1 style="margin:0 0 16px;font-size:22px;color:${COLORS.navy};">Registration received</h1>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">Hello ${escapeHtml(p.displayName)},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
      Thank you for registering for the <strong>${PROGRAM_NAME}</strong>! We have successfully received your registration.
    </p>
    ${detailsTable(referenceAndTrackRows(p))}
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">${escapeHtml(program.sessionLengthNote)}</p>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
      Please watch your email for official program announcements and further participation instructions.
    </p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${COLORS.muted};">
      Submitting your registration does not automatically confirm acceptance if registration review is required.
    </p>
    <p style="margin:0;font-size:15px;line-height:1.6;">We look forward to learning and building with you.</p>
    <p style="margin:16px 0 0;font-size:15px;"><strong>${CLUB_NAME}</strong><br /><span style="color:${COLORS.muted};">${TAGLINE}</span></p>
    `,
  );
  const text = [
    `Hello ${p.displayName},`,
    "",
    `Thank you for registering for the ${PROGRAM_NAME}!`,
    "",
    "We have successfully received your registration.",
    "",
    `Registration reference: ${p.reference}`,
    `Learning track: ${trackLabel(p.track)}`,
    `Program schedule: ${program.scheduleLabel}`,
    `Platform: ${program.platformLabel}`,
    program.sessionLengthNote,
    "",
    "Please watch your email for official program announcements and further participation instructions.",
    "Submitting your registration does not automatically confirm acceptance if registration review is required.",
    "",
    "We look forward to learning and building with you.",
    "",
    CLUB_NAME,
    TAGLINE,
  ].join("\n");
  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// Email B — approval / acceptance
// ---------------------------------------------------------------------------

export function renderApprovalEmail(
  p: StatusPayload & { meetingUrl?: string | null; startDate?: string | null },
): RenderedEmail {
  const program = getProgramConfig();
  const subject = `Registration Approved — ${PROGRAM_NAME}`;
  let extraRows = "";
  if (program.startDate) {
    extraRows += `${dividerRow}${labelCell}Program starts${valueCell()}${escapeHtml(program.startDate)}</td></tr>`;
  }
  if (program.meetingUrl) {
    extraRows += `${dividerRow}${labelCell}Online meeting</td><td style="${cellBase}text-align:right;"><a href="${escapeHtml(program.meetingUrl)}" style="color:${COLORS.navySoft};font-weight:600;">Join the session</a></td></tr>`;
  }
  const html = baseLayout(
    subject,
    `
    <h1 style="margin:0 0 16px;font-size:22px;color:${COLORS.navy};">You're approved!</h1>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">Hello ${escapeHtml(p.displayName)},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
      Good news &mdash; your registration for the <strong>${PROGRAM_NAME}</strong> has been <strong>approved</strong>. Welcome to the program!
    </p>
    ${detailsTable(referenceAndTrackRows(p) + extraRows)}
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;"><strong>Next steps</strong></p>
    <ol style="margin:0 0 16px;padding-left:22px;font-size:15px;line-height:1.8;">
      <li>Watch your inbox for session links and announcements from the organizers.</li>
      <li>Be online a few minutes before the scheduled session time (${escapeHtml(program.scheduleLabel)}).</li>
      <li>Have your learning materials ready and participate in the activities.</li>
    </ol>
    ${
      program.meetingUrl
        ? ""
        : `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${COLORS.muted};">Meeting details will be shared by the program organizers through official announcements once confirmed.</p>`
    }
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">We look forward to seeing you online. ${escapeHtml(TAGLINE)}</p>
    <p style="margin:0;font-size:15px;"><strong>${CLUB_NAME}</strong></p>
    `,
  );
  const textLines = [
    `Hello ${p.displayName},`,
    "",
    `Good news — your registration for the ${PROGRAM_NAME} has been approved. Welcome to the program!`,
    "",
    `Registration reference: ${p.reference}`,
    `Learning track: ${trackLabel(p.track)}`,
    `Program schedule: ${program.scheduleLabel}`,
    `Platform: ${program.platformLabel}`,
  ];
  if (program.startDate) textLines.push(`Program starts: ${program.startDate}`);
  if (program.meetingUrl) textLines.push(`Online meeting: ${program.meetingUrl}`);
  textLines.push(
    "",
    "Next steps:",
    "1. Watch your inbox for session links and announcements from the organizers.",
    "2. Be online a few minutes before the scheduled session time.",
    "3. Have your learning materials ready and participate in the activities.",
  );
  if (!program.meetingUrl) {
    textLines.push(
      "",
      "Meeting details will be shared by the program organizers through official announcements once confirmed.",
    );
  }
  textLines.push("", `We look forward to seeing you online. ${TAGLINE}`, "", CLUB_NAME, TAGLINE);
  return { subject, html, text: textLines.join("\n") };
}

// ---------------------------------------------------------------------------
// Email C — waitlist notification
// ---------------------------------------------------------------------------

export function renderWaitlistEmail(p: StatusPayload): RenderedEmail {
  const program = getProgramConfig();
  const subject = `Waitlist Confirmation — ${PROGRAM_NAME}`;
  const html = baseLayout(
    subject,
    `
    <h1 style="margin:0 0 16px;font-size:22px;color:${COLORS.navy};">You're on the waitlist</h1>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">Hello ${escapeHtml(p.displayName)},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
      Thank you for registering for the <strong>${PROGRAM_NAME}</strong>. Your registration is currently on the <strong>waitlist</strong>.
    </p>
    ${detailsTable(referenceAndTrackRows(p))}
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
      Being on the waitlist means the program has reached its current capacity for your track, but spots may open up.
      If a slot becomes available, the organizers will notify you by email with the next steps.
    </p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
      No further action is needed from you right now &mdash; simply keep watching your inbox for updates.
    </p>
    <p style="margin:0;font-size:15px;"><strong>${CLUB_NAME}</strong><br /><span style="color:${COLORS.muted};">${TAGLINE}</span></p>
    `,
  );
  const text = [
    `Hello ${p.displayName},`,
    "",
    `Thank you for registering for the ${PROGRAM_NAME}. Your registration is currently on the waitlist.`,
    "",
    `Registration reference: ${p.reference}`,
    `Learning track: ${trackLabel(p.track)}`,
    `Program schedule: ${program.scheduleLabel}`,
    `Platform: ${program.platformLabel}`,
    "",
    "Being on the waitlist means the program has reached its current capacity for your track, but spots may open up.",
    "If a slot becomes available, the organizers will notify you by email with the next steps.",
    "No further action is needed from you right now — simply keep watching your inbox for updates.",
    "",
    CLUB_NAME,
    TAGLINE,
  ].join("\n");
  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// Email D — decline / cancellation
// ---------------------------------------------------------------------------

export function renderDeclineEmail(
  p: StatusPayload & { note?: string | null },
  kind: "declined" | "cancelled",
): RenderedEmail {
  const subject =
    kind === "declined"
      ? `Registration Update — ${PROGRAM_NAME}`
      : `Registration Cancelled — ${PROGRAM_NAME}`;
  const intro =
    kind === "declined"
      ? `Thank you for your interest in the <strong>${PROGRAM_NAME}</strong>. After review, we are unable to move forward with your registration for this run of the program.`
      : `Your registration for the <strong>${PROGRAM_NAME}</strong> has been cancelled as requested or per the organizers' update.`;
  const html = baseLayout(
    subject,
    `
    <h1 style="margin:0 0 16px;font-size:22px;color:${COLORS.navy};">An update on your registration</h1>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">Hello ${escapeHtml(p.displayName)},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${intro}</p>
    ${detailsTable(referenceAndTrackRows(p))}
    ${p.note ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${COLORS.muted};">Note from the organizers: ${escapeHtml(p.note)}</p>` : ""}
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
      This decision only concerns your own registration. If future sessions or programs open, you are welcome to register again then.
    </p>
    <p style="margin:0;font-size:15px;"><strong>${CLUB_NAME}</strong><br /><span style="color:${COLORS.muted};">${TAGLINE}</span></p>
    `,
  );
  const textLines = [
    `Hello ${p.displayName},`,
    "",
    kind === "declined"
      ? `Thank you for your interest in the ${PROGRAM_NAME}. After review, we are unable to move forward with your registration for this run of the program.`
      : `Your registration for the ${PROGRAM_NAME} has been cancelled as requested or per the organizers' update.`,
    "",
    `Registration reference: ${p.reference}`,
    `Learning track: ${trackLabel(p.track)}`,
  ];
  if (p.note) textLines.push("", `Note from the organizers: ${p.note}`);
  textLines.push(
    "",
    "This decision only concerns your own registration. If future sessions or programs open, you are welcome to register again then.",
    "",
    CLUB_NAME,
    TAGLINE,
  );
  return { subject, html, text: textLines.join("\n") };
}

// ---------------------------------------------------------------------------
// Email E — program announcement
// ---------------------------------------------------------------------------

/** Convert an admin-written plain-text message into simple, safe HTML paragraphs. */
export function messageToHtml(message: string): string {
  return message
    .split(/\r?\n\r?\n+/)
    .map(
      (para) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">${escapeHtml(para).replaceAll("\n", "<br />")}</p>`,
    )
    .join("");
}

export function renderAnnouncementEmail(p: AnnouncementPayload): RenderedEmail {
  const subject = p.subject;
  const notice =
    p.kind === "marketing"
      ? `<p style="margin:0 0 16px;font-size:12px;color:${COLORS.muted};">You are receiving this optional update because you opted in to program announcements when you registered.</p>`
      : `<p style="margin:0 0 16px;font-size:12px;color:${COLORS.muted};">This is an essential program announcement for registered participants.</p>`;
  const html = baseLayout(
    subject,
    `
    <h1 style="margin:0 0 16px;font-size:20px;color:${COLORS.navy};">Program announcement</h1>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">Hello ${escapeHtml(p.displayName)},</p>
    ${p.messageHtml}
    ${notice}
    <p style="margin:16px 0 0;font-size:15px;"><strong>${CLUB_NAME}</strong><br /><span style="color:${COLORS.muted};">${TAGLINE}</span></p>
    `,
  );
  const text = [`Hello ${p.displayName},`, "", p.messageText, "", CLUB_NAME, TAGLINE].join("\n");
  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export type EmailTemplateKind =
  | "confirmation"
  | "approval"
  | "waitlist"
  | "decline"
  | "cancelled"
  | "announcement";

export interface RenderInput {
  kind: EmailTemplateKind;
  payload: Record<string, unknown>;
}

export function renderEmail({ kind, payload }: RenderInput): RenderedEmail {
  switch (kind) {
    case "confirmation":
      return renderConfirmationEmail(payload as unknown as ConfirmationPayload);
    case "approval":
      return renderApprovalEmail(payload as unknown as StatusPayload);
    case "waitlist":
      return renderWaitlistEmail(payload as unknown as StatusPayload);
    case "decline":
      return renderDeclineEmail(payload as unknown as StatusPayload, "declined");
    case "cancelled":
      return renderDeclineEmail(payload as unknown as StatusPayload, "cancelled");
    case "announcement":
      return renderAnnouncementEmail(payload as unknown as AnnouncementPayload);
    default: {
      const exhaustive: never = kind;
      throw new Error(`Unknown email template kind: ${String(exhaustive)}`);
    }
  }
}
