// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { RegistrationSummaryClient } from "@/app/register/success/registration-summary-client";

describe("success page summary", () => {
  beforeEach(() => {
    sessionStorage.clear();
    cleanup();
  });

  it("displays the registration reference and track from sessionStorage", async () => {
    sessionStorage.setItem(
      "mrmnhs_registration",
      JSON.stringify({ reference: "MRMNHS-TESTTEST", track: "database-backend", at: Date.now() }),
    );
    render(<RegistrationSummaryClient />);
    // The value is read in useEffect — allow a microtask tick.
    await Promise.resolve();
    expect(await screen.findByTestId("registration-reference")).toHaveTextContent("MRMNHS-TESTTEST");
    expect(screen.getByText("Database and Backend Development")).toBeInTheDocument();
  });

  it("degrades gracefully when opened directly (no stored registration)", () => {
    render(<RegistrationSummaryClient />);
    expect(screen.getByTestId("registration-reference")).toHaveTextContent("—");
    expect(screen.getByText(/confirmation email sent to your inbox/i)).toBeInTheDocument();
  });

  it("ignores stale references older than 24 hours", () => {
    sessionStorage.setItem(
      "mrmnhs_registration",
      JSON.stringify({ reference: "MRMNHS-OLDOLD00", track: "database-backend", at: Date.now() - 90_000_000 }),
    );
    render(<RegistrationSummaryClient />);
    expect(screen.getByTestId("registration-reference")).toHaveTextContent("—");
  });
});
