import Link from "next/link";
import { pageContext } from "@/lib/auth";
import { fmtMoney } from "@/lib/format";
import { TourFields, type Product } from "@/components/tour-fields";
import { Badge, Button, Card, Flash, PageTitle } from "@/components/ui";
import { saveTour } from "./actions";

export default async function ToursPage({ searchParams }: PageProps<"/tours">) {
  const sp = await searchParams;
  const { supabase, lang, t } = await pageContext(["admin"]);
  const { data } = await supabase.from("products").select("*, ticket_types(price)").order("active", { ascending: false }).order("name_en");
  const tours = (data ?? []) as (Product & { ticket_types: { price: number }[] })[];

  return (
    <>
      <PageTitle>{t("tours")}</PageTitle>
      <Flash error={sp.error as string | undefined} />
      <Card>
        <ul className="divide-y divide-slate-100">
          {tours.map((p) => (
            <li key={p.id}>
              <Link href={`/tours/${p.id}`} className="flex flex-wrap items-center gap-3 py-2 hover:bg-slate-50">
                <span className="flex-1 font-medium">{lang === "es" ? p.name_es : p.name_en}</span>
                <Badge tone={p.kind === "private" ? "sky" : "slate"}>{t(p.kind)}</Badge>
                <span className="w-40 text-sm text-slate-600">
                  {p.kind === "private"
                    ? fmtMoney(p.base_price)
                    : p.ticket_types.length
                      ? `${t("from").toLowerCase()} ${fmtMoney(Math.min(...p.ticket_types.map((x) => x.price)))}`
                      : "–"}
                </span>
                {!p.active && <Badge>{t("inactive")}</Badge>}
              </Link>
            </li>
          ))}
        </ul>
      </Card>
      <Card title={t("newTour")}>
        <form action={saveTour}>
          <TourFields t={t} />
          <Button type="submit" className="mt-4">{t("add")}</Button>
        </form>
      </Card>
    </>
  );
}
