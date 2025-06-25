"use client";
import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  Navigation,
  Search,
  AlertCircle,
  CheckCircle,
} from "lucide-react";

// Dynamic import to avoid SSR issues with Leaflet
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false },
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false },
);
const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false },
);
const Popup = dynamic(() => import("react-leaflet").then((mod) => mod.Popup), {
  ssr: false,
});
const Polygon = dynamic(
  () => import("react-leaflet").then((mod) => mod.Polygon),
  { ssr: false },
);

// Restaurant and delivery zone coordinates (Ulaanbaatar, Mongolia)
const RESTAURANT_LOCATION = [47.9184, 106.9177] as [number, number]; // Central Ulaanbaatar
const DELIVERY_BOUNDARY = [
  [47.9284, 106.9277], // North-East
  [47.9284, 106.9077], // North-West
  [47.9084, 106.9077], // South-West
  [47.9084, 106.9277], // South-East
] as [number, number][];

interface DeliveryMapProps {
  onLocationCheck?: (isInZone: boolean, distance?: number) => void;
}

interface LocationState {
  lat: number;
  lng: number;
  address?: string;
}

const DeliveryMap: React.FC<DeliveryMapProps> = ({ onLocationCheck }) => {
  const [userLocation, setUserLocation] = useState<LocationState | null>(null);
  const [addressInput, setAddressInput] = useState("");
  const [isInDeliveryZone, setIsInDeliveryZone] = useState<boolean | null>(
    null,
  );
  const [distance, setDistance] = useState<number | null>(null);
  const [locationPermission, setLocationPermission] = useState<
    "granted" | "denied" | "prompt" | null
  >(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [showBoundary, setShowBoundary] = useState(true);
  const mapRef = useRef<any>(null);

  // Point-in-polygon algorithm
  const isPointInPolygon = (
    point: [number, number],
    polygon: [number, number][],
  ): boolean => {
    const [x, y] = point;
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i];
      const [xj, yj] = polygon[j];

      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }

    return inside;
  };

  // Calculate distance between two points (Haversine formula)
  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Check if location is in delivery zone
  const checkDeliveryZone = (location: LocationState) => {
    const inZone = isPointInPolygon(
      [location.lat, location.lng],
      DELIVERY_BOUNDARY,
    );
    const dist = calculateDistance(
      location.lat,
      location.lng,
      RESTAURANT_LOCATION[0],
      RESTAURANT_LOCATION[1],
    );

    setIsInDeliveryZone(inZone);
    setDistance(dist);
    onLocationCheck?.(inZone, dist);
  };

  // Get user's current location with proper permission handling
  const getCurrentLocation = async () => {
    if (!navigator.geolocation) {
      alert("Таны хөтөч байршлын үйлчилгээг дэмждэггүй.");
      return;
    }

    // Check current permission status
    if (navigator.permissions) {
      try {
        const permission = await navigator.permissions.query({
          name: "geolocation",
        });
        setLocationPermission(permission.state);

        if (permission.state === "denied") {
          alert(
            "Байршлын зөвшөөрөл хаагдсан байна. Хөтчийн тохиргооноос нээнэ үү.",
          );
          return;
        }
      } catch (error) {
        console.log("Permission API not supported");
      }
    }

    setIsGettingLocation(true);

    try {
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 300000, // 5 minutes
          });
        },
      );

      const newLocation: LocationState = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        address: "Таны одоогийн байршил",
      };

      setUserLocation(newLocation);
      setLocationPermission("granted");
      checkDeliveryZone(newLocation);

      // Center map on user location
      if (mapRef.current) {
        mapRef.current.setView([newLocation.lat, newLocation.lng], 15);
      }
    } catch (error: any) {
      console.error("Error getting location:", error);
      setLocationPermission("denied");

      let errorMessage = "Байршлын мэдээлэл авах боломжгүй. ";

      if (error.code === 1) {
        errorMessage += "Байршлын зөвшөөрөл шаардлагатай.";
      } else if (error.code === 2) {
        errorMessage += "Байршлын мэдээлэл олдсонгүй.";
      } else if (error.code === 3) {
        errorMessage += "Хугацаа дууссан.";
      } else {
        errorMessage += "Гараар хаяг оруулна уу.";
      }

      alert(errorMessage);
    } finally {
      setIsGettingLocation(false);
    }
  };

  // Handle address input with Mongolia-specific locations
  const handleAddressCheck = () => {
    if (!addressInput.trim()) return;

    // Common Mongolia locations for demo
    const mongoliaLocations = {
      сүхбаатар: [47.9184, 106.9177],
      баянзүрх: [47.9084, 106.9377],
      чингэлтэй: [47.9284, 106.9077],
      "хан-уул": [47.8984, 106.9277],
      баянгол: [47.9384, 106.9177],
      сонгинохайрхан: [47.9184, 106.8877],
    };

    const searchTerm = addressInput.toLowerCase();
    let demoLocation: LocationState;

    // Check if input matches known districts
    const matchedDistrict = Object.keys(mongoliaLocations).find((district) =>
      searchTerm.includes(district),
    );

    if (matchedDistrict) {
      const [lat, lng] =
        mongoliaLocations[matchedDistrict as keyof typeof mongoliaLocations];
      demoLocation = {
        lat: lat + (Math.random() - 0.5) * 0.01,
        lng: lng + (Math.random() - 0.5) * 0.01,
        address: addressInput,
      };
    } else {
      // Default to restaurant area with random offset
      demoLocation = {
        lat: RESTAURANT_LOCATION[0] + (Math.random() - 0.5) * 0.02,
        lng: RESTAURANT_LOCATION[1] + (Math.random() - 0.5) * 0.02,
        address: addressInput,
      };
    }

    setUserLocation(demoLocation);
    checkDeliveryZone(demoLocation);

    // Center map on the location
    if (mapRef.current) {
      mapRef.current.setView([demoLocation.lat, demoLocation.lng], 15);
    }
  };

  // Estimate delivery time based on distance
  const getEstimatedDeliveryTime = (distance: number): string => {
    if (distance < 0.5) return "15-20 минут";
    if (distance < 1) return "20-25 минут";
    if (distance < 1.5) return "25-30 минут";
    return "30-35 минут";
  };

  // Custom icon creation (client-side only)
  const createCustomIcon = (color: string, icon: string) => {
    if (typeof window === "undefined") return null;

    try {
      const L = require("leaflet");
      return L.divIcon({
        html: `<div style="background-color: ${color}; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); font-size: 16px;">${icon}</div>`,
        className: "custom-div-icon",
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
    } catch (error) {
      console.error("Error creating custom icon:", error);
      return null;
    }
  };

  if (typeof window === "undefined") {
    return (
      <div className="bg-white rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-96 bg-gray-200 rounded-lg mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Map Container */}
      <div className="relative h-96 w-full">
        <MapContainer
          center={RESTAURANT_LOCATION}
          zoom={16}
          style={{ height: "100%", width: "100%" }}
          ref={mapRef}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          {/* Restaurant Marker */}
          <Marker
            position={RESTAURANT_LOCATION}
            icon={createCustomIcon("#ef4444", "🍕") || undefined}
          >
            <Popup>
              <div className="text-center">
                <h3 className="font-bold text-lg">Гоё Пицца</h3>
                <p className="text-sm text-gray-600">Үндсэн цэг</p>
                <p className="text-xs text-gray-500">
                  {RESTAURANT_LOCATION[0].toFixed(6)},{" "}
                  {RESTAURANT_LOCATION[1].toFixed(6)}
                </p>
              </div>
            </Popup>
          </Marker>

          {/* User Location Marker */}
          {userLocation && (
            <Marker
              position={[userLocation.lat, userLocation.lng]}
              icon={
                createCustomIcon(
                  isInDeliveryZone ? "#22c55e" : "#ef4444",
                  isInDeliveryZone ? "✓" : "✗",
                ) || undefined
              }
            >
              <Popup>
                <div className="text-center">
                  <h3 className="font-bold">
                    {userLocation.address || "Таны байршил"}
                  </h3>
                  <p className="text-sm">
                    {isInDeliveryZone ? (
                      <span className="text-green-600">
                        ✓ Хүргэлтийн бүсэд байна
                      </span>
                    ) : (
                      <span className="text-red-600">
                        ✗ Хүргэлтийн бүсээс гадуур
                      </span>
                    )}
                  </p>
                  {distance && (
                    <p className="text-xs text-gray-500">
                      Зай: {distance.toFixed(2)} км
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          )}

          {/* Delivery Boundary Polygon */}
          {showBoundary && (
            <Polygon
              positions={DELIVERY_BOUNDARY}
              pathOptions={{
                color: "#f97316",
                weight: 3,
                opacity: 0.8,
                fillColor: "#f97316",
                fillOpacity: 0.2,
              }}
            >
              <Popup>
                <div className="text-center">
                  <h3 className="font-bold">Хүргэлтийн бүс</h3>
                  <p className="text-sm text-gray-600">
                    Энэ бүсэд хүргэлт хийдэг
                  </p>
                </div>
              </Popup>
            </Polygon>
          )}
        </MapContainer>

        {/* Map Controls */}
        <div className="absolute top-4 right-4 space-y-2">
          <Button
            onClick={() => setShowBoundary(!showBoundary)}
            variant="outline"
            size="sm"
            className="bg-white shadow-md"
          >
            {showBoundary ? "Бүс нуух" : "Бүс харуулах"}
          </Button>
        </div>
      </div>

      {/* Controls Panel */}
      <div className="p-6 space-y-4">
        {/* Location Controls */}
        <div className="space-y-3">
          {/* Permission Status */}
          {locationPermission && (
            <div
              className={`p-3 rounded-lg text-sm ${
                locationPermission === "granted"
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : locationPermission === "denied"
                    ? "bg-red-50 text-red-800 border border-red-200"
                    : "bg-yellow-50 text-yellow-800 border border-yellow-200"
              }`}
            >
              {locationPermission === "granted" &&
                "✅ Байршлын зөвшөөрөл олгогдсон"}
              {locationPermission === "denied" &&
                "❌ Байршлын зөвшөөрөл хаагдсан - Хөтчийн тохиргооноос нээнэ үү"}
              {locationPermission === "prompt" &&
                "⏳ Байршлын зөвшөөрөл хүлээгдэж байна"}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={getCurrentLocation}
              disabled={isGettingLocation || locationPermission === "denied"}
              className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400"
            >
              <Navigation className="h-4 w-4 mr-2" />
              {isGettingLocation ? "Байршил авч байна..." : "Миний байршил"}
            </Button>

            <div className="flex flex-1 gap-2">
              <Input
                placeholder="Хаяг оруулах (жнь: Сүхбаатар дүүрэг)..."
                value={addressInput}
                onChange={(e) => setAddressInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleAddressCheck()}
                className="flex-1"
              />
              <Button
                onClick={handleAddressCheck}
                variant="outline"
                disabled={!addressInput.trim()}
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Delivery Status */}
        {userLocation && isInDeliveryZone !== null && (
          <Card
            className={`border-2 ${isInDeliveryZone ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}
          >
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                {isInDeliveryZone ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="text-green-800">Хүргэлт хийдэг!</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <span className="text-red-800">
                      Хүргэлтийн бүсээс гадуур
                    </span>
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Зай ресторанаас:</p>
                  <p className="font-semibold">{distance?.toFixed(2)} км</p>
                </div>
                {isInDeliveryZone && distance && (
                  <>
                    <div>
                      <p className="text-gray-600">Хүргэх хугацаа:</p>
                      <p className="font-semibold">
                        {getEstimatedDeliveryTime(distance)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Статус:</p>
                      <Badge className="bg-green-500 hover:bg-green-600">
                        Хүргэлт боломжтой
                      </Badge>
                    </div>
                  </>
                )}
              </div>

              {!isInDeliveryZone && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>Анхаар:</strong> Таны байршил хүргэлтийн бүсээс
                    гадуур байна. Бидэн одоогоор зөвхөн тодорхой бүсэд хүргэлт
                    хийдэг.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Zone Information */}
        <Card className="bg-gray-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5 text-orange-600" />
              Хүргэлтийн мэдээлэл
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600 mb-1">Хүргэлтийн цаг:</p>
                <p className="font-medium">10:00 - 22:00 (өдөр бүр)</p>
              </div>
              <div>
                <p className="text-gray-600 mb-1">Хүргэлтийн төлбөр:</p>
                <p className="font-medium">Үнэгүй</p>
              </div>
              <div>
                <p className="text-gray-600 mb-1">Хамгийн бага захиалга:</p>
                <p className="font-medium">15,000₮</p>
              </div>
              <div>
                <p className="text-gray-600 mb-1">Төлбөрийн хэлбэр:</p>
                <p className="font-medium">Бэлэн мөнгө, QPay</p>
              </div>
              <div>
                <p className="text-gray-600 mb-1">Хүргэлтийн бүс:</p>
                <p className="font-medium">Улаанбаатар хот</p>
              </div>
              <div>
                <p className="text-gray-600 mb-1">Холбоо барих:</p>
                <p className="font-medium">+976 1234-5678</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DeliveryMap;
