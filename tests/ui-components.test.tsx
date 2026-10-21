// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RegistrationForm } from "@/components/registration-form";
import { Hero } from "@/components/hero";
import { Faq, FinalCta } from "@/components/sections";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}));

/** UI tests: validation messaging, loading states, data preservation,
 *  accessible labeling, and CTA functionality. */

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  pushMock.mockReset();
  sessionStorage.clear();
});

afterEach(cleanup);

describe("RegistrationForm", () => {
  it("renders all required fields with accessible labels", () => {
    render(<RegistrationForm registrationOpen />);
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/grade level/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/preferred learning track/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/essential program-related communications/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/optional announcements/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /submit registration/i })).toBeInTheDocument();
  });

  it("shows understandable inline errors and preserves entered data when submitting invalid input", async () => {
    const user = userEvent.setup();
    render(<RegistrationForm registrationOpen />);

    await user.type(screen.getByLabelText(/full name/i), "J");
    await user.type(screen.getByLabelText(/email address/i), "not-an-email");
    await user.click(screen.getByRole("button", { name: /submit registration/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/at least 2 characters/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/valid email/i)).toBeInTheDocument();
      expect(screen.getByText(/please select your grade level/i)).toBeInTheDocument();
    });
    // Entered data is preserved.
    expect(screen.getByLabelText(/full name/i)).toHaveValue("J");
    expect(screen.getByLabelText(/email address/i)).toHaveValue("not-an-email");

    // No request was sent for an invalid form.
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("focuses the first invalid field after a failed submit", async () => {
    const user = userEvent.setup();
    render(<RegistrationForm registrationOpen />);
    await user.click(screen.getByRole("button", { name: /submit registration/i }));
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByLabelText(/full name/i));
    });
  });

  it("submits a valid form, shows a loading state, stores the reference, and navigates", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ ok: true, outcome: "created", reference: "MRMNHS-ABCDEF12", track: "computer-networking" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<RegistrationForm registrationOpen />);
    await user.type(screen.getByLabelText(/full name/i), "Juan Dela Cruz");
    await user.type(screen.getByLabelText(/email address/i), "juan@example.com");
    await user.selectOptions(screen.getByLabelText(/grade level/i), "grade_11");
    await user.selectOptions(screen.getByLabelText(/preferred learning track/i), "computer-networking");
    await user.click(screen.getByLabelText(/essential program-related communications/i));
    await user.click(screen.getByRole("button", { name: /submit registration/i }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/register/success");
    });

    // Reference handed off via sessionStorage (not a URL).
    const stored = JSON.parse(sessionStorage.getItem("mrmnhs_registration") ?? "{}");
    expect(stored.reference).toBe("MRMNHS-ABCDEF12");
    expect(stored.track).toBe("computer-networking");

    // The request body included the shared schema fields.
    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse(init.body as string);
    expect(body.email).toBe("juan@example.com");
    expect(body.idempotencyKey).toBeTruthy();

    vi.unstubAllGlobals();
  });

  it("prevents duplicate submissions while pending (button disabled)", async () => {
    const user = userEvent.setup();
    let resolveFetch: (r: Response) => void = () => undefined;
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<RegistrationForm registrationOpen />);
    await user.type(screen.getByLabelText(/full name/i), "Juan Dela Cruz");
    await user.type(screen.getByLabelText(/email address/i), "juan@example.com");
    await user.selectOptions(screen.getByLabelText(/grade level/i), "grade_11");
    await user.selectOptions(screen.getByLabelText(/preferred learning track/i), "programming-web-dev");
    await user.click(screen.getByLabelText(/essential program-related communications/i));

    const submit = screen.getByRole("button", { name: /submit registration/i });
    await user.click(submit);
    await waitFor(() => expect(submit).toBeDisabled());
    expect(screen.getByRole("button", { name: /submitting/i })).toBeInTheDocument();

    // Second click while pending does nothing (user-event ignores clicks on
    // disabled controls, matching real browser behavior).
    await user.click(submit);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch(jsonResponse({ ok: true, outcome: "created", reference: "MRMNHS-XYZ12345", track: "programming-web-dev" }));
    await waitFor(() => expect(pushMock).toHaveBeenCalled());
    vi.unstubAllGlobals();
  });

  it("shows the duplicate-registration message without navigating", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ ok: true, outcome: "duplicate", message: "A registration for this email address has already been received." })),
    );

    render(<RegistrationForm registrationOpen />);
    await user.type(screen.getByLabelText(/full name/i), "Juan Dela Cruz");
    await user.type(screen.getByLabelText(/email address/i), "juan@example.com");
    await user.selectOptions(screen.getByLabelText(/grade level/i), "grade_11");
    await user.selectOptions(screen.getByLabelText(/preferred learning track/i), "programming-web-dev");
    await user.click(screen.getByLabelText(/essential program-related communications/i));
    await user.click(screen.getByRole("button", { name: /submit registration/i }));

    await waitFor(() => {
      expect(screen.getByText(/already been received/i)).toBeInTheDocument();
    });
    expect(pushMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("shows a recoverable error when the network fails, keeping entered data", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    render(<RegistrationForm registrationOpen />);
    await user.type(screen.getByLabelText(/full name/i), "Juan Dela Cruz");
    await user.type(screen.getByLabelText(/email address/i), "juan@example.com");
    await user.selectOptions(screen.getByLabelText(/grade level/i), "grade_11");
    await user.selectOptions(screen.getByLabelText(/preferred learning track/i), "programming-web-dev");
    await user.click(screen.getByLabelText(/essential program-related communications/i));
    await user.click(screen.getByRole("button", { name: /submit registration/i }));

    await waitFor(() => {
      expect(screen.getByText(/your answers are still here/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/full name/i)).toHaveValue("Juan Dela Cruz");
    vi.unstubAllGlobals();
  });

  it("hides the honeypot field from users and assistive technology", () => {
    const { container } = render(<RegistrationForm registrationOpen />);
    const honeypot = container.querySelector("#reg-website")!;
    expect(honeypot).toHaveAttribute("tabindex", "-1");
    expect(honeypot.closest("[aria-hidden='true']")).not.toBeNull();
  });

  it("renders the closed state when registration is closed", () => {
    render(<RegistrationForm registrationOpen={false} />);
    expect(screen.getByText(/registration is currently closed/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /submit registration/i })).not.toBeInTheDocument();
  });
});

