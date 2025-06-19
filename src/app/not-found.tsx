"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Home, ArrowLeft, Search, Pizza } from "lucide-react";
import { useEffect } from "react";

// Debug logging for 404 page
const notFoundDebugLog = (message: string, data?: any) => {
  console.log(`[404 Page Debug] ${message}`, data || "");
};

export default function NotFound() {
  useEffect(() => {
    notFoundDebugLog("404 page loaded", {
      url: window.location.href,
      pathname: window.location.pathname,
      timestamp: new Date().toISOString(),
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <Card className="bg-white shadow-lg border-0">
          <CardHeader className="text-center pb-4">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Pizza className="h-10 w-10 text-red-500" />
            </div>
            <CardTitle className="text-6xl font-bold text-red-500 mb-2">
              404
            </CardTitle>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Хуудас олдсонгүй
            </h1>
            <p className="text-gray-600">
              Таны хайж буй хуудас олдсонгүй эсвэл устгагдсан байна.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col space-y-3">
              <Link href="/" className="w-full">
                <Button className="w-full bg-red-500 hover:bg-red-600 text-white">
                  <Home className="h-4 w-4 mr-2" />
                  Нүүр хуудас руу буцах
                </Button>
              </Link>

              <Link href="/track" className="w-full">
                <Button
                  variant="outline"
                  className="w-full border-red-500 text-red-500 hover:bg-red-50"
                >
                  <Search className="h-4 w-4 mr-2" />
                  Захиалга хянах
                </Button>
              </Link>

              <Button
                variant="ghost"
                onClick={() => window.history.back()}
                className="w-full text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Өмнөх хуудас руу буцах
              </Button>
            </div>

            <div className="text-center pt-4 border-t">
              <p className="text-sm text-gray-500">
                Асуудал байвал бидэнтэй холбогдоно уу:
              </p>
              <p className="text-sm font-medium text-gray-700">
                +976 1234-5678
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Brand Footer */}
        <div className="text-center mt-8">
          <div className="flex items-center justify-center space-x-2 text-gray-500">
            <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm">🍕</span>
            </div>
            <span className="text-sm font-medium">Гоё Пицца</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Орон нутгийн хамгийн амттай пицца
          </p>
        </div>
      </div>
    </div>
  );
}
