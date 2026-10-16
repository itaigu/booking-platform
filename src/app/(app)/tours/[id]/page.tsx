import { notFound } from "next/navigation";
import { pageContext } from "@/lib/auth";
import { TourFields, type Product } from "@/components/tour-fields";
import { Button, ButtonLink, Card, Flash, PageTitle } from "@/components/ui";
import { saveBoatsForTour, saveTour } from "../actions";

export default async function TourPage({ params, searchParams }: PageProps<"/tours/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, t } = await pageContext(["admin"]);

  const [{ data: p }, { data: tickets }, { data: boats }, { data: linked }] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).eq("one_off", false).maybeSingle<Product>(),
    supabase.from("ticket_types").select("price").eq("product_id", id).eq("active", true).order("id"),
    supabase.from("boats").select("id, name, max_guests").order("name"),
    supabase.from("product_boats").select("boat_id").eq("product_id", id),
  ]);
  if (!p) notFound();
  const linkedIds = new Set((linked ?? []).map((l) => l.boat_id));
  // Biggest boat linked to this tour, for tours saved before they had a guest limit.
  const boatMax = Math.max(0, ...(boats ?? []).filter((b) => linkedIds.has(b.id)).map((b) => b.max_guests)) || undefined;

  return (
    <>
      <PageTitle actions={<ButtonLink variant="secondary" href="/tours">‹ {t("tours")}</ButtonLink>}>{p.name_es || p.name_en}</PageTitle>
      <Flash error={sp.error as string | undefined} ok={sp.ok as string | undefined} />

      <Card title={t("details")}>
        <form action={saveTour}>
          <input type="hidden" name="id" value={p.id} />
          <TourFields p={p} t={t} boatMax={boatMax} guestPrice={tickets?.[0]?.price} />
          <div className="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-4">
            <Button type="submit">{t("saveChanges")}</Button>
          </div>
        </form>
      </Card>

      <Card title={t("whichBoats")}>
        <form action={saveBoatsForTour} className="flex flex-wrap items-center gap-4">
          <input type="hidden" name="product_id" value={p.id} />
          {(boats ?? []).map((b) => (
            <label key={b.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="boat_id" value={b.id} defaultChecked={linkedIds.has(b.id)} />
              {b.name} ({b.max_guests})
            </label>
          ))}
          <Button type="submit">{t("save")}</Button>
        </form>
      </Card>

    </>
  );
}
