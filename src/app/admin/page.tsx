"use client";

import { useEffect, useState } from "react";
import {
  supabase,
  Order,
  Pizza,
  UserRole,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  BarChart3,
  Calendar,
  Clock,
  DollarSign,
  Package,
  Phone,
  TrendingUp,
  Users,
  LogOut,
  RefreshCw,
  Plus,
  Edit,
  Trash2,
  Pizza,
  UserPlus,
  Shield,
  ShoppingCart,
  Banknote,
  Timer,
  UserCheck,
  Activity,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";

interface OrderStats {
  totalOrders: number;
  totalRevenue: number;
  ordersToday: number;
  averageDeliveryTime: number;
  topPizzas: { name: string; quantity: number }[];
  frequentBuildings: { building: string; count: number }[];
  paymentSplit: { cash: number; qpay: number };
}

interface UserWithRole {
  id: string;
  email: string;
  role: "admin" | "delivery";
  created_at: string;
}

function AdminDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [pizzas, setPizzas] = useState<Pizza[]>([]);
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [stats, setStats] = useState<OrderStats>({
    totalOrders: 0,
    totalRevenue: 0,
    ordersToday: 0,
    averageDeliveryTime: 0,
    topPizzas: [],
    frequentBuildings: [],
    paymentSplit: { cash: 0, qpay: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [showPizzaDialog, setShowPizzaDialog] = useState(false);
  const [editingPizza, setEditingPizza] = useState<Pizza | null>(null);
  const [pizzaForm, setPizzaForm] = useState({
    name: "",
    price: "",
    image_url: "",
    is_active: true,
  });
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [userForm, setUserForm] = useState({
    email: "",
    password: "",
    role: "delivery" as "admin" | "delivery",
  });
  const router = useRouter();

  useEffect(() => {
    fetchData();
    setupRealtimeSubscription();
  }, []);

  useEffect(() => {
    calculateStats();
  }, [orders, pizzas]);

  const fetchData = async () => {
    try {
      if (!supabase) return;

      // Fetch orders
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (ordersError) throw ordersError;
      setOrders(ordersData || []);

      // Fetch pizzas
      const { data: pizzasData, error: pizzasError } = await supabase
        .from("pizzas")
        .select("*");

      if (pizzasError) throw pizzasError;
      setPizzas(pizzasData || []);

      // Fetch users with roles
      const { data: usersData, error: usersError } =
        await supabase.auth.admin.listUsers();

      if (usersError) {
        console.error("Error fetching users:", usersError);
      } else {
        // Get user roles
        const { data: rolesData, error: rolesError } = await supabase
          .from("user_roles")
          .select("*");

        if (rolesError) {
          console.error("Error fetching user roles:", rolesError);
        } else {
          const usersWithRoles = usersData.users.map((user) => {
            const userRole = rolesData?.find((role) => role.id === user.id);
            return {
              id: user.id,
              email: user.email || "",
              role: userRole?.role || ("delivery" as "admin" | "delivery"),
              created_at: user.created_at,
            };
          });
          setUsers(usersWithRoles);
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    if (!supabase) return;

    const channel = supabase
      .channel("admin-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          fetchData();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const calculateStats = () => {
    if (!orders.length || !pizzas.length) return;

    const today = new Date().toDateString();
    const paidOrders = orders.filter((order) => order.is_paid);
    const deliveredOrders = orders.filter(
      (order) => order.status === "delivered" && order.delivered_at,
    );

    // Calculate delivery times
    const deliveryTimes = deliveredOrders.map((order) => {
      const created = new Date(order.created_at).getTime();
      const delivered = new Date(order.delivered_at!).getTime();
      return (delivered - created) / (1000 * 60); // minutes
    });

    const avgDeliveryTime =
      deliveryTimes.length > 0
        ? deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length
        : 0;

    // Top pizzas
    const pizzaQuantities: { [key: string]: number } = {};
    orders.forEach((order) => {
      order.pizza_items.forEach((item) => {
        pizzaQuantities[item.pizza_id] =
          (pizzaQuantities[item.pizza_id] || 0) + item.quantity;
      });
    });

    const topPizzas = Object.entries(pizzaQuantities)
      .map(([pizzaId, quantity]) => {
        const pizza = pizzas.find((p) => p.id === pizzaId);
        return { name: pizza?.name || "Unknown", quantity };
      })
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    // Frequent buildings
    const buildingCounts: { [key: string]: number } = {};
    orders.forEach((order) => {
      buildingCounts[order.building] =
        (buildingCounts[order.building] || 0) + 1;
    });

    const frequentBuildings = Object.entries(buildingCounts)
      .map(([building, count]) => ({ building, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Payment split
    const cashOrders = paidOrders.filter(
      (order) => order.payment_type === "cash",
    ).length;
    const qpayOrders = paidOrders.filter(
      (order) => order.payment_type === "qpay",
    ).length;

    setStats({
      totalOrders: orders.length,
      totalRevenue: paidOrders.reduce(
        (sum, order) => sum + order.total_price,
        0,
      ),
      ordersToday: orders.filter(
        (order) => new Date(order.created_at).toDateString() === today,
      ).length,
      averageDeliveryTime: Math.round(avgDeliveryTime),
      topPizzas,
      frequentBuildings,
      paymentSplit: { cash: cashOrders, qpay: qpayOrders },
    });
  };

  const getFilteredOrders = () => {
    let filtered = orders;

    if (statusFilter !== "all") {
      filtered = filtered.filter((order) => order.status === statusFilter);
    }

    if (paymentFilter !== "all") {
      filtered = filtered.filter(
        (order) => order.payment_type === paymentFilter,
      );
    }

    if (dateFilter !== "all") {
      const today = new Date();
      const filterDate = new Date();

      switch (dateFilter) {
        case "today":
          filtered = filtered.filter(
            (order) =>
              new Date(order.created_at).toDateString() ===
              today.toDateString(),
          );
          break;
        case "week":
          filterDate.setDate(today.getDate() - 7);
          filtered = filtered.filter(
            (order) => new Date(order.created_at) >= filterDate,
          );
          break;
        case "month":
          filterDate.setMonth(today.getMonth() - 1);
          filtered = filtered.filter(
            (order) => new Date(order.created_at) >= filterDate,
          );
          break;
      }
    }

    return filtered;
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

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    router.push("/login");
  };

  const getPizzaNames = (
    pizzaItems: { pizza_id: string; quantity: number }[],
  ) => {
    return pizzaItems
      .map((item) => {
        const pizza = pizzas.find((p) => p.id === item.pizza_id);
        return `${pizza?.name || "Unknown"} (${item.quantity})`;
      })
      .join(", ");
  };

  const handlePizzaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    try {
      const pizzaData = {
        name: pizzaForm.name,
        price: parseFloat(pizzaForm.price),
        image_url: pizzaForm.image_url || null,
        is_active: pizzaForm.is_active,
      };

      if (editingPizza) {
        // Update existing pizza
        const { error } = await supabase
          .from("pizzas")
          .update(pizzaData)
          .eq("id", editingPizza.id);

        if (error) throw error;
      } else {
        // Create new pizza
        const { error } = await supabase.from("pizzas").insert([pizzaData]);

        if (error) throw error;
      }

      // Reset form and close dialog
      setPizzaForm({ name: "", price: "", image_url: "", is_active: true });
      setEditingPizza(null);
      setShowPizzaDialog(false);
      fetchData();
    } catch (error) {
      console.error("Error saving pizza:", error);
      alert("Пицца хадгалахад алдаа гарлаа");
    }
  };

  const handleEditPizza = (pizza: Pizza) => {
    setEditingPizza(pizza);
    setPizzaForm({
      name: pizza.name,
      price: pizza.price.toString(),
      image_url: pizza.image_url || "",
      is_active: pizza.is_active,
    });
    setShowPizzaDialog(true);
  };

  const handleDeletePizza = async (pizzaId: string) => {
    if (!supabase) return;
    if (!confirm("Энэ пиццаг устгахдаа итгэлтэй байна уу?")) return;

    try {
      const { error } = await supabase
        .from("pizzas")
        .delete()
        .eq("id", pizzaId);

      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error("Error deleting pizza:", error);
      alert("Пицца устгахад алдаа гарлаа");
    }
  };

  const handleTogglePizzaStatus = async (pizza: Pizza) => {
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from("pizzas")
        .update({ is_active: !pizza.is_active })
        .eq("id", pizza.id);

      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error("Error updating pizza status:", error);
      alert("Пиццаны төлөв өөрчлөхөд алдаа гарлаа");
    }
  };

  const resetPizzaForm = () => {
    setPizzaForm({ name: "", price: "", image_url: "", is_active: true });
    setEditingPizza(null);
    setShowPizzaDialog(false);
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    try {
      // Create user in Supabase Auth
      const { data: authData, error: authError } =
        await supabase.auth.admin.createUser({
          email: userForm.email,
          password: userForm.password,
          email_confirm: true,
        });

      if (authError) throw authError;

      if (authData.user) {
        // Add user role
        const { error: roleError } = await supabase.from("user_roles").insert([
          {
            id: authData.user.id,
            role: userForm.role,
          },
        ]);

        if (roleError) throw roleError;
      }

      // Reset form and close dialog
      setUserForm({ email: "", password: "", role: "delivery" });
      setShowUserDialog(false);
      fetchData();
      alert("Хэрэглэгч амжилттай үүсгэгдлээ");
    } catch (error) {
      console.error("Error creating user:", error);
      alert("Хэрэглэгч үүсгэхэд алдаа гарлаа");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!supabase) return;
    if (!confirm("Энэ хэрэглэгчийг устгахдаа итгэлтэй байна уу?")) return;

    try {
      // Delete from user_roles first
      const { error: roleError } = await supabase
        .from("user_roles")
        .delete()
        .eq("id", userId);

      if (roleError) throw roleError;

      // Delete user from auth
      const { error: authError } = await supabase.auth.admin.deleteUser(userId);

      if (authError) throw authError;

      fetchData();
      alert("Хэрэглэгч амжилттай устгагдлаа");
    } catch (error) {
      console.error("Error deleting user:", error);
      alert("Хэрэглэгч устгахад алдаа гарлаа");
    }
  };

  const resetUserForm = () => {
    setUserForm({ email: "", password: "", role: "delivery" });
    setShowUserDialog(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-orange-600" />
          <p className="text-lg text-gray-600">Мэдээлэл ачааллаж байна...</p>
        </div>
      </div>
    );
  }

  const filteredOrders = getFilteredOrders();

  // Generate chart data
  const generateRevenueChartData = () => {
    const last7Days = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toDateString();

      const dayOrders = orders.filter(
        (order) =>
          new Date(order.created_at).toDateString() === dateStr &&
          order.is_paid,
      );

      const revenue = dayOrders.reduce(
        (sum, order) => sum + order.total_price,
        0,
      );

      last7Days.push({
        day: date.toLocaleDateString("mn-MN", { weekday: "short" }),
        revenue: revenue,
        orders: dayOrders.length,
      });
    }

    return last7Days;
  };

  const chartData = generateRevenueChartData();
  const pieData = [
    { name: "QPay", value: stats.paymentSplit.qpay, color: "#3B82F6" },
    { name: "Бэлэн мөнгө", value: stats.paymentSplit.cash, color: "#10B981" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-64 bg-white shadow-lg border-r z-10">
        <div className="p-6">
          <div className="flex items-center mb-8">
            <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center mr-3">
              <Pizza className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Гоё Пицца</h1>
              <p className="text-sm text-gray-500">Удирдлагын самбар</p>
            </div>
          </div>

          <nav className="space-y-2">
            <div className="bg-red-500 text-white px-4 py-3 rounded-lg flex items-center">
              <BarChart3 className="h-5 w-5 mr-3" />
              Статистик
            </div>
            <div className="px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-lg flex items-center cursor-pointer">
              <Package className="h-5 w-5 mr-3" />
              Захиалгууд
            </div>
            <div className="px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-lg flex items-center cursor-pointer">
              <Pizza className="h-5 w-5 mr-3" />
              Пицца удирдах
            </div>
            <div className="px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-lg flex items-center cursor-pointer">
              <Users className="h-5 w-5 mr-3" />
              Ажилчид
            </div>
          </nav>
        </div>

        <div className="absolute bottom-6 left-6 right-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                <UserCheck className="h-4 w-4 text-gray-600" />
              </div>
              <span className="ml-2 text-sm text-gray-600">
                Админ хэрэглэгч
              </span>
            </div>
            <Button
              onClick={handleLogout}
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-700 p-1"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-64">
        {/* Header */}
        <header className="bg-white shadow-sm border-b px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Статистик</h2>
              <p className="text-gray-500">Өнөөдрийн ерөнхий мэдээлэл</p>
            </div>
            <Button
              onClick={fetchData}
              variant="outline"
              size="sm"
              className="flex items-center"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Шинэчлэх
            </Button>
          </div>
        </header>

        <main className="px-8 py-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="bg-white border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Нийт захиалга</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {stats.totalOrders}
                    </p>
                    <p className="text-sm text-green-600 mt-1">+12% өчигдөөс</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <ShoppingCart className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">
                      Өнөөдрийн орлого
                    </p>
                    <p className="text-3xl font-bold text-gray-900">
                      {formatPrice(stats.totalRevenue)}
                    </p>
                    <p className="text-sm text-green-600 mt-1">+8% өчигдөөс</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <Banknote className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">
                      Дундаж хүргэх хугацаа
                    </p>
                    <p className="text-3xl font-bold text-gray-900">
                      {stats.averageDeliveryTime} мин
                    </p>
                    <p className="text-sm text-red-500 mt-1">+2 мин өчигдөөс</p>
                  </div>
                  <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                    <Timer className="h-6 w-6 text-yellow-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">
                      Идэвхтэй ажилчид
                    </p>
                    <p className="text-3xl font-bold text-gray-900">
                      {users.length}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">12-с</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <Users className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">
                  7 хоногийн орлого
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient
                          id="colorRevenue"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#EF4444"
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="95%"
                            stopColor="#EF4444"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis
                        dataKey="day"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: "#6B7280" }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: "#6B7280" }}
                        tickFormatter={(value) => `₮${value / 1000}k`}
                      />
                      <Tooltip
                        formatter={(value) => [
                          formatPrice(Number(value)),
                          "Орлого",
                        ]}
                        labelStyle={{ color: "#374151" }}
                        contentStyle={{
                          backgroundColor: "white",
                          border: "1px solid #E5E7EB",
                          borderRadius: "8px",
                          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#EF4444"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorRevenue)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">
                  Төлбөрийн хэлбэр
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={120}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [value, "Захиалга"]}
                        contentStyle={{
                          backgroundColor: "white",
                          border: "1px solid #E5E7EB",
                          borderRadius: "8px",
                          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center space-x-6 mt-4">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                    <span className="text-sm text-gray-600">QPay</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                    <span className="text-sm text-gray-600">Бэлэн мөнгө</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Bottom Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">
                  Хамгийн их борлуулалттай пицца
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats.topPizzas.slice(0, 3).map((pizza, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold mr-3 ${
                            index === 0
                              ? "bg-yellow-500"
                              : index === 1
                                ? "bg-gray-400"
                                : "bg-orange-500"
                          }`}
                        >
                          {index + 1}
                        </div>
                        <span className="text-gray-900 font-medium">
                          {pizza.name}
                        </span>
                      </div>
                      <span className="text-gray-600 font-semibold">
                        {pizza.quantity} ширхэг
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">
                  Сүүлийн захиалгууд
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredOrders.slice(0, 3).map((order, index) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center">
                          <div
                            className={`w-1 h-12 rounded-full mr-3 ${
                              order.status === "delivered"
                                ? "bg-green-500"
                                : order.status === "on_delivery"
                                  ? "bg-blue-500"
                                  : "bg-yellow-500"
                            }`}
                          ></div>
                          <div>
                            <p className="font-semibold text-gray-900">
                              #{order.id.slice(0, 5)}
                            </p>
                            <p className="text-sm text-gray-500">
                              {order.status === "delivered"
                                ? "Хүргэгдсэн"
                                : order.status === "on_delivery"
                                  ? "Хүргэж байна"
                                  : "Хүлээж байна"}{" "}
                              - {formatTime(order.created_at).split(" ")[1]}
                            </p>
                          </div>
                        </div>
                      </div>
                      <span className="text-lg font-bold text-gray-900">
                        {formatPrice(order.total_price)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="bg-white mb-6">
            <CardHeader>
              <CardTitle>Захиалгын жагсаалт</CardTitle>
              <CardDescription>
                Нийт {filteredOrders.length} захиалга
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 mb-4">
                <div className="flex flex-col space-y-2">
                  <label className="text-sm font-medium">Төлөв</label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Бүгд</SelectItem>
                      <SelectItem value="pending">Хүлээгдэж байна</SelectItem>
                      <SelectItem value="accepted">Хүлээн авсан</SelectItem>
                      <SelectItem value="on_delivery">Хүргэж байна</SelectItem>
                      <SelectItem value="delivered">Хүргэгдсэн</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col space-y-2">
                  <label className="text-sm font-medium">Төлбөр</label>
                  <Select
                    value={paymentFilter}
                    onValueChange={setPaymentFilter}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Бүгд</SelectItem>
                      <SelectItem value="cash">Бэлэн мөнгө</SelectItem>
                      <SelectItem value="qpay">QPay</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col space-y-2">
                  <label className="text-sm font-medium">Огноо</label>
                  <Select value={dateFilter} onValueChange={setDateFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Бүгд</SelectItem>
                      <SelectItem value="today">Өнөөдөр</SelectItem>
                      <SelectItem value="week">Сүүлийн 7 хоног</SelectItem>
                      <SelectItem value="month">Сүүлийн сар</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* User Management */}
          <Card className="bg-white mb-6">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="flex items-center">
                    <Users className="h-5 w-5 mr-2" />
                    Хэрэглэгчийн удирдлага
                  </CardTitle>
                  <CardDescription>
                    Нийт {users.length} хэрэглэгч
                  </CardDescription>
                </div>
                <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
                  <DialogTrigger asChild>
                    <Button onClick={() => resetUserForm()}>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Шинэ хэрэглэгч нэмэх
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <form onSubmit={handleUserSubmit}>
                      <DialogHeader>
                        <DialogTitle>Шинэ хэрэглэгч нэмэх</DialogTitle>
                        <DialogDescription>
                          Хүргэлтийн ажилтны мэдээллийг оруулна уу.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="email" className="text-right">
                            И-мэйл
                          </Label>
                          <Input
                            id="email"
                            type="email"
                            value={userForm.email}
                            onChange={(e) =>
                              setUserForm({
                                ...userForm,
                                email: e.target.value,
                              })
                            }
                            className="col-span-3"
                            required
                          />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="password" className="text-right">
                            Нууц үг
                          </Label>
                          <Input
                            id="password"
                            type="password"
                            value={userForm.password}
                            onChange={(e) =>
                              setUserForm({
                                ...userForm,
                                password: e.target.value,
                              })
                            }
                            className="col-span-3"
                            required
                            minLength={6}
                          />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="role" className="text-right">
                            Эрх
                          </Label>
                          <Select
                            value={userForm.role}
                            onValueChange={(value: "admin" | "delivery") =>
                              setUserForm({ ...userForm, role: value })
                            }
                          >
                            <SelectTrigger className="col-span-3">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="delivery">
                                Хүргэлтийн ажилтан
                              </SelectItem>
                              <SelectItem value="admin">Админ</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={resetUserForm}
                        >
                          Цуцлах
                        </Button>
                        <Button type="submit">Үүсгэх</Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>И-мэйл</TableHead>
                    <TableHead>Эрх</TableHead>
                    <TableHead>Үүсгэсэн огноо</TableHead>
                    <TableHead>Үйлдэл</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.email}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            user.role === "admin" ? "default" : "secondary"
                          }
                          className="flex items-center w-fit"
                        >
                          {user.role === "admin" ? (
                            <Shield className="h-3 w-3 mr-1" />
                          ) : (
                            <Users className="h-3 w-3 mr-1" />
                          )}
                          {user.role === "admin"
                            ? "Админ"
                            : "Хүргэлтийн ажилтан"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatTime(user.created_at)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteUser(user.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {users.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  Хэрэглэгч олдсонгүй
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pizza Management */}
          <Card className="bg-white mb-6">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="flex items-center">
                    <Pizza className="h-5 w-5 mr-2" />
                    Пиццаны удирдлага
                  </CardTitle>
                  <CardDescription>Нийт {pizzas.length} пицца</CardDescription>
                </div>
                <Dialog
                  open={showPizzaDialog}
                  onOpenChange={setShowPizzaDialog}
                >
                  <DialogTrigger asChild>
                    <Button onClick={() => resetPizzaForm()}>
                      <Plus className="h-4 w-4 mr-2" />
                      Шинэ пицца нэмэх
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <form onSubmit={handlePizzaSubmit}>
                      <DialogHeader>
                        <DialogTitle>
                          {editingPizza ? "Пицца засах" : "Шинэ пицца нэмэх"}
                        </DialogTitle>
                        <DialogDescription>
                          Пиццаны мэдээллийг оруулна уу.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="name" className="text-right">
                            Нэр
                          </Label>
                          <Input
                            id="name"
                            value={pizzaForm.name}
                            onChange={(e) =>
                              setPizzaForm({
                                ...pizzaForm,
                                name: e.target.value,
                              })
                            }
                            className="col-span-3"
                            required
                          />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="price" className="text-right">
                            Үнэ
                          </Label>
                          <Input
                            id="price"
                            type="number"
                            value={pizzaForm.price}
                            onChange={(e) =>
                              setPizzaForm({
                                ...pizzaForm,
                                price: e.target.value,
                              })
                            }
                            className="col-span-3"
                            required
                          />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="image_url" className="text-right">
                            Зургийн холбоос
                          </Label>
                          <Input
                            id="image_url"
                            value={pizzaForm.image_url}
                            onChange={(e) =>
                              setPizzaForm({
                                ...pizzaForm,
                                image_url: e.target.value,
                              })
                            }
                            className="col-span-3"
                            placeholder="https://..."
                          />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="is_active" className="text-right">
                            Идэвхтэй
                          </Label>
                          <Select
                            value={pizzaForm.is_active.toString()}
                            onValueChange={(value) =>
                              setPizzaForm({
                                ...pizzaForm,
                                is_active: value === "true",
                              })
                            }
                          >
                            <SelectTrigger className="col-span-3">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="true">Идэвхтэй</SelectItem>
                              <SelectItem value="false">Идэвхгүй</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={resetPizzaForm}
                        >
                          Цуцлах
                        </Button>
                        <Button type="submit">
                          {editingPizza ? "Хадгалах" : "Нэмэх"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Зураг</TableHead>
                    <TableHead>Нэр</TableHead>
                    <TableHead>Үнэ</TableHead>
                    <TableHead>Төлөв</TableHead>
                    <TableHead>Үйлдэл</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pizzas.map((pizza) => (
                    <TableRow key={pizza.id}>
                      <TableCell>
                        {pizza.image_url ? (
                          <img
                            src={pizza.image_url}
                            alt={pizza.name}
                            className="w-12 h-12 object-cover rounded"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
                            <Pizza className="h-6 w-6 text-gray-400" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {pizza.name}
                      </TableCell>
                      <TableCell>{formatPrice(pizza.price)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={pizza.is_active ? "default" : "secondary"}
                          className="cursor-pointer"
                          onClick={() => handleTogglePizzaStatus(pizza)}
                        >
                          {pizza.is_active ? "Идэвхтэй" : "Идэвхгүй"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditPizza(pizza)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeletePizza(pizza.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {pizzas.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  Пицца олдсонгүй
                </div>
              )}
            </CardContent>
          </Card>

          {/* Orders Table */}
          <Card className="bg-white">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Захиалгын дугаар</TableHead>
                    <TableHead>Пицца</TableHead>
                    <TableHead>Хаяг</TableHead>
                    <TableHead>Утас</TableHead>
                    <TableHead>Дүн</TableHead>
                    <TableHead>Төлбөр</TableHead>
                    <TableHead>Төлөв</TableHead>
                    <TableHead>Огноо</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-xs">
                        {order.id.slice(0, 8)}...
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div
                          className="truncate"
                          title={getPizzaNames(order.pizza_items)}
                        >
                          {getPizzaNames(order.pizza_items)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {order.building}, {order.floor}-р давхар,{" "}
                          {order.door_number}
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
                      <TableCell>
                        <Badge
                          variant={
                            order.payment_type === "qpay"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {order.payment_type === "qpay" ? "QPay" : "Бэлэн"}
                        </Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell className="text-sm">
                        {formatTime(order.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredOrders.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  Захиалга олдсонгүй
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <ProtectedRoute requiredRole="admin">
      <AdminDashboard />
    </ProtectedRoute>
  );
}
