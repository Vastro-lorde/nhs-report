/* ──────────────────────────────────────────
   UI Component: Input
   ────────────────────────────────────────── */
import { forwardRef, useMemo, useState, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const isPassword = props.type === "password";
    const [showPassword, setShowPassword] = useState(false);

    const computedType = useMemo(() => {
      if (!isPassword) return props.type;
      return showPassword ? "text" : "password";
    }, [isPassword, props.type, showPassword]);

    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <div className={cn("relative", isPassword && "flex items-center")}>
          <input
            id={id}
            className={cn(
              "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50",
              isPassword && "pr-10",
              error && "border-red-500 focus:ring-red-500",
              className
            )}
            ref={ref}
            {...props}
            type={computedType}
          />
          {isPassword && (
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              disabled={props.disabled}
              className={cn(
                "absolute right-2 inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500",
                "hover:bg-gray-50 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-600",
                props.disabled && "pointer-events-none opacity-50"
              )}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          )}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
