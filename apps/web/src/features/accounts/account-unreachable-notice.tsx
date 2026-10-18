export const AccountUnreachableNotice = () => (
  <div className="flex flex-col items-start gap-2" role="status">
    <p className="text-pretty">Savour couldn’t load your account.</p>
    <a className="font-medium underline underline-offset-4" href="/">
      Try again
    </a>
  </div>
);