describe("landing page sections", () => {
  it("hero shows the headline, tagline, schedule, and working CTAs", () => {
    render(<Hero />);
    expect(screen.getByRole("heading", { name: /build your future in ICT/i })).toBeInTheDocument();
    expect(screen.getByText(/Learn\. Build\. Advance\./)).toBeInTheDocument();
    expect(screen.getByText(/7:00 PM–8:00 PM/)).toBeInTheDocument();
    expect(screen.getByText(/30–60 minutes/)).toBeInTheDocument();

    const registerCta = screen.getAllByRole("link", { name: /register now/i })[0];
    expect(registerCta).toHaveAttribute("href", "#register");
    const tracksCta = screen.getByRole("link", { name: /explore learning tracks/i });
    expect(tracksCta).toHaveAttribute("href", "#tracks");
  });

  it("final CTA links to the registration section", () => {
    render(<FinalCta />);
    expect(screen.getByRole("link", { name: /join the program/i })).toHaveAttribute("href", "#register");
  });

  it("FAQ answers the required questions", () => {
    render(<Faq />);
    for (const fragment of [
      /who can register/i,
      /prior programming experience/i,
      /is the program online/i,
      /how long does a session last/i,
      /how will i receive announcements/i,
      /guarantee acceptance/i,
    ]) {
      expect(screen.getAllByText(fragment).length).toBeGreaterThan(0);
    }
  });
});
