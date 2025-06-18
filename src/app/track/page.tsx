"use client";

import { useState } from "react";
import {
  supabase,
  Order,
  Pizza,
  formatPrice,
  formatTime,
} from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { OrderStatus } from "@/components/OrderStatus";
import { ArrowLeft, Search, Phone } from "lucide-react";
import Link from "next/link";

interface OrderWithPizzas extends Order {
  pizzas: { pizza: Pizza; quantity: number }[];
}

export default function TrackPage() {
  const [phone, setPhone] = useState("");
  const [orders, setOrders] = useState<OrderWithPizzas[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const searchOrders = async () => {
    if (!phone.trim()) return;

    setLoading(true);
    setSearched(true);

    try {
      // Get orders by phone
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .eq("phone", phone.trim())
        .order("created_at", { ascending: false });

      if (ordersError) throw ordersError;

      if (!ordersData || ordersData.length === 0) {
        setOrders([]);
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

      setOrders(ordersWithPizzas);
    } catch (error) {
      console.error("Error searching orders:", error);
      alert("Захиалга хайхад алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      searchOrders();
    }
  };

  return (
    <div className="min-h-screen bg-orange-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b-2 border-orange-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Link
              href="/"
              className="flex items-center text-orange-600 hover:text-orange-700"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Буцах
            </Link>
            <h1 className="text-2xl font-bold text-orange-600 ml-4">
              🍕 Захиалга хянах
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Form */}
        <Card className="bg-white mb-8">
          <CardHeader>
            <CardTitle className="text-center">
              Утасны дугаараар захиалга хайх
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex space-x-4">
              <div className="flex-1">
                <Label htmlFor="phone">Утасны дугаар</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="99112233"
                  className="text-lg"
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={searchOrders}
                  disabled={loading || !phone.trim()}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <Search className="h-4 w-4 mr-2" />
                  )}
                  Хайх
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {searched && (
          <div>
            {orders.length === 0 ? (
              <Card className="bg-white">
                <CardContent className="p-8 text-center">
                  <p className="text-lg text-gray-600">
                    Энэ дугаараар захиалга олдсонгүй
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    Дугаараа шалгаад дахин оролдоно уу
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-gray-900">
                  Таны захиалгууд ({orders.length})
                </h2>
                {orders.map((order) => (
                  <Card key={order.id} className="bg-white">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">
                            Захиалга #{order.id.slice(-8)}
                          </CardTitle>
                          <p className="text-sm text-gray-600">
                            {formatTime(order.created_at)}
                          </p>
                        </div>
                        <OrderStatus
                          status={
                            order.status as
                              | "pending"
                              | "accepted"
                              | "on_delivery"
                              | "delivered"
                          }
                          showIcon={true}
                        />
                      </div>
                    </CardHeader>
                    <CardContent>
                      {/* Pizza Items */}
                      <div className="mb-4">
                        <h4 className="font-semibold mb-2">Захиалсан пицца:</h4>
                        <div className="space-y-2">
                          {order.pizzas.map((item, index) => (
                            <div
                              key={index}
                              className="flex justify-between items-center"
                            >
                              <span>
                                {item.pizza.name} × {item.quantity}
                              </span>
                              <span className="font-semibold">
                                {formatPrice(item.pizza.price * item.quantity)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Order Details */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <h4 className="font-semibold mb-2">
                            Хүргэлтийн хаяг:
                          </h4>
                          <p className="text-sm text-gray-600">
                            {order.building}, {order.floor} давхар,{" "}
                            {order.door_number} тоот
                          </p>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-2">Холбоо барих:</h4>
                          <div className="flex items-center text-sm text-gray-600">
                            <Phone className="h-4 w-4 mr-1" />
                            <a
                              href={`tel:${order.phone}`}
                              className="hover:text-orange-600"
                            >
                              {order.phone}
                            </a>
                          </div>
                        </div>
                      </div>

                      {/* Total and Payment */}
                      <div className="flex justify-between items-center pt-4 border-t">
                        <div>
                          <span className="text-sm text-gray-600">
                            Төлбөр:{" "}
                          </span>
                          <span className="font-semibold">
                            {order.payment_type === "cash"
                              ? "Бэлэн мөнгө"
                              : "QPay"}
                          </span>
                          {order.is_paid && (
                            <Badge className="ml-2 bg-green-100 text-green-800">
                              Төлөгдсөн
                            </Badge>
                          )}
                        </div>
                        <div className="text-xl font-bold text-orange-600">
                          {formatPrice(order.total_price)}
                        </div>
                      </div>

                      {order.delivered_at && (
                        <div className="mt-4 p-3 bg-green-50 rounded-lg">
                          <p className="text-sm text-green-800">
                            <strong>Хүргэгдсэн:</strong>{" "}
                            {formatTime(order.delivered_at)}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
