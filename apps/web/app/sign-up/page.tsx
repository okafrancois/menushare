import { redirect } from "next/navigation";

export const metadata = { title: "Créer un compte" };

export default function SignUpPage() {
  redirect("/sign-in");
}
