import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import type { Lang } from "@/lib/i18n";

async function setLang(form: FormData) {
  "use server";
  const lang = form.get("lang") === "en" ? "en" : "es";
  (await cookies()).set("lang", lang, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
}

export function LanguageSwitch({ lang }: { lang: Lang }) {
  const other = lang === "es" ? "en" : "es";
  return (
    <form action={setLang}>
      <input type="hidden" name="lang" value={other} />
      <button type="submit" className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-100">
        {other === "en" ? "English" : "Español"}
      </button>
    </form>
  );
}
