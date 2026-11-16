import Link from "next/link";
import { recoverInterrupted } from "@/lib/runner";
import { listStudies } from "@/lib/store";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function StudiesPage() {
  await recoverInterrupted();
  const studies = await listStudies();
  return (
    <>
      <h1>Studies</h1>
      {studies.length === 0 ? (
        <p className="muted">No studies yet. <Link href="/">Run the first one.</Link></p>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr><th>Study</th><th>Product</th><th>Target</th><th>Sessions</th><th>Status</th><th>Created</th></tr>
            </thead>
            <tbody>
              {studies.map((s) => (
                <tr key={s.id}>
                  <td><Link href={`/studies/${s.id}`}>{s.input.title}</Link></td>
                  <td>{s.product?.name ?? "–"}</td>
                  <td className="small muted">{new URL(s.input.targetUrl).host}</td>
                  <td>{s.sessions.filter((x) => x.status === "completed").length}/{s.sessions.length}</td>
                  <td><StatusBadge status={s.status} /></td>
                  <td className="small muted">
                    {new Date(s.createdAt).toLocaleString()}
                    {s.createdBy ? ` · ${s.createdBy}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
