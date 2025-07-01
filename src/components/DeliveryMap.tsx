import React, { useState, useEffect, useRef } from "react";
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
  Wifi,
  Smartphone,
} from "lucide-react";

// Updated Mongolia coordinates - Ulaanbaatar city center
const RESTAURANT_LOCATION = [47.9184, 106.9177] as [number, number];
const DELIVERY_BOUNDARY = [
  [47.93, 106.9],
  [47.93, 106.93],
  [47.9, 106.93],
  [47.9, 106.9],
  [47.93, 106.9], // Square delivery zone around UB center
] as [number, number][];

interface DeliveryMapProps {
  onLocationCheck?: (isInZone: boolean, distance?: number) => void;
}

interface LocationState {
  lat: number;
  lng: number;
  address?: string;
  accuracy?: number;
  source?: string;
}

const DeliveryMap: React.FC<DeliveryMapProps> = ({ onLocationCheck }) => {
  const [userLocation, setUserLocation] = useState<LocationState | null>(null);
  const [addressInput, setAddressInput] = useState("");
  const [isInDeliveryZone, setIsInDeliveryZone] = useState<boolean | null>(
    null,
  );
  const [distance, setDistance] = useState<number | null>(null);
  const [locationPermission, setLocationPermission] = useState<string | null>(
    null,
  );
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [mapCenter, setMapCenter] =
    useState<[number, number]>(RESTAURANT_LOCATION);
  const [showBoundary, setShowBoundary] = useState(true);
  const [ipLocation, setIpLocation] = useState<LocationState | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);

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

  // Calculate distance between two points
  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number => {
    const R = 6371;
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

  // Check delivery zone
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

  // Get IP-based location (for comparison)
  const getIpLocation = async () => {
    try {
      const response = await fetch("https://ipapi.co/json/");
      const data = await response.json();

      if (data.latitude && data.longitude) {
        const ipLoc: LocationState = {
          lat: data.latitude,
          lng: data.longitude,
          address: `${data.city || ""}, ${data.country_name || ""}`,
          source: "IP-based",
        };
        setIpLocation(ipLoc);
        setDebugInfo(data);
        return ipLoc;
      }
    } catch (error) {
      console.error("IP location failed:", error);
    }
    return null;
  };

  // Get GPS location with enhanced error handling
  const getCurrentLocation = async () => {
    if (!navigator.geolocation) {
      alert("Таны хөтөч байршлын үйлчилгээг дэмждэггүй.");
      return;
    }

    setIsGettingLocation(true);

    // Also get IP location for comparison
    await getIpLocation();

    try {
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 30000, // Increased timeout for Mongolia
            maximumAge: 60000, // 1 minute cache
          });
        },
      );

      const newLocation: LocationState = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        address: "GPS байршил",
        accuracy: position.coords.accuracy,
        source: "GPS",
      };

      setUserLocation(newLocation);
      setLocationPermission("granted");
      checkDeliveryZone(newLocation);
      setMapCenter([newLocation.lat, newLocation.lng]);
    } catch (error: any) {
      console.error("GPS location error:", error);
      setLocationPermission("denied");

      let errorMessage = "GPS байршил авах боломжгүй. ";

      if (error.code === 1) {
        errorMessage += "Байршлын зөвшөөрөл шаардлагатай.";
      } else if (error.code === 2) {
        errorMessage += "GPS сигнал сул байна.";
      } else if (error.code === 3) {
        errorMessage += "GPS хугацаа дууссан.";
      }

      // Fall back to IP location if GPS fails
      if (ipLocation) {
        errorMessage += ` IP байршлыг ашиглаж байна.`;
        setUserLocation({ ...ipLocation, source: "IP (GPS буруу)" });
        checkDeliveryZone(ipLocation);
        setMapCenter([ipLocation.lat, ipLocation.lng]);
      }

      alert(errorMessage);
    } finally {
      setIsGettingLocation(false);
    }
  };

  // Mongolia-specific address handling
  const handleAddressCheck = async () => {
    if (!addressInput.trim()) return;

    // Real Mongolia districts with approximate coordinates
    const mongoliaLocations = {
      сүхбаатар: [47.9184, 106.9177],
      баянзүрх: [47.9084, 106.9377],
      чингэлтэй: [47.9284, 106.9077],
      "хан-уул": [47.8984, 106.9277],
      баянгол: [47.9384, 106.9177],
      сонгинохайрхан: [47.9184, 106.8877],
      налайх: [47.7351, 107.0419],
      багануур: [47.8058, 108.2283],
    };

    const searchTerm = addressInput.toLowerCase();
    let foundLocation: LocationState;

    // Check known districts
    const matchedDistrict = Object.keys(mongoliaLocations).find((district) =>
      searchTerm.includes(district),
    );

    if (matchedDistrict) {
      const [lat, lng] =
        mongoliaLocations[matchedDistrict as keyof typeof mongoliaLocations];
      foundLocation = {
        lat: lat + (Math.random() - 0.5) * 0.01,
        lng: lng + (Math.random() - 0.5) * 0.01,
        address: `${addressInput} (${matchedDistrict} дүүрэг)`,
        source: "Manual input",
      };
    } else {
      // Default to restaurant area
      foundLocation = {
        lat: RESTAURANT_LOCATION[0] + (Math.random() - 0.5) * 0.02,
        lng: RESTAURANT_LOCATION[1] + (Math.random() - 0.5) * 0.02,
        address: addressInput,
        source: "Manual input",
      };
    }

    setUserLocation(foundLocation);
    checkDeliveryZone(foundLocation);
    setMapCenter([foundLocation.lat, foundLocation.lng]);
  };

  const getEstimatedDeliveryTime = (distance: number): string => {
    if (distance < 1) return "20-25 минут";
    if (distance < 3) return "25-35 минут";
    if (distance < 5) return "35-45 минут";
    return "45+ минут";
  };

  // Initialize IP location on mount
  useEffect(() => {
    getIpLocation();
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden max-w-6xl mx-auto">
      {/* Simple map visualization */}
      <div className="relative h-96 w-full bg-gradient-to-br from-green-100 to-blue-100 flex items-center justify-center">
        <div className="absolute inset-0 bg-green-50 opacity-50"></div>

        {/* Restaurant marker */}
        <div
          className="absolute"
          style={{
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
          }}
        >
          <div className="bg-red-500 text-white p-3 rounded-full shadow-lg">
            🍕 Ресторан
          </div>
        </div>

        {/* User location marker */}
        {userLocation && (
          <div
            className="absolute"
            style={{
              left: `${50 + (userLocation.lng - RESTAURANT_LOCATION[1]) * 1000}%`,
              top: `${50 - (userLocation.lat - RESTAURANT_LOCATION[0]) * 1000}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            <div
              className={`p-2 rounded-full shadow-lg text-white ${
                isInDeliveryZone ? "bg-green-500" : "bg-red-500"
              }`}
            >
              {isInDeliveryZone ? "✓" : "✗"} Та
            </div>
          </div>
        )}

        {/* Delivery zone visualization */}
        {showBoundary && (
          <div className="absolute inset-4 border-4 border-orange-400 border-dashed rounded-lg bg-orange-100 bg-opacity-30 flex items-center justify-center">
            <span className="text-orange-600 font-bold">Хүргэлтийн бүс</span>
          </div>
        )}

        {/* Map controls */}
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
        {/* Debug Information */}
        {debugInfo && (
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Wifi className="h-4 w-4" />
                Сүлжээний мэдээлэл
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>IP хаяг: {debugInfo.ip}</div>
                <div>Хот: {debugInfo.city || "Тодорхойгүй"}</div>
                <div>Улс: {debugInfo.country_name}</div>
                <div>ISP: {debugInfo.org}</div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Location comparison */}
        {ipLocation && userLocation && userLocation.source === "GPS" && (
          <Card className="bg-yellow-50 border-yellow-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Байршлын харьцуулалт</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-medium flex items-center gap-1">
                    <Wifi className="h-3 w-3" /> IP байршил:
                  </p>
                  <p className="text-xs">{ipLocation.address}</p>
                  <p className="text-xs text-gray-500">
                    {ipLocation.lat.toFixed(4)}, {ipLocation.lng.toFixed(4)}
                  </p>
                </div>
                <div>
                  <p className="font-medium flex items-center gap-1">
                    <Smartphone className="h-3 w-3" /> GPS байршил:
                  </p>
                  <p className="text-xs">{userLocation.address}</p>
                  <p className="text-xs text-gray-500">
                    {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
                  </p>
                  {userLocation.accuracy && (
                    <p className="text-xs text-gray-500">
                      Нарийвчлал: ±{Math.round(userLocation.accuracy)}м
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Location Controls */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={getCurrentLocation}
              disabled={isGettingLocation}
              className="flex-1 bg-blue-500 hover:bg-blue-600"
            >
              <Navigation className="h-4 w-4 mr-2" />
              {isGettingLocation ? "GPS байршил авч байна..." : "GPS байршил"}
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
            className={`border-2 ${
              isInDeliveryZone
                ? "border-green-200 bg-green-50"
                : "border-red-200 bg-red-50"
            }`}
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
                  <p className="text-gray-600">Зай:</p>
                  <p className="font-semibold">{distance?.toFixed(2)} км</p>
                </div>
                <div>
                  <p className="text-gray-600">Байршлын эх үүсвэр:</p>
                  <p className="font-semibold">{userLocation.source}</p>
                </div>
                {isInDeliveryZone && distance && (
                  <div>
                    <p className="text-gray-600">Хүргэх хугацаа:</p>
                    <p className="font-semibold">
                      {getEstimatedDeliveryTime(distance)}
                    </p>
                  </div>
                )}
              </div>

              {!isInDeliveryZone && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>Анхаар:</strong> Таны байршил хүргэлтийн бүсээс
                    гадуур байна. GPS-ээр дахин шалгаж үзнэ үү.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Information */}
        <Card className="bg-gray-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5 text-orange-600" />
              Байршлын мэдээлэл
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <div className="text-sm space-y-2">
              <p>
                <strong>GPS:</strong> Хамгийн нарийвчлалтай, гэхдээ барилга
                дотор ажиллахгүй байж болно
              </p>
              <p>
                <strong>IP байршил:</strong> Интернет үйлчилгээ үзүүлэгчийн
                байршил, бодит байршилтай ялгаатай байж болно
              </p>
              <p>
                <strong>Гарын ороход:</strong> Монгол Улсын дүүргийн нэр
                ашиглана уу
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm pt-3 border-t">
              <div>
                <p className="text-gray-600">Хүргэлтийн цаг:</p>
                <p className="font-medium">10:00 - 22:00</p>
              </div>
              <div>
                <p className="text-gray-600">Холбоо барих:</p>
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
