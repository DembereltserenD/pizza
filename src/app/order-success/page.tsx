"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  supabase,
  Order,
  Pizza,
  formatPrice,
  formatTime,
} from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, ArrowLeft, Clock, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface OrderWithPizzas extends Order {
  pizzas: (Pizza & { quantity: number })[];
}

export default function OrderSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams.get("id");
  const [order, setOrder] = useState<OrderWithPizzas | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setError("Захиалгын ID олдсонгүй");
      setLoading(false);
      return;
    }

    fetchOrderDetails();
  }, [orderId]);

  const fetchOrderDetails = async () => {
    if (!supabase || !orderId) return;

    try {
      // Fetch order details
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();

      if (orderError) throw orderError;

      // Fetch pizza details for each item in the order
      const pizzaIds = orderData.pizza_items.map((item: any) => item.pizza_id);
      const { data: pizzasData, error: pizzasError } = await supabase
        .from("pizzas")
        .select("*")
        .in("id", pizzaIds);

      if (pizzasError) throw pizzasError;

      // Combine order data with pizza details
      const pizzasWithQuantity = orderData.pizza_items.map((item: any) => {
        const pizza = pizzasData.find((p) => p.id === item.pizza_id);
        return {
          ...pizza,
          quantity: item.quantity,
        };
      });

      setOrder({
        ...orderData,
        pizzas: pizzasWithQuantity,
      });
    } catch (error) {
      console.error("Error fetching order:", error);
      setError("Захиалгын мэдээлэл татахад алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return "Хүлээгдэж байна";
      case "accepted":
        return "Баталгаажсан";
      case "on_delivery":
        return "Хүргэлтэнд";
      case "delivered":
        return "Хүргэгдсэн";
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "accepted":
        return "bg-blue-100 text-blue-800";
      case "on_delivery":
        return "bg-orange-100 text-orange-800";
      case "delivered":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Захиалгын мэдээлэл татаж байна...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Алдаа гарлаа
          </h2>
          <p className="text-gray-600 mb-6">{error || "Захиалга олдсонгүй"}</p>
          <Link href="/">
            <Button className="bg-orange-600 hover:bg-orange-700">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Нүүр хуудас руу буцах
            </Button>
          </Link>
        </div>
      </div>
    );
  }

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
              Нүүр хуудас
            </Link>
            <h1 className="text-2xl font-bold text-orange-600 ml-4">
              🍕 Захиалга амжилттай
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success Message */}
        <div className="text-center mb-8">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Баярлалаа!</h2>
          <p className="text-gray-600 text-lg">
            Таны захиалга амжилттай бүртгэгдлээ
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Order Details */}
          <div>
            <Card className="bg-white mb-6">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Захиалгын мэдээлэл</span>
                  <Badge className={getStatusColor(order.status)}>
                    {getStatusText(order.status)}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center text-gray-600">
                  <Clock className="h-4 w-4 mr-2" />
                  <span>Захиалгын огноо: {formatTime(order.created_at)}</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <span className="font-semibold mr-2">Захиалгын дугаар:</span>
                  <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                    #{order.id.slice(-8).toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center text-gray-600">
                  <span className="font-semibold mr-2">Төлбөрийн хэлбэр:</span>
                  <span className="capitalize">
                    {order.payment_type === "qpay" ? "QPay" : "Бэлэн мөнгө"}
                  </span>
                </div>
                <div className="flex items-center text-gray-600">
                  <span className="font-semibold mr-2">Төлбөрийн төлөв:</span>
                  <Badge
                    className={
                      order.is_paid
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }
                  >
                    {order.is_paid ? "Төлөгдсөн" : "Төлөгдөөгүй"}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Delivery Information */}
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MapPin className="h-5 w-5 mr-2" />
                  Хүргэлтийн хаяг
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-gray-700">
                  <span className="font-semibold">Барилга:</span>{" "}
                  {order.building}
                </p>
                <p className="text-gray-700">
                  <span className="font-semibold">Давхар:</span> {order.floor}
                </p>
                <p className="text-gray-700">
                  <span className="font-semibold">Хаалганы дугаар:</span>{" "}
                  {order.door_number}
                </p>
                <div className="flex items-center text-gray-700 pt-2">
                  <Phone className="h-4 w-4 mr-2" />
                  <span>{order.phone}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Order Items */}
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Захиалсан бүтээгдэхүүн
            </h3>
            <div className="space-y-4 mb-6">
              {order.pizzas.map((pizza, index) => (
                <Card key={index} className="bg-white">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-4">
                      <div className="relative h-16 w-16 flex-shrink-0">
                        <Image
                          src={pizza.image_url || "/fallback.jpg"}
                          alt={pizza.name}
                          fill
                          className="object-cover rounded"
                        />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">
                          {pizza.name}
                        </h4>
                        <p className="text-gray-600">
                          {formatPrice(pizza.price)} × {pizza.quantity}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-orange-600">
                          {formatPrice(pizza.price * pizza.quantity)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Total */}
            <Card className="bg-orange-50 border-orange-200">
              <CardContent className="p-4">
                <div className="flex justify-between items-center text-xl font-bold">
                  <span>Нийт дүн:</span>
                  <span className="text-orange-600">
                    {formatPrice(order.total_price)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="mt-6 space-y-3">
              <Link href="/track" className="block">
                <Button className="w-full bg-orange-600 hover:bg-orange-700">
                  Захиалга хянах
                </Button>
              </Link>
              <Link href="/" className="block">
                <Button variant="outline" className="w-full">
                  Дахин захиалах
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
