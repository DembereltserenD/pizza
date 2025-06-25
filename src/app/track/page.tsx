"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Home } from "lucide-react";
import Link from "next/link";

export default function TrackPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to homepage after a short delay
    const timer = setTimeout(() => {
      router.push("/");
    }, 3000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center">
      <Card className="max-w-md mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gray-900">
            🍕 Захиалга хянах
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <div className="text-6xl mb-4">📱</div>
          <h3 className="text-xl font-semibold text-gray-800">Шинэ систем!</h3>
          <p className="text-gray-600">
            Одоо утасны дугаараар нэвтэрснээр захиалгаа шууд үндсэн хуудаснаас
            харах боломжтой боллоо.
          </p>
          <div className="space-y-3 pt-4">
            <Link href="/">
              <Button className="w-full bg-orange-600 hover:bg-orange-700">
                <Home className="h-4 w-4 mr-2" />
                Үндсэн хуудас руу шилжих
              </Button>
            </Link>
            <p className="text-sm text-gray-500">
              3 секундын дараа автоматаар шилжинэ...
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
