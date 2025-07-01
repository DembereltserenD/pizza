"use client";
import { useEffect, useState } from "react";
import {
  supabase,
  Pizza,
  Order,
  formatPrice,
  formatTime,
} from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ShoppingCart,
  Plus,
  Minus,
  Clock,
  Heart,
  Phone,
  User,
  LogIn,
  Package,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Link from "next/link";
import LoginPage from "@/app/login/page";
import Image from "next/image";
import dynamic from "next/dynamic";
import Cart from "@/components/Cart";

// Dynamic import to avoid SSR issues with Leaflet
const DeliveryMap = dynamic(() => import("@/components/DeliveryMap"), {
  ssr: false,
  loading: () => (
    <div className="bg-white rounded-lg p-6">
      <div className="animate-pulse">
        <div className="h-96 bg-gray-200 rounded-lg mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      </div>
    </div>
  ),
});

interface CartItem extends Pizza {
  quantity: number;
}

interface OrderWithPizzas extends Order {
  pizzas: { pizza: Pizza; quantity: number }[];
}

export default function HomePage() {
  const [pizzas, setPizzas] = useState<Pizza[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [isVerificationStep, setIsVerificationStep] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [user, setUser] = useState<any>(null);
  const [userOrders, setUserOrders] = useState<OrderWithPizzas[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [showOrders, setShowOrders] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    fetchPizzas();
    loadCartFromStorage();
    checkUser();
  }, []);

  const checkUser = async () => {
    if (!supabase) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    setUser(user);

    if (user?.phone) {
      fetchUserOrders(user.phone);
    }
  };

  const fetchUserOrders = async (phone: string) => {
    if (!supabase) return;

    setLoadingOrders(true);
    try {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Normalize phone number for consistent matching
      const normalizePhone = (phoneNum: string) => {
        const cleaned = phoneNum.replace(/[^0-9]/g, "");
        if (cleaned.startsWith("976") && cleaned.length === 11) {
          return cleaned.substring(3); // Remove 976 prefix for comparison
        }
        return cleaned;
      };

      const normalizedPhone = normalizePhone(phone);

      // Build query to get orders by user_id or phone number
      let query = supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

      if (user) {
        // If user is authenticated, get orders by user_id OR phone
        query = query.or(`user_id.eq.${user.id},phone.eq.${normalizedPhone}`);
      } else {
        // If not authenticated, only get by phone
        query = query.eq("phone", normalizedPhone);
      }

      const { data: ordersData, error: ordersError } = await query;

      if (ordersError) throw ordersError;

      if (!ordersData || ordersData.length === 0) {
        setUserOrders([]);
        return;
      }

      // Get all pizza IDs from orders
      const allPizzaIds = new Set<string>();
      ordersData.forEach((order) => {
        order.pizza_items.forEach((item: any) => {
          allPizzaIds.add(item.pizza_id);
        });
      });

      // Fetch pizza details
      const { data: pizzasData, error: pizzasError } = await supabase
        .from("pizzas")
        .select("*")
        .in("id", Array.from(allPizzaIds));

      if (pizzasError) throw pizzasError;

      // Create pizza lookup map
      const pizzaMap = new Map<string, Pizza>();
      pizzasData?.forEach((pizza) => {
        pizzaMap.set(pizza.id, pizza);
      });

      // Combine orders with pizza details
      const ordersWithPizzas: OrderWithPizzas[] = ordersData.map((order) => ({
        ...order,
        pizzas: order.pizza_items.map((item: any) => ({
          pizza: pizzaMap.get(item.pizza_id)!,
          quantity: item.quantity,
        })),
      }));

      setUserOrders(ordersWithPizzas);
    } catch (error) {
      console.error("Error fetching user orders:", error);
    } finally {
      setLoadingOrders(false);
    }
  };

  const fetchPizzas = async () => {
    try {
      if (!supabase) {
        console.error(
          "Supabase client not initialized. Check environment variables.",
        );
        setLoading(false);
        return;
      }

      console.log("Attempting to fetch pizzas...");
      const { data, error } = await supabase
        .from("pizzas")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) {
        console.error("Supabase error details:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        console.error("Full error object:", error);

        // Try to get more specific error information
        if (error.message) {
          console.error("Error message:", error.message);
        }
        if (error.details) {
          console.error("Error details:", error.details);
        }
        if (error.hint) {
          console.error("Error hint:", error.hint);
        }

        throw error;
      }

      console.log("Fetched pizzas successfully:", data);
      setPizzas(data || []);
    } catch (error) {
      console.error("Error fetching pizzas:", error);
      // Try to get more details about the error
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadCartFromStorage = () => {
    const savedCart = localStorage.getItem("pizza-cart");
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }
  };

  const saveCartToStorage = (newCart: CartItem[]) => {
    localStorage.setItem("pizza-cart", JSON.stringify(newCart));
  };

  const updateQuantity = (pizzaId: string, newQuantity: number) => {
    if (newQuantity === 0) {
      removeFromCart(pizzaId);
      return;
    }

    const newCart = cart.map((item) =>
      item.id === pizzaId ? { ...item, quantity: newQuantity } : item,
    );

    setCart(newCart);
    saveCartToStorage(newCart);
  };

  const addToCart = (pizza: Pizza) => {
    const existingItem = cart.find((item) => item.id === pizza.id);
    let newCart: CartItem[];

    if (existingItem) {
      newCart = cart.map((item) =>
        item.id === pizza.id ? { ...item, quantity: item.quantity + 1 } : item,
      );
    } else {
      newCart = [...cart, { ...pizza, quantity: 1 }];
    }

    setCart(newCart);
    saveCartToStorage(newCart);
  };

  const removeFromCart = (pizzaId: string) => {
    const existingItem = cart.find((item) => item.id === pizzaId);
    if (!existingItem) return;

    let newCart: CartItem[];
    if (existingItem.quantity === 1) {
      newCart = cart.filter((item) => item.id !== pizzaId);
    } else {
      newCart = cart.map((item) =>
        item.id === pizzaId ? { ...item, quantity: item.quantity - 1 } : item,
      );
    }

    setCart(newCart);
    saveCartToStorage(newCart);
  };

  const getTotalItems = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  const getTotalPrice = () => {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0);
  };

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError("");

    if (!supabase) {
      setLoginError("Системийн алдаа гарлаа. Дахин оролдоно уу.");
      setIsLoggingIn(false);
      return;
    }

    try {
      // Format phone number (add +976 if not present)
      let formattedPhone = phoneNumber.trim();
      if (!formattedPhone.startsWith("+976")) {
        if (formattedPhone.startsWith("976")) {
          formattedPhone = "+" + formattedPhone;
        } else if (formattedPhone.startsWith("0")) {
          formattedPhone = "+976" + formattedPhone.substring(1);
        } else {
          formattedPhone = "+976" + formattedPhone;
        }
      }

      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
      });

      if (error) {
        setLoginError(
          "SMS илгээхэд алдаа гарлаа. Утасны дугаараа шалгаад дахин оролдоно уу.",
        );
      } else {
        setIsVerificationStep(true);
        setLoginError("");
      }
    } catch (err) {
      setLoginError("Системийн алдаа гарлаа. Дахин оролдоно уу.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError("");

    if (!supabase) {
      setLoginError("Системийн алдаа гарлаа. Дахин оролдоно уу.");
      setIsLoggingIn(false);
      return;
    }

    try {
      // Format phone number
      let formattedPhone = phoneNumber.trim();
      if (!formattedPhone.startsWith("+976")) {
        if (formattedPhone.startsWith("976")) {
          formattedPhone = "+" + formattedPhone;
        } else if (formattedPhone.startsWith("0")) {
          formattedPhone = "+976" + formattedPhone.substring(1);
        } else {
          formattedPhone = "+976" + formattedPhone;
        }
      }

      const { data, error } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: verificationCode,
        type: "sms",
      });

      if (error) {
        setLoginError("Баталгаажуулах код буруу байна. Дахин оролдоно уу.");
      } else if (data.user) {
        setUser(data.user);
        setIsLoginOpen(false);
        setIsVerificationStep(false);
        setPhoneNumber("");
        setVerificationCode("");
        setLoginError("");

        // Fetch user orders after successful login
        if (data.user.phone) {
          fetchUserOrders(data.user.phone);
        }
      }
    } catch (err) {
      setLoginError("Системийн алдаа гарлаа. Дахин оролдоно уу.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    if (!supabase) return;

    await supabase.auth.signOut();
    setUser(null);
    setUserOrders([]);
    setShowOrders(false);
  };

  const resetLoginForm = () => {
    setIsVerificationStep(false);
    setPhoneNumber("");
    setVerificationCode("");
    setLoginError("");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Пицца ачааллаж байна...</p>
        </div>
      </div>
    );
  }

  // Show error if Supabase is not initialized
  if (!supabase) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Өгөгдлийн сантай холбогдох боломжгүй
          </h2>
          <p className="text-gray-600 mb-4">
            Суурь тохиргоо дутуу байна. Админтай холбогдоно уу.
          </p>
          <div className="text-sm text-gray-500">
            <p>Шаардлагатай тохиргоо:</p>
            <ul className="list-disc list-inside mt-2">
              <li>NEXT_PUBLIC_SUPABASE_URL</li>
              <li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
            </ul>
          </div>
        </div>
        <div className="bg-white min-h-screen">
          <LoginPage />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-lg">🍕</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Гоё Пицца</h1>
                <p className="text-sm text-gray-500">Хурдан хүргэлт</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {user ? (
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <User className="h-4 w-4" />
                    <span>{user.phone}</span>
                  </div>
                  <Button
                    onClick={handleLogout}
                    variant="outline"
                    className="text-gray-600 hover:text-gray-900"
                  >
                    Гарах
                  </Button>
                </div>
              ) : (
                <Dialog
                  open={isLoginOpen}
                  onOpenChange={(open) => {
                    setIsLoginOpen(open);
                    if (!open) resetLoginForm();
                  }}
                >
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="border-blue-500 text-blue-500 hover:bg-blue-50 px-4"
                    >
                      <LogIn className="h-4 w-4 mr-2" />
                      Нэвтрэх
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="text-center">
                        {isVerificationStep
                          ? "Баталгаажуулах код"
                          : "Утасны дугаараар нэвтрэх"}
                      </DialogTitle>
                      <DialogDescription className="text-center">
                        {isVerificationStep
                          ? `${phoneNumber} дугаарт илгээсэн 6 оронтой кодыг оруулна уу`
                          : "Утасны дугаараа оруулснаар SMS-ээр баталгаажуулах код илгээгдэнэ"}
                      </DialogDescription>
                    </DialogHeader>

                    {!isVerificationStep ? (
                      <form onSubmit={handlePhoneLogin} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="phone">Утасны дугаар</Label>
                          <Input
                            id="phone"
                            type="tel"
                            placeholder="99123456 эсвэл +97699123456"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            required
                            className="w-full"
                          />
                          <p className="text-xs text-gray-500">
                            Монгол улсын утасны дугаар оруулна уу
                          </p>
                        </div>

                        {loginError && (
                          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm">
                            {loginError}
                          </div>
                        )}

                        <Button
                          type="submit"
                          className="w-full bg-blue-500 hover:bg-blue-600 text-white"
                          disabled={isLoggingIn}
                        >
                          {isLoggingIn ? "SMS илгээж байна..." : "SMS код авах"}
                        </Button>
                      </form>
                    ) : (
                      <form onSubmit={handleVerifyCode} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="code">Баталгаажуулах код</Label>
                          <Input
                            id="code"
                            type="text"
                            placeholder="123456"
                            value={verificationCode}
                            onChange={(e) =>
                              setVerificationCode(e.target.value)
                            }
                            required
                            maxLength={6}
                            className="w-full text-center text-lg tracking-widest"
                          />
                        </div>

                        {loginError && (
                          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm">
                            {loginError}
                          </div>
                        )}

                        <div className="flex space-x-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={resetLoginForm}
                            className="flex-1"
                          >
                            Буцах
                          </Button>
                          <Button
                            type="submit"
                            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
                            disabled={isLoggingIn}
                          >
                            {isLoggingIn ? "Шалгаж байна..." : "Баталгаажуулах"}
                          </Button>
                        </div>
                      </form>
                    )}
                  </DialogContent>
                </Dialog>
              )}

              {/* Mobile Cart Button */}
              <div className="lg:hidden">
                <Cart
                  cart={cart}
                  onUpdateQuantity={updateQuantity}
                  onRemoveFromCart={removeFromCart}
                  isMobile={true}
                  user={user}
                  onLoginRequired={() => setIsLoginOpen(true)}
                />
              </div>

              {/* Desktop Cart Button - Hidden on mobile */}
              <div className="hidden lg:block">
                <Button
                  onClick={() => setIsCartOpen(!isCartOpen)}
                  className="relative bg-red-500 hover:bg-red-600 text-white px-6"
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Сагс
                  {getTotalItems() > 0 && (
                    <Badge className="absolute -top-2 -right-2 bg-yellow-500 text-black text-xs min-w-[20px] h-5 rounded-full flex items-center justify-center font-bold">
                      {getTotalItems()}
                    </Badge>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex">
        <main className="flex-1 max-w-none lg:max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center mb-8">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Амттай пиццаг захиалаарай
            </h2>
            <p className="text-lg text-gray-600 mb-6">
              Орон нутгийн хамгийн амттай пицца, хурдан хүргэлттэй
            </p>

            {/* Delivery Info */}
            <div className="flex justify-center items-center space-x-8 mb-8">
              <div className="flex items-center space-x-2 text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium">15-30 минут</span>
              </div>
              <div className="flex items-center space-x-2 text-blue-600">
                <span className="text-sm font-medium">🚶 Явган хүргэлт</span>
              </div>
              <div className="flex items-center space-x-2 text-yellow-600">
                <span className="text-sm font-medium">
                  💳 Бэлэн мөнгө / QPay
                </span>
              </div>
            </div>

            {/* User Orders Section */}
            {user && (
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-6 mb-8 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold mb-2">Таны захиалгууд</h3>
                    <p className="text-blue-100">
                      {userOrders.length > 0
                        ? `${userOrders.length} захиалга олдлоо`
                        : "Захиалга олдсонгүй"}
                    </p>
                  </div>
                  {userOrders.length > 0 && (
                    <Button
                      onClick={() => setShowOrders(!showOrders)}
                      className="bg-white text-blue-600 hover:bg-blue-50 font-semibold px-4 py-2"
                    >
                      <Package className="h-4 w-4 mr-2" />
                      {showOrders ? "Нуух" : "Харах"}
                      {showOrders ? (
                        <ChevronUp className="h-4 w-4 ml-2" />
                      ) : (
                        <ChevronDown className="h-4 w-4 ml-2" />
                      )}
                    </Button>
                  )}
                </div>

                {showOrders && userOrders.length > 0 && (
                  <div className="mt-6 space-y-4">
                    {userOrders.map((order) => (
                      <div
                        key={order.id}
                        className="bg-white/10 backdrop-blur-sm rounded-lg p-4"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-semibold text-white">
                              Захиалга #{order.id.slice(-8)}
                            </h4>
                            <p className="text-blue-100 text-sm">
                              {formatTime(order.created_at)}
                            </p>
                          </div>
                          <Badge
                            className={
                              order.status === "delivered"
                                ? "bg-green-500 hover:bg-green-600"
                                : order.status === "on_delivery"
                                  ? "bg-yellow-500 hover:bg-yellow-600"
                                  : order.status === "accepted"
                                    ? "bg-blue-500 hover:bg-blue-600"
                                    : "bg-gray-500 hover:bg-gray-600"
                            }
                          >
                            {order.status === "pending" && "Хүлээгдэж байна"}
                            {order.status === "accepted" && "Баталгаажсан"}
                            {order.status === "on_delivery" && "Хүргэлтэнд"}
                            {order.status === "delivered" && "Хүргэгдсэн"}
                          </Badge>
                        </div>

                        <div className="space-y-1 mb-3">
                          {order.pizzas.map((item, index) => (
                            <div
                              key={index}
                              className="flex justify-between text-sm"
                            >
                              <span className="text-blue-100">
                                {item.pizza.name} × {item.quantity}
                              </span>
                              <span className="text-white font-medium">
                                {formatPrice(item.pizza.price * item.quantity)}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="flex justify-between items-center pt-2 border-t border-white/20">
                          <span className="text-blue-100 text-sm">
                            {order.building}, {order.floor} давхар
                          </span>
                          <span className="text-white font-bold">
                            {formatPrice(order.total_price)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {loadingOrders && (
                  <div className="mt-4 text-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mx-auto"></div>
                    <p className="text-blue-100 text-sm mt-2">
                      Захиалга ачааллаж байна...
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Login CTA for non-authenticated users */}
            {!user && (
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-6 mb-8 text-white text-center">
                <h3 className="text-xl font-bold mb-2">Захиалгаа хянах уу?</h3>
                <p className="text-blue-100 mb-4">
                  Нэвтэрснээр захиалгынхаа явцыг хянаарай
                </p>
                <Button
                  onClick={() => setIsLoginOpen(true)}
                  className="bg-white text-blue-600 hover:bg-blue-50 font-semibold px-6 py-2"
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  Нэвтрэх
                </Button>
              </div>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex justify-center mb-8">
            <div className="bg-white rounded-lg p-1 shadow-sm border">
              <div className="flex space-x-1">
                <Button className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-md">
                  Бүгд
                </Button>
                <Button
                  variant="ghost"
                  className="text-gray-600 hover:text-gray-900 px-6 py-2"
                >
                  Шинэ
                </Button>
                <Button
                  variant="ghost"
                  className="text-gray-600 hover:text-gray-900 px-6 py-2"
                >
                  Алдартай
                </Button>
              </div>
            </div>
          </div>

          {/* Cart Summary - Only show on mobile when cart has items */}
          {cart.length > 0 && (
            <div className="lg:hidden bg-white rounded-lg shadow-md p-4 mb-6">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-lg font-semibold">
                    Сагсанд: {getTotalItems()} ширхэг
                  </span>
                  <span className="text-xl font-bold text-red-500 ml-4">
                    {formatPrice(getTotalPrice())}
                  </span>
                </div>
                <Cart
                  cart={cart}
                  onUpdateQuantity={updateQuantity}
                  onRemoveFromCart={removeFromCart}
                  isMobile={true}
                  user={user}
                  onLoginRequired={() => setIsLoginOpen(true)}
                />
              </div>
            </div>
          )}

          {/* Pizza Menu Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pizzas.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <div className="text-gray-400 text-6xl mb-4">🍕</div>
                <h3 className="text-xl font-semibold text-gray-600 mb-2">
                  Пицца олдсонгүй
                </h3>
                <p className="text-gray-500">
                  Өгөгдлийн санд пицца байхгүй эсвэл холболт алдаатай байна
                </p>
              </div>
            ) : (
              pizzas.map((pizza) => {
                const cartItem = cart.find((item) => item.id === pizza.id);
                const quantity = cartItem?.quantity || 0;

                return (
                  <Card
                    key={pizza.id}
                    className="bg-white shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-200 rounded-2xl overflow-hidden group"
                  >
                    <CardHeader className="p-0 relative">
                      <div className="relative h-56 w-full overflow-hidden">
                        <Image
                          src={
                            pizza.image_url ||
                            "https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=500&q=80"
                          }
                          alt={pizza.name}
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        />
                        {/* Category Badge */}
                        <div className="absolute top-3 left-3">
                          <Badge className="bg-green-500 hover:bg-green-600 text-white text-xs px-2 py-1">
                            Шинэ
                          </Badge>
                        </div>
                        {quantity > 0 && (
                          <div className="absolute top-3 right-3 bg-red-500 text-white rounded-full h-7 w-7 flex items-center justify-center font-bold text-sm">
                            {quantity}
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="p-5">
                      <CardTitle className="text-xl font-bold text-gray-900 mb-2">
                        {pizza.name}
                      </CardTitle>
                      <p className="text-sm text-gray-500 mb-4 line-clamp-2">
                        Томоо, моцарелла бяслаг, базилик
                      </p>
                      <div className="flex items-center justify-between">
                        <p className="text-2xl font-bold text-red-500">
                          ₮{formatPrice(pizza.price)}
                        </p>
                        {quantity === 0 ? (
                          <Button
                            onClick={() => addToCart(pizza)}
                            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Нэмэх
                          </Button>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <Button
                              onClick={() => removeFromCart(pizza.id)}
                              variant="outline"
                              size="sm"
                              className="border-red-500 text-red-500 hover:bg-red-50 w-8 h-8 p-0"
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="text-lg font-bold text-gray-900 min-w-[24px] text-center">
                              {quantity}
                            </span>
                            <Button
                              onClick={() => addToCart(pizza)}
                              variant="outline"
                              size="sm"
                              className="border-red-500 text-red-500 hover:bg-red-50 w-8 h-8 p-0"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          {/* Empty State for No Pizzas */}
          {pizzas.length === 0 && !loading && (
            <div className="text-center py-16">
              <div className="bg-white rounded-lg shadow-lg p-8 max-w-md mx-auto">
                <div className="text-red-400 text-8xl mb-6">🍕</div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  Пицца олдсонгүй
                </h3>
                <p className="text-gray-600 mb-6">
                  Одоогоор идэвхтэй пицца байхгүй байна. Удахгүй шинэ амттай
                  пицца нэмэгдэнэ!
                </p>
                <Button
                  onClick={fetchPizzas}
                  className="bg-red-500 hover:bg-red-600"
                >
                  Дахин ачаалах
                </Button>
              </div>
            </div>
          )}

          {/* Why Choose Us Section */}
          <section className="bg-white py-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-12">
                <h3 className="text-3xl font-bold text-gray-900 mb-4">
                  Яагаад биднийг сонгох вэ?
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Clock className="h-8 w-8 text-green-600" />
                  </div>
                  <h4 className="text-xl font-semibold text-gray-900 mb-2">
                    Хурдан хүргэлт
                  </h4>
                  <p className="text-gray-600">
                    15-30 минутын дотор таны хаалганд хүргэнэ
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Heart className="h-8 w-8 text-red-600" />
                  </div>
                  <h4 className="text-xl font-semibold text-gray-900 mb-2">
                    Чанартай орц
                  </h4>
                  <p className="text-gray-600">
                    Зөвхөн шинэ, чанартай орцуудыг ашигладаг
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Phone className="h-8 w-8 text-blue-600" />
                  </div>
                  <h4 className="text-xl font-semibold text-gray-900 mb-2">
                    Халбар захиалга
                  </h4>
                  <p className="text-gray-600">
                    Бүртгэлгүйгээр халбархан захиалга өгнө
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Delivery Zone Map */}
          <section className="bg-gray-50 py-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-8">
                <h3 className="text-3xl font-bold text-gray-900 mb-4">
                  Хүргэлтийн бүс
                </h3>
                <p className="text-lg text-gray-600">
                  Таны байршил хүргэлтийн бүсэд байгаа эсэхийг шалгаарай
                </p>
              </div>
              <DeliveryMap
                onLocationCheck={(isInZone, distance) => {
                  console.log("Location check:", { isInZone, distance });
                }}
              />
            </div>
          </section>

          {/* Footer */}
          <footer className="bg-gray-900 text-white py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div>
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-lg">🍕</span>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">Гоё Пицца</h3>
                    </div>
                  </div>
                  <p className="text-gray-400">
                    Орон нутгийн хамгийн амттай пицца
                  </p>
                </div>
                <div>
                  <h4 className="text-lg font-semibold mb-4">Холбоо барих</h4>
                  <div className="space-y-2">
                    <p className="text-gray-400 flex items-center">
                      <Phone className="h-4 w-4 mr-2" />
                      +976 1234-5678
                    </p>
                    <p className="text-gray-400">info@goyopizza.mn</p>
                  </div>
                </div>
                <div>
                  <h4 className="text-lg font-semibold mb-4">Ажиллах цаг</h4>
                  <div className="space-y-2 text-gray-400">
                    <p>Даваа - Баасан: 10:00 - 22:00</p>
                    <p>Амралтын өдөр: 11:00 - 23:00</p>
                  </div>
                </div>
              </div>
              <div className="border-t border-gray-800 mt-8 pt-8 text-center">
                <p className="text-gray-400">
                  © 2024 Гоё Пицца. Бүх эрх хуулиар хамгаалагдсан.
                </p>
              </div>
            </div>
          </footer>
        </main>

        {/* Desktop Cart Sidebar - Only show when isCartOpen is true */}
        {isCartOpen && (
          <div className="hidden lg:block w-96 flex-shrink-0">
            <div className="sticky top-0 h-screen">
              <Cart
                cart={cart}
                onUpdateQuantity={updateQuantity}
                onRemoveFromCart={removeFromCart}
                className="h-full"
                user={user}
                onLoginRequired={() => setIsLoginOpen(true)}
                onClose={() => setIsCartOpen(false)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
