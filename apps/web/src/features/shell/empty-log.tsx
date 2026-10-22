import { useMessages } from "#/i18n/messages";

export const EmptyLog = () => (
  <p className="text-muted-foreground text-pretty">
    {useMessages().t.shell.emptyLog}
  </p>
);
