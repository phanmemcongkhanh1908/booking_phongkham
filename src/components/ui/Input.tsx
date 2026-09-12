import * as React from "react";
import { cn } from "../../utils/cn";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex min-h-[44px] w-full rounded-xl border border-border-subtle bg-surface px-3.5 py-2.5 text-[13px] font-medium text-text-main ring-offset-background file:border-0 file:bg-transparent file:text-[13px] file:font-medium placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10 focus-visible:border-primary disabled:cursor-not-allowed disabled:bg-bg-base disabled:text-text-muted transition-all",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
