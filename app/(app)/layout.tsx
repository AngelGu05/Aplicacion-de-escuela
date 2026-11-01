import { requireUser } from "@/lib/auth";
import { Header } from "@/components/Header";
import { SessionGuard } from "@/components/SessionGuard";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireUser();
  return (
    <>
      <Header profile={profile} />
      <SessionGuard />
      {children}
    </>
  );
}
