import type { ComponentProps } from "react";

import { cn } from "#/lib/utils";

export const Input = ({ className, ...props }: ComponentProps<"input">) => (
  <input
    className={cn(
      "border-border bg-background placeholder:text-muted-foreground focus-visible:outline-primary aria-invalid:border-destructive h-11 w-full min-w-0 rounded-lg border px-3 text-base focus-visible:outline-2 focus-visible:-outline-offset-1",
      className
    )}
    {...props}
  />
);
