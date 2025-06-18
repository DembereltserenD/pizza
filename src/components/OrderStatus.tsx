import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, Truck, Package } from "lucide-react";

interface OrderStatusProps {
  status: "pending" | "accepted" | "on_delivery" | "delivered";
  className?: string;
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
}

const statusConfig = {
  pending: {
    label: "Хүлээгдэж байна",
    color: "bg-yellow-100 text-yellow-800 border-yellow-200",
    icon: Clock,
    dotColor: "bg-yellow-500",
  },
  accepted: {
    label: "Баталгаажсан",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    icon: CheckCircle,
    dotColor: "bg-blue-500",
  },
  on_delivery: {
    label: "Хүргэлтэнд гарсан",
    color: "bg-purple-100 text-purple-800 border-purple-200",
    icon: Truck,
    dotColor: "bg-purple-500",
  },
  delivered: {
    label: "Хүргэгдсэн",
    color: "bg-green-100 text-green-800 border-green-200",
    icon: Package,
    dotColor: "bg-green-500",
  },
};

const sizeConfig = {
  sm: {
    badge: "text-xs px-2 py-1",
    icon: "h-3 w-3",
    dot: "w-2 h-2",
  },
  md: {
    badge: "text-sm px-3 py-1",
    icon: "h-4 w-4",
    dot: "w-3 h-3",
  },
  lg: {
    badge: "text-base px-4 py-2",
    icon: "h-5 w-5",
    dot: "w-4 h-4",
  },
};

export function OrderStatus({
  status,
  className = "",
  showIcon = false,
  size = "md",
}: OrderStatusProps) {
  const config = statusConfig[status];
  const sizeStyles = sizeConfig[size];
  const Icon = config.icon;

  return (
    <Badge
      className={`${config.color} ${sizeStyles.badge} ${className} inline-flex items-center gap-1.5 font-medium border`}
    >
      {showIcon && <Icon className={sizeStyles.icon} />}
      {config.label}
    </Badge>
  );
}

// Progress indicator component for showing order status timeline
interface OrderStatusTimelineProps {
  currentStatus: "pending" | "accepted" | "on_delivery" | "delivered";
  className?: string;
}

const statusOrder = [
  "pending",
  "accepted",
  "on_delivery",
  "delivered",
] as const;

export function OrderStatusTimeline({
  currentStatus,
  className = "",
}: OrderStatusTimelineProps) {
  const currentIndex = statusOrder.indexOf(currentStatus);

  return (
    <div className={`flex items-center justify-between ${className}`}>
      {statusOrder.map((status, index) => {
        const config = statusConfig[status];
        const Icon = config.icon;
        const isActive = index <= currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <div key={status} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300
                  ${
                    isActive
                      ? `${config.color.replace("bg-", "bg-").replace("text-", "border-").split(" ")[0]} border-current`
                      : "bg-gray-100 border-gray-300 text-gray-400"
                  }
                  ${isCurrent ? "ring-4 ring-opacity-20 " + config.color.split(" ")[0].replace("bg-", "ring-") : ""}
                `}
              >
                <Icon className="h-5 w-5" />
              </div>
              <span
                className={`text-xs mt-2 font-medium ${
                  isActive ? config.color.split(" ")[1] : "text-gray-500"
                }`}
              >
                {config.label}
              </span>
            </div>
            {index < statusOrder.length - 1 && (
              <div className="flex-1 h-0.5 mx-4 bg-gray-200 relative">
                <div
                  className={`h-full transition-all duration-500 ${
                    index < currentIndex ? config.dotColor : "bg-gray-200"
                  }`}
                  style={{ width: index < currentIndex ? "100%" : "0%" }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Compact status indicator with just a dot and text
interface OrderStatusDotProps {
  status: "pending" | "accepted" | "on_delivery" | "delivered";
  className?: string;
}

export function OrderStatusDot({
  status,
  className = "",
}: OrderStatusDotProps) {
  const config = statusConfig[status];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`w-3 h-3 rounded-full ${config.dotColor}`} />
      <span className="text-sm font-medium text-gray-700">{config.label}</span>
    </div>
  );
}
