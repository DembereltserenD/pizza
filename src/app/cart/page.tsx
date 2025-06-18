"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, Pizza, formatPrice, BUILDINGS } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Trash2, ArrowLeft, X, ExternalLink, Copy } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CartItem extends Pizza {
  quantity: number;
}

interface UserInfo {
  building: string;
  floor: string;
  door_number: string;
  phone: string;
}

export default function CartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [userInfo, setUserInfo] = useState<UserInfo>({
    building: "",
    floor: "",
    door_number: "",
    phone: "",
  });
  const [paymentType, setPaymentType] = useState<"qpay" | "cash">("cash");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<UserInfo>>({});
  const [qpayData, setQpayData] = useState<{
    invoice_id: string;
    qr_text: string;
    qr_image: string;
    urls: { name: string; description: string; logo: string; link: string }[];
  } | null>(null);
  const [showQPayModal, setShowQPayModal] = useState(false);

  useEffect(() => {
    loadCartFromStorage();
    loadUserInfoFromStorage();
  }, []);

  const loadCartFromStorage = () => {
    const savedCart = localStorage.getItem("pizza-cart");
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }
  };

  const loadUserInfoFromStorage = () => {
    const savedInfo = localStorage.getItem("userInfo");
    if (savedInfo) {
      setUserInfo(JSON.parse(savedInfo));
    }
  };

  const saveCartToStorage = (newCart: CartItem[]) => {
    localStorage.setItem("pizza-cart", JSON.stringify(newCart));
  };

  const saveUserInfoToStorage = (info: UserInfo) => {
    localStorage.setItem("userInfo", JSON.stringify(info));
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

  const removeFromCart = (pizzaId: string) => {
    const newCart = cart.filter((item) => item.id !== pizzaId);
    setCart(newCart);
    saveCartToStorage(newCart);
  };

  const getTotalPrice = () => {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0);
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<UserInfo> = {};

    if (!userInfo.building) newErrors.building = "Барилга сонгоно уу";
    if (!userInfo.floor) newErrors.floor = "Давхар оруулна уу";
    if (!userInfo.door_number)
      newErrors.door_number = "Хаалганы дугаар оруулна уу";
    if (!userInfo.phone) newErrors.phone = "Утасны дугаар оруулна уу";
    else if (!/^[0-9]{8}$/.test(userInfo.phone)) {
      newErrors.phone = "8 оронтой дугаар оруулна уу";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    if (cart.length === 0) return;

    setLoading(true);

    try {
      const orderData = {
        pizza_items: cart.map((item) => ({
          pizza_id: item.id,
          quantity: item.quantity,
        })),
        total_price: getTotalPrice(),
        building: userInfo.building,
        floor: parseInt(userInfo.floor),
        door_number: userInfo.door_number,
        phone: userInfo.phone,
        payment_type: paymentType,
        is_paid: paymentType === "cash", // Cash orders are immediately marked as paid
      };

      const { data, error } = await supabase
        .from("orders")
        .insert([orderData])
        .select()
        .single();

      if (error) throw error;

      // Save user info for next time
      saveUserInfoToStorage(userInfo);

      if (paymentType === "qpay") {
        // Create QPay payment link
        await handleQPayPayment(data.id);
      } else {
        // Clear cart and redirect for cash orders
        localStorage.removeItem("pizza-cart");
        router.push(`/order-success?id=${data.id}`);
      }
    } catch (error) {
      console.error("Error creating order:", error);
      alert("Захиалга үүсгэхэд алдаа гарлаа. Дахин оролдоно уу.");
    } finally {
      setLoading(false);
    }
  };

  const handleQPayPayment = async (orderId: string) => {
    try {
      const response = await fetch("/api/qpay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create payment link");
      }

      setQpayData(data);
      setShowQPayModal(true);
    } catch (error) {
      console.error("QPay payment error:", error);
      alert("Төлбөрийн холбоос үүсгэхэд алдаа гарлаа. Дахин оролдоно уу.");
    }
  };

  const handleQPaySuccess = () => {
    // Clear cart and redirect
    localStorage.removeItem("pizza-cart");
    setShowQPayModal(false);
    // You might want to redirect to a payment success page or check payment status
    alert("Төлбөр амжилттай төлөгдлөө! Захиалга баталгаажлаа.");
    router.push("/");
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Сагс хоосон байна
          </h2>
          <p className="text-gray-600 mb-6">Пицца сонгоод захиалаарай</p>
          <Link href="/">
            <Button className="bg-orange-600 hover:bg-orange-700">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Буцах
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
              Буцах
            </Link>
            <h1 className="text-2xl font-bold text-orange-600 ml-4">
              🍕 Захиалга
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Cart Items */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Таны захиалга
            </h2>
            <div className="space-y-4">
              {cart.map((item) => (
                <Card key={item.id} className="bg-white">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-4">
                      <div className="relative h-16 w-16 flex-shrink-0">
                        <Image
                          src={item.image_url || "/fallback.jpg"}
                          alt={item.name}
                          fill
                          className="object-cover rounded"
                        />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">
                          {item.name}
                        </h3>
                        <p className="text-orange-600 font-bold">
                          {formatPrice(item.price)}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          onClick={() =>
                            updateQuantity(item.id, item.quantity - 1)
                          }
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0"
                        >
                          -
                        </Button>
                        <span className="w-8 text-center font-semibold">
                          {item.quantity}
                        </span>
                        <Button
                          onClick={() =>
                            updateQuantity(item.id, item.quantity + 1)
                          }
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0"
                        >
                          +
                        </Button>
                        <Button
                          onClick={() => removeFromCart(item.id)}
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="mt-6 p-4 bg-white rounded-lg shadow">
              <div className="flex justify-between items-center text-xl font-bold">
                <span>Нийт дүн:</span>
                <span className="text-orange-600">
                  {formatPrice(getTotalPrice())}
                </span>
              </div>
            </div>
          </div>

          {/* Order Form */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Хүргэлтийн мэдээлэл
            </h2>
            <Card className="bg-white">
              <CardContent className="p-6 space-y-4">
                <div>
                  <Label htmlFor="building">Барилга *</Label>
                  <Select
                    value={userInfo.building}
                    onValueChange={(value) =>
                      setUserInfo({ ...userInfo, building: value })
                    }
                  >
                    <SelectTrigger
                      className={errors.building ? "border-red-500" : ""}
                    >
                      <SelectValue placeholder="Барилга сонгоно уу" />
                    </SelectTrigger>
                    <SelectContent>
                      {BUILDINGS.map((building) => (
                        <SelectItem key={building} value={building}>
                          {building}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.building && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.building}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="floor">Давхар *</Label>
                  <Input
                    id="floor"
                    type="number"
                    min="1"
                    max="20"
                    value={userInfo.floor}
                    onChange={(e) =>
                      setUserInfo({ ...userInfo, floor: e.target.value })
                    }
                    className={errors.floor ? "border-red-500" : ""}
                    placeholder="Давхар"
                  />
                  {errors.floor && (
                    <p className="text-red-500 text-sm mt-1">{errors.floor}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="door_number">Хаалганы дугаар *</Label>
                  <Input
                    id="door_number"
                    value={userInfo.door_number}
                    onChange={(e) =>
                      setUserInfo({ ...userInfo, door_number: e.target.value })
                    }
                    className={errors.door_number ? "border-red-500" : ""}
                    placeholder="Хаалганы дугаар"
                  />
                  {errors.door_number && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.door_number}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="phone">Утасны дугаар *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={userInfo.phone}
                    onChange={(e) =>
                      setUserInfo({ ...userInfo, phone: e.target.value })
                    }
                    className={errors.phone ? "border-red-500" : ""}
                    placeholder="99112233"
                  />
                  {errors.phone && (
                    <p className="text-red-500 text-sm mt-1">{errors.phone}</p>
                  )}
                </div>

                <div>
                  <Label>Төлбөрийн хэлбэр *</Label>
                  <RadioGroup
                    value={paymentType}
                    onValueChange={(value: "qpay" | "cash") =>
                      setPaymentType(value)
                    }
                    className="mt-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="cash" id="cash" />
                      <Label htmlFor="cash">Бэлэн мөнгө</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="qpay" id="qpay" />
                      <Label htmlFor="qpay">QPay</Label>
                    </div>
                  </RadioGroup>
                </div>

                <Button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-lg py-3 mt-6"
                >
                  {loading ? "Захиалж байна..." : "Захиалах"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* QPay Payment Modal */}
      <Dialog open={showQPayModal} onOpenChange={setShowQPayModal}>
        <DialogContent className="max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle className="text-center text-xl font-bold text-gray-900">
              QPay төлбөр
            </DialogTitle>
          </DialogHeader>
          {qpayData && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-gray-600 mb-4">
                  QR код уншуулж эсвэл доорх холбоосоор төлбөр төлнө үү
                </p>

                {/* QR Code */}
                <div className="flex justify-center mb-4">
                  <Image
                    src={qpayData.qr_image}
                    alt="QPay QR Code"
                    width={200}
                    height={200}
                    className="border rounded-lg"
                  />
                </div>

                {/* Payment Amount */}
                <div className="bg-orange-50 p-3 rounded-lg mb-4">
                  <p className="text-sm text-gray-600">Төлөх дүн:</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {formatPrice(getTotalPrice())}
                  </p>
                </div>

                {/* Payment Apps */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Төлбөрийн апп сонгох:
                  </p>
                  {qpayData.urls.map((url, index) => (
                    <a
                      key={index}
                      href={url.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <Image
                          src={url.logo}
                          alt={url.name}
                          width={32}
                          height={32}
                          className="rounded"
                        />
                        <div className="text-left">
                          <p className="font-medium text-gray-900">
                            {url.name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {url.description}
                          </p>
                        </div>
                      </div>
                      <ExternalLink className="h-4 w-4 text-gray-400" />
                    </a>
                  ))}
                </div>

                {/* Copy QR Text */}
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(qpayData.qr_text);
                    alert("QR текст хуулагдлаа!");
                  }}
                  variant="outline"
                  className="w-full mt-4"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  QR текст хуулах
                </Button>

                {/* Success Button */}
                <Button
                  onClick={handleQPaySuccess}
                  className="w-full bg-green-600 hover:bg-green-700 mt-4"
                >
                  Төлбөр төлөгдсөн
                </Button>

                <p className="text-xs text-gray-500 text-center mt-2">
                  Төлбөр төлсний дараа дээрх товчийг дарна уу
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
