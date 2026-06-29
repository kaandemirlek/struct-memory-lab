import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "default" | "sm" | "icon";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-accent-foreground hover:bg-accent-hover",
  secondary: "border border-border bg-surface hover:bg-surface-muted",
  ghost: "hover:bg-surface-muted",
  danger: "text-danger hover:bg-danger/10",
};

const SIZES: Record<Size, string> = {
  default: "px-3 py-1.5 text-sm",
  sm: "px-2 py-1 text-xs",
  icon: "h-8 w-8 text-sm",
};

// Shared button so actions look consistent across the app.
export default function Button({
  variant = "secondary",
  size = "default",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 ${SIZES[size]} ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
