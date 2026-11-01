import { requireAdmin } from "@/lib/auth";
import { AdminTabs } from "./AdminTabs";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <main className="container">
      <section className="page-head">
        <h1>Panel de administración</h1>
      </section>
      <AdminTabs />
      {children}
    </main>
  );
}
