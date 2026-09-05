import * as React from "react";
import { cn } from "../../utils/cn";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-btn text-sm font-semibold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 min-h-[44px]",
          {
            "bg-primary text-surface hover:bg-primary-dark shadow-soft": variant === "default",
            "border border-border-subtle bg-surface hover:bg-bg-base text-text-main": variant === "outline",
            "hover:bg-bg-base hover:text-text-main text-text-muted": variant === "ghost",
            "bg-status-cancelled text-surface hover:bg-red-700": variant === "destructive",
            "px-4 py-2": size === "default",
            "h-9 px-3 min-h-[36px]": size === "sm",
            "px-8 text-base": size === "lg",
            "w-11": size === "icon",
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
export { Button };
