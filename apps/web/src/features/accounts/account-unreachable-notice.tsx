import { useMessages } from "#/i18n/messages";

export const AccountUnreachableNotice = () => {
  const { t } = useMessages();

  return (
    <div className="flex flex-col items-start gap-2" role="status">
      <p className="text-pretty">{t.session.accountUnreachable}</p>
      <a className="font-medium underline underline-offset-4" href="/">
        {t.session.retry}
      </a>
    </div>
  );
};
