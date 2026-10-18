import type { ComponentProps } from "react";

import { cn } from "#/lib/utils";

export const Label = ({ className, ...props }: ComponentProps<"label">) => (
  <label
    className={cn("text-sm leading-none font-medium select-none", className)}
    {...props}
  />
);
