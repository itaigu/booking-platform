import { pageContext } from "@/lib/auth";
import { Button, Card, Field, Flash, Input, PageTitle } from "@/components/ui";
import { changePassword } from "./actions";

export default async function AccountPage({ searchParams }: PageProps<"/account">) {
  const sp = await searchParams;
  const { staff, t } = await pageContext();

  return (
    <>
      <PageTitle>{staff.full_name}</PageTitle>
      <Flash error={sp.error as string | undefined} ok={sp.ok as string | undefined} />
      <Card title={t("changePassword")}>
        <form action={changePassword} className="flex max-w-sm flex-col gap-3">
          <Field label={t("newPassword")} hint={t("passwordHint")}>
            <Input name="password" type="password" minLength={8} autoComplete="new-password" required />
          </Field>
          <Field label={t("repeatPassword")}>
            <Input name="repeat" type="password" minLength={8} autoComplete="new-password" required />
          </Field>
          <Button type="submit">{t("save")}</Button>
        </form>
      </Card>
    </>
  );
}
