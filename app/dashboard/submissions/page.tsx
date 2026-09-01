import { redirect } from "next/navigation";

export default async function SubmissionsPage({ searchParams }: { searchParams: Promise<{ submission?: string }> }) {
  const query = await searchParams;
  redirect(query.submission ? `/dashboard/crm?submission=${encodeURIComponent(query.submission)}` : "/dashboard/crm");
}
