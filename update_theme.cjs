const fs = require('fs');
const path = require('path');

const cssContent = `
@import "tailwindcss";

@theme {
  --font-sans: "Inter", system-ui, sans-serif;
  
  --color-primary: var(--primary);
  --color-primary-dark: var(--primary-dark);
  --color-secondary: var(--secondary);
  
  --color-bg-base: var(--bg-base);
  --color-surface: var(--surface);
  --color-mint: var(--mint);
  
  --color-text-main: var(--text-main);
  --color-text-muted: var(--text-muted);
  --color-border-subtle: var(--border-subtle);

  --color-status-available: var(--status-available);
  --color-status-available-bg: var(--status-available-bg);
  --color-status-confirmed: var(--status-confirmed);
  --color-status-confirmed-bg: var(--status-confirmed-bg);
  --color-status-checked-in: var(--status-checked-in);
  --color-status-checked-in-bg: var(--status-checked-in-bg);
  --color-status-in-service: var(--status-in-service);
  --color-status-in-service-bg: var(--status-in-service-bg);
  --color-status-completed: var(--status-completed);
  --color-status-completed-bg: var(--status-completed-bg);
  --color-status-pending: var(--status-pending);
  --color-status-pending-bg: var(--status-pending-bg);
  --color-status-waitlist: var(--status-waitlist);
  --color-status-waitlist-bg: var(--status-waitlist-bg);
  --color-status-cancelled: var(--status-cancelled);
  --color-status-cancelled-bg: var(--status-cancelled-bg);
  --color-status-no-show: var(--status-no-show);
  --color-status-no-show-bg: var(--status-no-show-bg);
  --color-status-blocked: var(--status-blocked);
  --color-status-blocked-bg: var(--status-blocked-bg);
  
  --radius-card: 14px;
  --radius-btn: 10px;
  --radius-input: 10px;
  --radius-modal: 16px;
  
  --shadow-soft: 0 2px 10px rgba(0, 0, 0, 0.03);
}

@layer base {
  :root {
    --primary: #0EA5A4;
    --primary-dark: #087F7E;
    --secondary: #2563EB;
    
    --bg-base: #F8FAFC;
    --surface: #FFFFFF;
    --mint: #DFF7F5;
    
    --text-main: #0F172A;
    --text-muted: #64748B;
    --border-subtle: #E2E8F0;
    
    --status-available: #16A34A;
    --status-available-bg: #DCFCE7;
    --status-confirmed: #2563EB;
    --status-confirmed-bg: #DBEAFE;
    --status-checked-in: #0284C7;
    --status-checked-in-bg: #E0F2FE;
    --status-in-service: #7C3AED;
    --status-in-service-bg: #EDE9FE;
    --status-completed: #059669;
    --status-completed-bg: #D1FAE5;
    --status-pending: #D97706;
    --status-pending-bg: #FEF3C7;
    --status-waitlist: #EA580C;
    --status-waitlist-bg: #FFEDD5;
    --status-cancelled: #DC2626;
    --status-cancelled-bg: #FEE2E2;
    --status-no-show: #B91C1C;
    --status-no-show-bg: #FEE2E2;
    --status-blocked: #64748B;
    --status-blocked-bg: #F1F5F9;
  }

  @media (prefers-color-scheme: dark) {
    :root {
      --bg-base: #0F172A;
      --surface: #1E293B;
      --mint: #115E59;
      
      --text-main: #F8FAFC;
      --text-muted: #94A3B8;
      --border-subtle: #334155;
      
      --status-available-bg: #064E3B;
      --status-confirmed-bg: #1E3A8A;
      --status-checked-in-bg: #0C4A6E;
      --status-in-service-bg: #4C1D95;
      --status-completed-bg: #064E3B;
      --status-pending-bg: #78350F;
      --status-waitlist-bg: #7C2D12;
      --status-cancelled-bg: #7F1D1D;
      --status-no-show-bg: #7F1D1D;
      --status-blocked-bg: #334155;
      
      --status-available: #34D399;
      --status-confirmed: #60A5FA;
      --status-checked-in: #38BDF8;
      --status-in-service: #A78BFA;
      --status-completed: #34D399;
      --status-pending: #FBBF24;
      --status-waitlist: #FB923C;
      --status-cancelled: #F87171;
      --status-no-show: #F87171;
      --status-blocked: #94A3B8;
    }
  }
}

html, body {
  background-color: var(--bg-base);
  color: var(--text-main);
  margin: 0;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.rbc-calendar {
  background-color: var(--surface) !important;
  color: var(--text-main) !important;
  border: 1px solid var(--border-subtle) !important;
  border-radius: var(--radius-card);
  overflow: hidden;
}
.rbc-header {
  border-bottom: 1px solid var(--border-subtle) !important;
  color: var(--text-muted) !important;
  padding: 12px 0 !important;
  font-weight: 600 !important;
  text-transform: uppercase;
  font-size: 0.8rem;
}
.rbc-today {
  background-color: var(--bg-base) !important;
}
.rbc-time-view, .rbc-month-view {
  border: none !important;
}
.rbc-time-header {
  border-bottom: 1px solid var(--border-subtle) !important;
}
.rbc-day-bg, .rbc-month-row, .rbc-time-content, .rbc-time-slot {
  border-color: var(--border-subtle) !important;
}
.rbc-event {
  border-radius: 6px !important;
  padding: 4px 6px !important;
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05) !important;
}
`;

