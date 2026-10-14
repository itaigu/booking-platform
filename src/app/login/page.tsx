import { getLang, translator } from "@/lib/i18n";
import { Button, Field, Flash, Input } from "@/components/ui";
import { signIn } from "./actions";
import { LanguageSwitch } from "@/components/language-switch";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  const lang = await getLang();
  const t = translator(lang);
  const message = error === "notStaff" ? t("notStaff") : error ? t("loginFailed") : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">{t("appName")}</h1>
          <LanguageSwitch lang={lang} />
        </div>
        <Flash error={message} />
        <form action={signIn} className="flex flex-col gap-3">
          <Field label={t("email")}>
            <Input name="email" type="email" autoComplete="email" required />
          </Field>
          <Field label={t("password")}>
            <Input name="password" type="password" autoComplete="current-password" required />
          </Field>
          <Button type="submit">{t("signIn")}</Button>
        </form>
      </div>
    </main>
  );
}
