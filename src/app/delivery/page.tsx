"use client";

import { useEffect, useState } from "react";
import {
  supabase,
  Order,
  Pizza,
  formatPrice,
  formatTime,
} from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Phone,
  MapPin,
  Clock,
  Package,
  Truck,
  CheckCircle,
  LogOut,
  RefreshCw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";

interface OrderWithPizzas extends Order {
  pizzas: { pizza: Pizza; quantity: number }[];
}

function DeliveryDashboard() {
  const [orders, setOrders] = useState<OrderWithPizzas[]>([]);
  const [pizzas, setPizzas] = useState<Pizza[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null);
  const [previousOrderIds, setPreviousOrderIds] = useState<Set<string>>(
    new Set(),
  );
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
    const cleanup = setupRealtimeSubscription();
    requestNotificationPermission();

    // Set up page visibility change listener to refetch when page becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchData();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (cleanup) cleanup();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const fetchData = async () => {
    try {
      if (!supabase) return;

      // Fetch only paid orders (as per README requirement)
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .eq("is_paid", true)
        .in("status", ["pending", "accepted", "on_delivery"])
        .order("created_at", { ascending: false });

      if (ordersError) throw ordersError;

      // Fetch pizzas
      const { data: pizzasData, error: pizzasError } = await supabase
        .from("pizzas")
        .select("*");

      if (pizzasError) throw pizzasError;
      setPizzas(pizzasData || []);

      // Create pizza lookup map
      const pizzaMap = new Map<string, Pizza>();
      pizzasData?.forEach((pizza) => {
        pizzaMap.set(pizza.id, pizza);
      });

      // Combine orders with pizza details
      const ordersWithPizzas: OrderWithPizzas[] = (ordersData || []).map(
        (order) => ({
          ...order,
          pizzas: order.pizza_items.map((item: any) => ({
            pizza: pizzaMap.get(item.pizza_id)!,
            quantity: item.quantity,
          })),
        }),
      );

      // Check for new orders and show notifications
      if (!loading && ordersWithPizzas.length > 0) {
        checkForNewOrders(ordersWithPizzas);
      }

      setOrders(ordersWithPizzas);

      // Update previous order IDs for next comparison
      setPreviousOrderIds(new Set(ordersWithPizzas.map((order) => order.id)));
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    if (!supabase) return;

    const channel = supabase
      .channel("delivery-orders")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          console.log("New order received:", payload);
          const newOrder = payload.new as Order;

          // Only show notification for paid orders
          if (newOrder.is_paid) {
            // Show immediate notification without waiting for fetch
            toast({
              title: "🍕 Шинэ захиалга ирлээ!",
              description: `Захиалга #${newOrder.id.slice(-8)} - ${newOrder.building}`,
              duration: 10000,
            });

            playNotificationSound();

            if ("vibrate" in navigator) {
              navigator.vibrate([300, 100, 300, 100, 300]);
            }

            flashPageTitle();
          }

          // Fetch fresh data to get the complete order with pizza details
          setTimeout(() => fetchData(), 1000);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          console.log("Order updated:", payload);
          fetchData();
        },
      )
      .subscribe((status) => {
        console.log("Realtime subscription status:", status);
        if (status === "SUBSCRIBED") {
          toast({
            title: "✅ Холболт амжилттай",
            description: "Шинэ захиалгын мэдэгдэл идэвхтэй",
            duration: 3000,
          });
        } else if (status === "CHANNEL_ERROR") {
          toast({
            title: "❌ Холболтын алдаа",
            description: "Шинэ захиалгын мэдэгдэл ажиллахгүй байна",
            duration: 5000,
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const requestNotificationPermission = async () => {
    if ("Notification" in window) {
      if (Notification.permission === "default") {
        try {
          const permission = await Notification.requestPermission();
          if (permission === "granted") {
            toast({
              title: "✅ Мэдэгдэл зөвшөөрөгдсөн",
              description: "Та одоо шинэ захиалгын мэдэгдэл авах боломжтой",
              duration: 3000,
            });
          } else {
            toast({
              title: "❌ Мэдэгдэл татгалзсан",
              description: "Шинэ захиалгын мэдэгдэл ажиллахгүй",
              duration: 5000,
            });
          }
        } catch (error) {
          console.log("Notification permission request failed:", error);
        }
      } else if (Notification.permission === "denied") {
        toast({
          title: "⚠️ Мэдэгдэл хориглосон",
          description: "Тохиргооноос мэдэгдэлийг зөвшөөрнө үү",
          duration: 5000,
        });
      }
    } else {
      toast({
        title: "❌ Мэдэгдэл дэмжигдэхгүй",
        description: "Таны хөтөч мэдэгдэлийг дэмждэггүй",
        duration: 5000,
      });
    }
  };

  const playNotificationSound = () => {
    try {
      // Create a more attention-grabbing notification sound
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();

      // Create multiple tones for a more distinctive sound
      const playTone = (
        frequency: number,
        startTime: number,
        duration: number,
      ) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.setValueAtTime(frequency, startTime);
        gainNode.gain.setValueAtTime(0.4, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };

      const currentTime = audioContext.currentTime;
      // Play a sequence of tones
      playTone(800, currentTime, 0.15);
      playTone(1000, currentTime + 0.2, 0.15);
      playTone(800, currentTime + 0.4, 0.15);
      playTone(1200, currentTime + 0.6, 0.2);
    } catch (error) {
      console.log("Could not play notification sound:", error);
    }
  };

  const showBrowserNotification = (orderInfo: string, orderId: string) => {
    if ("Notification" in window && Notification.permission === "granted") {
      const notification = new Notification("🍕 Шинэ захиалга ирлээ!", {
        body: orderInfo,
        icon: "/favicon.ico",
        tag: `order-${orderId}`,
        requireInteraction: true,
        badge: "/favicon.ico",
        timestamp: Date.now(),
        silent: false,
        renotify: true,
        data: {
          orderId: orderId,
          url: window.location.href,
        },
      });

      // Handle notification clicks
      notification.onclick = () => {
        // Focus the window and bring it to front
        if (window.parent) {
          window.parent.focus();
        }
        window.focus();

        // Close the notification
        notification.close();

        // Scroll to the order in the table if possible
        const orderRow = document.querySelector(`[data-order-id="${orderId}"]`);
        if (orderRow) {
          orderRow.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      };

      // Handle notification errors
      notification.onerror = (error) => {
        console.error("Notification error:", error);
      };

      // Auto-close after 60 seconds if not interacted with
      setTimeout(() => {
        notification.close();
      }, 60000);
    }
  };

  const checkForNewOrders = (currentOrders: OrderWithPizzas[]) => {
    if (previousOrderIds.size === 0) {
      // First load, don't show notifications
      return;
    }

    const newOrders = currentOrders.filter(
      (order) => !previousOrderIds.has(order.id) && order.status === "pending",
    );

    if (newOrders.length > 0) {
      // Flash the page title to get attention
      flashPageTitle();
    }

    newOrders.forEach((order) => {
      const pizzaNames = order.pizzas
        .map((item) => `${item.pizza.name} (${item.quantity})`)
        .join(", ");

      const orderInfo = `${pizzaNames} - ${order.building}, ${order.floor}-р давхар`;

      // Show toast notification with action buttons
      toast({
        title: "🍕 Шинэ захиалга ирлээ!",
        description: orderInfo,
        duration: 15000, // 15 seconds
        action: {
          altText: "Хүлээн авах",
          onClick: () => updateOrderStatus(order.id, "accepted"),
        },
      });

      // Play sound
      playNotificationSound();

      // Show browser notification
      showBrowserNotification(orderInfo, order.id);

      // Vibrate if supported
      if ("vibrate" in navigator) {
        navigator.vibrate([200, 100, 200]);
      }
    });
  };

  const flashPageTitle = () => {
    const originalTitle = document.title;
    let flashCount = 0;
    const maxFlashes = 10;

    const flashInterval = setInterval(() => {
      document.title =
        flashCount % 2 === 0 ? "🔔 ШИНЭ ЗАХИАЛГА!" : originalTitle;
      flashCount++;

      if (flashCount >= maxFlashes) {
        clearInterval(flashInterval);
        document.title = originalTitle;
      }
    }, 500);
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    if (!supabase) return;

    setUpdatingOrder(orderId);

    try {
      const updateData: any = { status: newStatus };

      // If marking as delivered, set delivered_at timestamp
      if (newStatus === "delivered") {
        updateData.delivered_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("orders")
        .update(updateData)
        .eq("id", orderId);

      if (error) throw error;

      // Refresh data
      fetchData();
    } catch (error) {
      console.error("Error updating order status:", error);
      alert("Захиалгын төлөв шинэчлэхэд алдаа гарлаа");
    } finally {
      setUpdatingOrder(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: { [key: string]: "default" | "secondary" | "destructive" } =
      {
        pending: "secondary",
        accepted: "default",
        on_delivery: "default",
        delivered: "default",
      };

    const labels: { [key: string]: string } = {
      pending: "Хүлээгдэж байна",
      accepted: "Хүлээн авсан",
      on_delivery: "Хүргэж байна",
      delivered: "Хүргэгдсэн",
    };

    return (
      <Badge variant={variants[status] || "default"}>
        {labels[status] || status}
      </Badge>
    );
  };

  const getNextStatus = (currentStatus: string) => {
    switch (currentStatus) {
      case "pending":
        return "accepted";
      case "accepted":
        return "on_delivery";
      case "on_delivery":
        return "delivered";
      default:
        return null;
    }
  };

  const getNextStatusLabel = (currentStatus: string) => {
    switch (currentStatus) {
      case "pending":
        return "Хүлээн авах";
      case "accepted":
        return "Хүргэлтэнд гаргах";
      case "on_delivery":
        return "Хүргэгдсэн гэж тэмдэглэх";
      default:
        return null;
    }
  };

  const getNextStatusIcon = (currentStatus: string) => {
    switch (currentStatus) {
      case "pending":
        return <Package className="h-4 w-4" />;
      case "accepted":
        return <Truck className="h-4 w-4" />;
      case "on_delivery":
        return <CheckCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    router.push("/login");
  };

  const getPizzaNames = (pizzaItems: { pizza: Pizza; quantity: number }[]) => {
    return pizzaItems
      .map((item) => `${item.pizza.name} (${item.quantity})`)
      .join(", ");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-orange-600" />
          <p className="text-lg text-gray-600">Захиалга ачааллаж байна...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-orange-600">
                🍕 Гоё пицца - Хүргэлт
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                onClick={fetchData}
                variant="outline"
                size="sm"
                className="flex items-center"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Шинэчлэх
              </Button>
              <div className="flex items-center text-sm">
                <div
                  className={`w-2 h-2 rounded-full animate-pulse mr-2 ${
                    typeof window !== "undefined" &&
                    "Notification" in window &&
                    Notification.permission === "granted"
                      ? "bg-green-500 text-green-600"
                      : "bg-yellow-500 text-yellow-600"
                  }`}
                ></div>
                <span
                  className={
                    typeof window !== "undefined" &&
                    "Notification" in window &&
                    Notification.permission === "granted"
                      ? "text-green-600"
                      : "text-yellow-600"
                  }
                >
                  {typeof window !== "undefined" &&
                  "Notification" in window &&
                  Notification.permission === "granted"
                    ? "Мэдэгдэл идэвхтэй"
                    : "Мэдэгдэл хязгаарлагдсан"}
                </span>
              </div>
              {typeof window !== "undefined" &&
                "Notification" in window &&
                Notification.permission !== "granted" && (
                  <Button
                    onClick={requestNotificationPermission}
                    variant="outline"
                    size="sm"
                    className="flex items-center text-orange-600 hover:text-orange-700"
                  >
                    🔔 Мэдэгдэл зөвшөөрөх
                  </Button>
                )}
              <Button
                onClick={handleLogout}
                variant="outline"
                size="sm"
                className="flex items-center text-red-600 hover:text-red-700"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Гарах
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Хүлээгдэж байна
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {orders.filter((order) => order.status === "pending").length}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Хүргэлтэнд гарсан
              </CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {
                  orders.filter((order) => order.status === "on_delivery")
                    .length
                }
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Нийт захиалга
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{orders.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Orders Table */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle>Хүргэлтийн захиалгууд</CardTitle>
            <CardDescription>
              Төлөгдсөн захиалгууд л харагдана ({orders.length} захиалга)
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {orders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg">Хүргэх захиалга байхгүй байна</p>
                <p className="text-sm">Шинэ захиалга ирэхийг хүлээнэ үү</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Захиалга</TableHead>
                    <TableHead>Пицца</TableHead>
                    <TableHead>Хаяг</TableHead>
                    <TableHead>Утас</TableHead>
                    <TableHead>Дүн</TableHead>
                    <TableHead>Төлөв</TableHead>
                    <TableHead>Огноо</TableHead>
                    <TableHead>Үйлдэл</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => {
                    const nextStatus = getNextStatus(order.status);
                    const nextStatusLabel = getNextStatusLabel(order.status);
                    const nextStatusIcon = getNextStatusIcon(order.status);

                    return (
                      <TableRow key={order.id} data-order-id={order.id}>
                        <TableCell className="font-mono text-xs">
                          #{order.id.slice(-8)}
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <div
                            className="truncate"
                            title={getPizzaNames(order.pizzas)}
                          >
                            {getPizzaNames(order.pizzas)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center text-sm">
                            <MapPin className="h-4 w-4 mr-1 text-gray-400" />
                            <div>
                              <div>{order.building}</div>
                              <div className="text-xs text-gray-500">
                                {order.floor}-р давхар, {order.door_number}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <a
                            href={`tel:${order.phone}`}
                            className="flex items-center text-blue-600 hover:text-blue-800"
                          >
                            <Phone className="h-4 w-4 mr-1" />
                            {order.phone}
                          </a>
                        </TableCell>
                        <TableCell className="font-semibold">
                          {formatPrice(order.total_price)}
                        </TableCell>
                        <TableCell>{getStatusBadge(order.status)}</TableCell>
                        <TableCell className="text-sm">
                          {formatTime(order.created_at)}
                        </TableCell>
                        <TableCell>
                          {nextStatus && nextStatusLabel && (
                            <Button
                              onClick={() =>
                                updateOrderStatus(order.id, nextStatus)
                              }
                              disabled={updatingOrder === order.id}
                              size="sm"
                              className="bg-orange-600 hover:bg-orange-700"
                            >
                              {updatingOrder === order.id ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  {nextStatusIcon}
                                  <span className="ml-1 hidden sm:inline">
                                    {nextStatusLabel}
                                  </span>
                                </>
                              )}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
      <Toaster />
    </div>
  );
}

export default function DeliveryPage() {
  return (
    <ProtectedRoute requiredRole="delivery">
      <DeliveryDashboard />
    </ProtectedRoute>
  );
}
