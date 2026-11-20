import type { OrderStatus } from "@prisma/client";
import { ORDER_STATUS_FLOW, ORDER_STATUS_LABEL } from "@/lib/labels";
import { cn } from "@/lib/format";
import { CheckIcon } from "../icons";

/** Order Received → Awaiting Design → Awaiting Approval → In Production → Shipped → Delivered (design steps only when needed). */
export function StatusTimeline({ status, hasDesign }: { status: OrderStatus; hasDesign: boolean }) {
  if (status === "CANCELLED") return <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">This order was cancelled.</p>;
  const steps = ORDER_STATUS_FLOW.filter((s) => hasDesign || (s !== "AWAITING_DESIGN" && s !== "AWAITING_APPROVAL"));
  const current = steps.indexOf(status);
  return (
    <ol className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-0" aria-label="Order progress">
      {steps.map((s, i) => {
        const done = i < current;
        const now = i === current;
        return (
          <li key={s} className="flex items-center gap-3 sm:flex-1 sm:flex-col sm:gap-2 sm:text-center">
            <div className="flex items-center sm:w-full">
              <span className={cn("hidden h-0.5 flex-1 sm:block", i === 0 ? "invisible" : done || now ? "bg-blush-dusty" : "bg-line")} />
              <span
                className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 text-xs font-semibold",
                  done ? "border-blush-dusty bg-blush-dusty" : now ? "border-gold bg-white text-gold" : "border-line bg-white text-charcoal/40",
                )}
                aria-current={now ? "step" : undefined}
              >
                {done ? <CheckIcon size={14} /> : i + 1}
              </span>
              <span className={cn("hidden h-0.5 flex-1 sm:block", i === steps.length - 1 ? "invisible" : done ? "bg-blush-dusty" : "bg-line")} />
            </div>
            <span className={cn("text-xs", now ? "font-semibold" : done ? "" : "text-charcoal/50")}>{ORDER_STATUS_LABEL[s]}</span>
          </li>
        );
      })}
    </ol>
  );
}
