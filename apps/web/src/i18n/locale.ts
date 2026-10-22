import { DateTime, Option, Schema } from "effect";

export const Locale = Schema.Literals(["pt-BR", "en"]);

type PluralForms<A> = Readonly<
  Partial<Record<Intl.LDMLPluralRule, A>> & { readonly other: A }
>;

export const formatters = (locale: typeof Locale.Type) => {
  const day = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC",
  });

  const number = new Intl.NumberFormat(locale);
  const rules = new Intl.PluralRules(locale);

  return {
    plural: <A>(count: number, forms: PluralForms<A>): A =>
      forms[rules.select(count)] ?? forms.other,
    rating: (rating: number) => number.format(rating),
    visitDay: (date: string) =>
      DateTime.make(`${date}T00:00:00Z`).pipe(
        Option.map((visit) => DateTime.formatIntl(visit, day)),
        Option.getOrElse(() => date)
      ),
  };
};

export type Formatters = ReturnType<typeof formatters>;
