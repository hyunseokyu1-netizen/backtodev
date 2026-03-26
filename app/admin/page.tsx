import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import AdminPostList from "./_components/AdminPostList";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token || !(await verifyToken(token))) redirect("/admin/login");

  return <AdminPostList />;
}