fs.writeFileSync('src/index.css', cssContent);

const btn = `import * as React from "react";
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
`;
fs.writeFileSync('src/components/ui/Button.tsx', btn);

const input = `import * as React from "react";
import { cn } from "../../utils/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex min-h-[44px] w-full rounded-input border border-border-subtle bg-surface px-3 py-2 text-sm text-text-main ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50",
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
`;
fs.writeFileSync('src/components/ui/Input.tsx', input);

const card = `import * as React from "react"
import { cn } from "../../utils/cn"

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("rounded-card border border-border-subtle bg-surface text-text-main shadow-soft", className)} {...props} />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(({ className, ...props }, ref) => (
  <h3 ref={ref} className={cn("text-lg font-semibold leading-none tracking-tight text-text-main", className)} {...props} />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm text-text-muted", className)} {...props} />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
`;
fs.writeFileSync('src/components/ui/Card.tsx', card);

function traverseAndReplace(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      traverseAndReplace(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      if (fullPath.includes('ui/Button') || fullPath.includes('ui/Input') || fullPath.includes('ui/Card')) continue;
      
      let c = fs.readFileSync(fullPath, 'utf8');
      c = c.replace(/bg-teal-700/g, 'bg-primary')
           .replace(/text-teal-700/g, 'text-primary')
           .replace(/border-teal-700/g, 'border-primary')
           .replace(/hover:bg-teal-800/g, 'hover:bg-primary-dark')
           .replace(/bg-teal-50/g, 'bg-mint')
           .replace(/text-teal-600/g, 'text-primary')
           .replace(/bg-slate-50/g, 'bg-bg-base')
           .replace(/bg-white/g, 'bg-surface')
           .replace(/text-slate-800/g, 'text-text-main')
           .replace(/text-slate-700/g, 'text-text-main')
           .replace(/text-slate-600/g, 'text-text-muted')
           .replace(/text-slate-500/g, 'text-text-muted')
           .replace(/text-slate-400/g, 'text-text-muted/60')
           .replace(/border-slate-200/g, 'border-border-subtle')
           .replace(/border-slate-300/g, 'border-border-subtle')
           .replace(/border-slate-100/g, 'border-border-subtle')
           .replace(/border-blue-200/g, 'border-primary/20')
           .replace(/border-teal-200/g, 'border-primary')
           .replace(/text-red-600/g, 'text-status-cancelled')
           .replace(/bg-red-50/g, 'bg-status-cancelled-bg')
           .replace(/border-red-200/g, 'border-status-cancelled')
           .replace(/bg-green-600/g, 'bg-status-completed')
           .replace(/hover:bg-green-700/g, 'opacity-90 hover:opacity-100')
           .replace(/rounded-xl/g, 'rounded-card')
           .replace(/rounded-2xl/g, 'rounded-card')
           .replace(/shadow-sm/g, 'shadow-soft');
      fs.writeFileSync(fullPath, c, 'utf8');
    }
  }
}

traverseAndReplace('src/pages');
traverseAndReplace('src/components');
