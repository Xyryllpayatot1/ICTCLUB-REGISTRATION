import { describe, it, expect } from "vitest";
import { RegistrationSchema } from "@/lib/validation/schemas";
import { validRegistrationPayload } from "./helpers";
import { isValidReferenceFormat } from "@/lib/registration/reference";

describe("RegistrationSchema (shared client/server validation)", () => {
  it("accepts a valid minimal registration", () => {
    const result = RegistrationSchema.safeParse(validRegistrationPayload());
    expect(result.success).toBe(true);
  });

  it("accepts a full registration with all optional fields", () => {
    const result = RegistrationSchema.safeParse(
      validRegistrationPayload({
        preferredName: "Juancho",
        section: "ICT-1",
        experienceLevel: "beginner",
        learningGoals: "Learn web development",
        additionalInterests: "Robotics",
        marketingConsent: true,
      }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects missing required fields with messages", () => {
    const result = RegistrationSchema.safeParse({ essentialConsent: true });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("fullName");
      expect(paths).toContain("email");
      expect(paths).toContain("gradeLevel");
      expect(paths).toContain("track");
    }
  });

  it("rejects an invalid email address", () => {
    const result = RegistrationSchema.safeParse(validRegistrationPayload({ email: "not-an-email" }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/valid email/i);
    }
  });

  it("rejects an invalid learning track", () => {
    const result = RegistrationSchema.safeParse(validRegistrationPayload({ track: "quantum" }));
    expect(result.success).toBe(false);
  });

  it("rejects an invalid grade level", () => {
    const result = RegistrationSchema.safeParse(validRegistrationPayload({ gradeLevel: "grade_9" }));
    expect(result.success).toBe(false);
  });

  it("normalizes email to lowercase/trimmed", () => {
    const result = RegistrationSchema.safeParse(
      validRegistrationPayload({ email: "  Juan.DelaCruz@Example.COM " }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("juan.delacruz@example.com");
    }
  });

  it("trims whitespace on names and optional text fields", () => {
    const result = RegistrationSchema.safeParse(
      validRegistrationPayload({
        fullName: "  Juan Dela Cruz  ",
        preferredName: "  Juancho  ",
        section: "  ICT-1  ",
      }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fullName).toBe("Juan Dela Cruz");
      expect(result.data.preferredName).toBe("Juancho");
      expect(result.data.section).toBe("ICT-1");
    }
  });

  it("converts empty optional strings to undefined", () => {
    const result = RegistrationSchema.safeParse(
      validRegistrationPayload({ preferredName: "", section: "   ", experienceLevel: "" }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.preferredName).toBeUndefined();
      expect(result.data.section).toBeUndefined();
      expect(result.data.experienceLevel).toBeUndefined();
    }
  });

  it("enforces maximum field lengths", () => {
    const result = RegistrationSchema.safeParse(
      validRegistrationPayload({ fullName: "x".repeat(200), learningGoals: "y".repeat(2000) }),
    );
    expect(result.success).toBe(false);
  });

  it("requires explicit essential consent", () => {
    const result = RegistrationSchema.safeParse(
      validRegistrationPayload({ essentialConsent: false }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes("essential program"))).toBe(true);
    }
  });

  it("rejects an invalid idempotency key", () => {
    const result = RegistrationSchema.safeParse(
      validRegistrationPayload({ idempotencyKey: "not-a-uuid" }),
    );
    expect(result.success).toBe(false);
  });
});

describe("registration reference format", () => {
  it("matches the non-sequential reference shape", () => {
    expect(isValidReferenceFormat("MRMNHS-7KQF3X2B")).toBe(true);
    expect(isValidReferenceFormat("MRMNHS-short")).toBe(false);
    expect(isValidReferenceFormat("12345")).toBe(false);
  });
});
