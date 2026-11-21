import Sidebar from "@/components/Sidebar";
import { isStaff, requireMember } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireMember();
  return (
    <div className="shell">
      <Sidebar name={me.display_name} staff={isStaff(me)} />
      <main className="content">{children}</main>
    </div>
  );
}
