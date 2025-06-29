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
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Trash2,
  ShoppingCart,
  X,
  ExternalLink,
  Copy,
  LogIn,
  User,
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface CartItem extends Pizza {
  quantity: number;
}

interface UserInfo {
  building: string;
  floor: string;
  door_number: string;
  phone: string;
}

interface CartProps {
  cart: CartItem[];
  onUpdateQuantity: (pizzaId: string, newQuantity: number) => void;
  onRemoveFromCart: (pizzaId: string) => void;
  className?: string;
  isMobile?: boolean;
  user?: any;
  onLoginRequired?: () => void;
}

export default function Cart({
  cart,
  onUpdateQuantity,
  onRemoveFromCart,
  className,
  isMobile = false,
  user,
  onLoginRequired,
}: CartProps) {
  const router = useRouter();
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
  const [isOpen, setIsOpen] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [isVerificationStep, setIsVerificationStep] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    loadUserInfoFromStorage();
  }, []);

  const loadUserInfoFromStorage = () => {
    const savedInfo = localStorage.getItem("userInfo");
    if (savedInfo) {
      setUserInfo(JSON.parse(savedInfo));
    }
  };

  const saveUserInfoToStorage = (info: UserInfo) => {
    localStorage.setItem("userInfo", JSON.stringify(info));
  };

  const getTotalPrice = () => {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0);
  };

  const getTotalItems = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
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

    // Check if user is logged in
    if (!user) {
      if (onLoginRequired) {
        onLoginRequired();
      } else {
        setShowLoginPrompt(true);
      }
      return;
    }

    setLoading(true);

    try {
      // Get current authenticated user
      const {
        data: { user },
      } = await supabase.auth.getUser();

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
        // Include user_id if user is authenticated
        ...(user && { user_id: user.id }),
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
    alert("Төлбөр амжилттай төлөгдлөө! Захиалга баталгаажлаа.");
    router.push("/");
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
        setShowLoginPrompt(false);
        setIsVerificationStep(false);
        setPhoneNumber("");
        setVerificationCode("");
        setLoginError("");
        // Refresh the page to update user state
        window.location.reload();
      }
    } catch (err) {
      setLoginError("Системийн алдаа гарлаа. Дахин оролдоно уу.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const resetLoginForm = () => {
    setIsVerificationStep(false);
    setPhoneNumber("");
    setVerificationCode("");
    setLoginError("");
  };

  const CartContent = () => (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 flex items-center">
            <ShoppingCart className="h-5 w-5 mr-2" />
            Сагс ({getTotalItems()})
          </h2>
          {isMobile && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="p-2"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {cart.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">
              Сагс хоосон байна
            </h3>
            <p className="text-gray-500">Пицца сонгоод захиалаарай</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {/* Cart Items */}
          <div className="p-4 space-y-4">
            {cart.map((item) => (
              <Card key={item.id} className="bg-gray-50">
                <CardContent className="p-3">
                  <div className="flex items-center space-x-3">
                    <div className="relative h-12 w-12 flex-shrink-0">
                      <Image
                        src={item.image_url || "/fallback.jpg"}
                        alt={item.name}
                        fill
                        className="object-cover rounded"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-sm truncate">
                        {item.name}
                      </h3>
                      <p className="text-red-600 font-bold text-sm">
                        {formatPrice(item.price)}
                      </p>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Button
                        onClick={() =>
                          onUpdateQuantity(item.id, item.quantity - 1)
                        }
                        variant="outline"
                        size="sm"
                        className="h-6 w-6 p-0 text-xs"
                      >
                        -
                      </Button>
                      <span className="w-6 text-center font-semibold text-sm">
                        {item.quantity}
                      </span>
                      <Button
                        onClick={() =>
                          onUpdateQuantity(item.id, item.quantity + 1)
                        }
                        variant="outline"
                        size="sm"
                        className="h-6 w-6 p-0 text-xs"
                      >
                        +
                      </Button>
                      <Button
                        onClick={() => onRemoveFromCart(item.id)}
                        variant="outline"
                        size="sm"
                        className="h-6 w-6 p-0 text-red-600 hover:text-red-700 text-xs ml-1"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Total */}
          <div className="p-4 border-t bg-gray-50">
            <div className="flex justify-between items-center text-lg font-bold mb-4">
              <span>Нийт дүн:</span>
              <span className="text-red-600">
                {formatPrice(getTotalPrice())}
              </span>
            </div>

            {/* Login Required Message */}
            {!user && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-center space-x-2 text-blue-700 mb-2">
                  <User className="h-5 w-5" />
                  <span className="font-semibold">Нэвтрэх шаардлагатай</span>
                </div>
                <p className="text-blue-600 text-sm mb-3">
                  Захиалга өгөхийн тулд эхлээд нэвтэрнэ үү
                </p>
                <Button
                  onClick={() => setShowLoginPrompt(true)}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white"
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  Нэвтрэх
                </Button>
              </div>
            )}

            {/* Order Form - Only show if user is logged in */}
            {user && (
              <div className="space-y-4">
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

                <div className="grid grid-cols-2 gap-2">
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
                      <p className="text-red-500 text-sm mt-1">
                        {errors.floor}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="door_number">Хаалга *</Label>
                    <Input
                      id="door_number"
                      value={userInfo.door_number}
                      onChange={(e) =>
                        setUserInfo({
                          ...userInfo,
                          door_number: e.target.value,
                        })
                      }
                      className={errors.door_number ? "border-red-500" : ""}
                      placeholder="Хаалга"
                    />
                    {errors.door_number && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.door_number}
                      </p>
                    )}
                  </div>
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
                  className="w-full bg-red-600 hover:bg-red-700 text-white py-3 mt-4"
                >
                  {loading ? "Захиалж байна..." : "Захиалах"}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

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
                <div className="bg-red-50 p-3 rounded-lg mb-4">
                  <p className="text-sm text-gray-600">Төлөх дүн:</p>
                  <p className="text-2xl font-bold text-red-600">
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

      {/* Login Modal */}
      <Dialog
        open={showLoginPrompt}
        onOpenChange={(open) => {
          setShowLoginPrompt(open);
          if (!open) resetLoginForm();
        }}
      >
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
                : "Захиалга өгөхийн тулд утасны дугаараа оруулснаар SMS-ээр баталгаажуулах код илгээгдэнэ"}
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
                  onChange={(e) => setVerificationCode(e.target.value)}
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
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerTrigger asChild>
          <Button className="relative bg-red-500 hover:bg-red-600 text-white px-6">
            <ShoppingCart className="h-4 w-4 mr-2" />
            Сагс
            {getTotalItems() > 0 && (
              <span className="absolute -top-2 -right-2 bg-yellow-500 text-black text-xs min-w-[20px] h-5 rounded-full flex items-center justify-center font-bold">
                {getTotalItems()}
              </span>
            )}
          </Button>
        </DrawerTrigger>
        <DrawerContent className="h-[90vh]">
          <DrawerHeader className="pb-0">
            <DrawerTitle className="sr-only">Сагс</DrawerTitle>
          </DrawerHeader>
          <CartContent />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <div className={cn("bg-white border-l border-gray-200", className)}>
      <CartContent />
    </div>
  );
}
