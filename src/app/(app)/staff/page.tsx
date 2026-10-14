import { pageContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import type { Key } from "@/lib/i18n";
import { Button, Card, Field, Flash, Input, PageTitle, Select } from "@/components/ui";
import { addStaff, updateStaff } from "./actions";

const roles = ["admin", "office", "dock", "crew"] as const;

export default async function StaffPage({ searchParams }: PageProps<"/staff">) {
  const sp = await searchParams;
  const { supabase, staff: me, t } = await pageContext(["admin"]);
  const { data: staff } = await supabase.from("staff").select("*").order("full_name");
  const canAdd = createAdminClient() !== null;

  return (
    <>
      <PageTitle>{t("staff")}</PageTitle>
      <Flash error={sp.error as string | undefined} ok={sp.ok as string | undefined} />

      <Card>
        <div className="space-y-3">
          {(staff ?? []).map((s) => (
            <form key={s.id} action={updateStaff} className="grid grid-cols-2 gap-3 sm:grid-cols-6 sm:items-end">
              <input type="hidden" name="id" value={s.id} />
              <div className="col-span-2">
                <Field label={t("name")}><Input name="full_name" defaultValue={s.full_name} required /></Field>
              </div>
              <Field label={t("role")}>
                <Select name="role" defaultValue={s.role} disabled={s.id === me.id}>
                  {roles.map((r) => (
                    <option key={r} value={r}>{t(`role_${r}` as Key)}</option>
                  ))}
                </Select>
              </Field>
              <Field label={t("language")}>
                <Select name="language" defaultValue={s.language}>
                  <option value="es">Español</option>
                  <option value="en">English</option>
                </Select>
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="active" defaultChecked={s.active} disabled={s.id === me.id} /> {t("active")}
              </label>
              <Button type="submit" variant="secondary">{t("save")}</Button>
            </form>
          ))}
        </div>
      </Card>

      <Card title={t("newStaff")}>
        {!canAdd ? (
          <p className="text-sm text-slate-600">{t("noSecretKey")}</p>
        ) : (
          <form action={addStaff} className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
            <Field label={t("name")}><Input name="full_name" required /></Field>
            <Field label={t("email")}><Input name="email" type="email" required /></Field>
            <Field label={t("tempPassword")}><Input name="password" type="text" minLength={8} required /></Field>
            <Field label={t("role")}>
              <Select name="role" defaultValue="office">
                {roles.map((r) => (
                  <option key={r} value={r}>{t(`role_${r}` as Key)}</option>
                ))}
              </Select>
            </Field>
            <Field label={t("language")}>
              <Select name="language" defaultValue="es">
                <option value="es">Español</option>
                <option value="en">English</option>
              </Select>
            </Field>
            <Button type="submit">{t("add")}</Button>
          </form>
        )}
      </Card>
    </>
  );
}
