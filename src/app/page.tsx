"use client";
import { useEffect, useState } from "react";
import { supabase, Pizza, formatPrice } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingCart,
  Plus,
  Minus,
  Clock,
  Heart,
  Phone,
  Search,
} from "lucide-react";
import Link from "next/link";
import LoginPage from "@/app/login/page";
import Image from "next/image";

interface CartItem extends Pizza {
  quantity: number;
}

export default function HomePage() {
  const [pizzas, setPizzas] = useState<Pizza[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPizzas();
    loadCartFromStorage();
  }, []);

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
              <Link href="/track">
                <Button
                  variant="outline"
                  className="border-red-500 text-red-500 hover:bg-red-50 px-4"
                >
                  <Search className="h-4 w-4 mr-2" />
                  Захиалга хянах
                </Button>
              </Link>
              <Link href="/cart">
                <Button className="relative bg-red-500 hover:bg-red-600 text-white px-6">
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Сагс
                  {getTotalItems() > 0 && (
                    <Badge className="absolute -top-2 -right-2 bg-yellow-500 text-black text-xs min-w-[20px] h-5 rounded-full flex items-center justify-center font-bold">
                      {getTotalItems()}
                    </Badge>
                  )}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
              <span className="text-sm font-medium">💳 Бэлэн мөнгө / QPay</span>
            </div>
          </div>

          {/* Order Tracking CTA */}
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-6 mb-8 text-white text-center">
            <h3 className="text-xl font-bold mb-2">Захиалгаа хянах уу?</h3>
            <p className="text-blue-100 mb-4">
              Утасны дугаараар захиалгынхаа явцыг хянаарай
            </p>
            <Link href="/track">
              <Button className="bg-white text-blue-600 hover:bg-blue-50 font-semibold px-6 py-2">
                <Search className="h-4 w-4 mr-2" />
                Захиалга хянах
              </Button>
            </Link>
          </div>
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

        {/* Cart Summary */}
        {cart.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-4 mb-6">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-lg font-semibold">
                  Сагсанд: {getTotalItems()} ширхэг
                </span>
                <span className="text-xl font-bold text-red-500 ml-4">
                  {formatPrice(getTotalPrice())}
                </span>
              </div>
              <Link href="/cart">
                <Button className="bg-red-500 hover:bg-red-600">
                  Захиалах
                </Button>
              </Link>
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
                Одоогоор идэвхтэй пицца байхгүй байна. Удахгүй шинэ амттай пицца
                нэмэгдэнэ!
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
      </main>

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
              <p className="text-gray-400">Орон нутгийн хамгийн амттай пицца</p>
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
    </div>
  );
}
