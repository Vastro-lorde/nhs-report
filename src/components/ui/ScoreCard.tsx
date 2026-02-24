/* ──────────────────────────────────────────
   UI Component: KPI Scorecard
   ────────────────────────────────────────── */
import { Card, CardContent } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";

interface ScoreCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function ScoreCard({ title, value, subtitle, icon: Icon, trend, className }: ScoreCardProps) {
  return (
    <Card className={cn("", className)}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
            {subtitle && (
              <p
                className={cn(
                  "text-sm mt-1",
                  trend === "up" && "text-green-600",
                  trend === "down" && "text-red-600",
                  (!trend || trend === "neutral") && "text-gray-500"
                )}
              >
                {subtitle}
              </p>
            )}
          </div>
          {Icon && (
            <div className="p-3 bg-green-50 rounded-full">
              <Icon className="h-6 w-6 text-green-700" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
