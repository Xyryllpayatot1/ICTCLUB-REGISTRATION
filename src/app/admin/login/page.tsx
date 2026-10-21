import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Admin sign in" };

/** Server wrapper: signed-in admins skip the login form entirely. */
export default async function AdminLoginPage() {
  const session = await getSession();
  if (session) {
    redirect("/admin");
  }
  return <LoginForm />;
}
