import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MapPin,
  Navigation,
  Search,
  AlertCircle,
  CheckCircle,
  Wifi,
  Smartphone,
  Settings,
  HelpCircle,
  X,
} from "lucide-react";

// Dynamic imports for Leaflet components to avoid SSR issues
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

// Pizza place coordinates
const RESTAURANT_LOCATION = [47.92138235455927, 106.8195432274315] as [
  number,
  number,
];
// Delivery zone coordinates
const DELIVERY_BOUNDARY = [
  [47.92140269073649, 106.81694108103707],
  [47.921677228346944, 106.82059774156801],
  [47.92039604036649, 106.82115913758312],
  [47.920319778176626, 106.82044601291527],
  [47.91970967661069, 106.82059774156801],
  [47.919384286152884, 106.81944460380883],
  [47.919267348462256, 106.8181169780974],
  [47.92140269073649, 106.81694108103707], // Close the polygon
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
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [ipLocation, setIpLocation] = useState<LocationState | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showLocationPermissionRequest, setShowLocationPermissionRequest] =
    useState(false);

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
        address: "Автомат байршил",
        accuracy: position.coords.accuracy,
        source: "Автомат",
      };

      setUserLocation(newLocation);
      setLocationPermission("granted");
      checkDeliveryZone(newLocation);
      // Don't change map center to preserve restaurant marker
      // setMapCenter([newLocation.lat, newLocation.lng]);
    } catch (error: any) {
      console.error("GPS location error:", error);
      setLocationPermission("denied");

      // Fall back to IP location if GPS fails
      if (ipLocation) {
        setUserLocation({ ...ipLocation, source: "Ойролцоо (автомат буруу)" });
        checkDeliveryZone(ipLocation);
        // Don't change map center to preserve restaurant marker
      }

      // Show location permission request for permission denied errors
      if (error.code === 1) {
        setShowLocationPermissionRequest(true);
      }
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
    // Don't change map center to preserve restaurant marker
    // setMapCenter([foundLocation.lat, foundLocation.lng]);
  };

  // Request location permission directly
  const requestLocationPermission = async () => {
    setShowLocationPermissionRequest(false);
    // Try to get location again, which will trigger the browser's permission prompt
    getCurrentLocation();
  };

  const getEstimatedDeliveryTime = (distance: number): string => {
    if (distance < 1) return "20-25 минут";
    if (distance < 3) return "25-35 минут";
    if (distance < 5) return "35-45 минут";
    return "45+ минут";
  };

  // Initialize IP location on mount and setup Leaflet
  useEffect(() => {
    getIpLocation();

    // Load Leaflet icons
    if (typeof window !== "undefined") {
      import("leaflet").then((L) => {
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
          iconUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
          shadowUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
        });
        setLeafletLoaded(true);
      });
    }
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden max-w-6xl mx-auto">
      {/* Simple map visualization */}
      <div className="relative h-96 w-full">
        {leafletLoaded ? (
          <MapContainer
            center={mapCenter}
            zoom={15}
            style={{ height: "100%", width: "100%" }}
            className="rounded-t-lg"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Restaurant marker */}
            <Marker position={RESTAURANT_LOCATION}>
              <Popup>
                <div className="text-center">
                  <div className="text-2xl mb-2">🍕</div>
                  <strong>Гоё Пицца</strong>
                  <br />
                  Ресторан
                </div>
              </Popup>
            </Marker>

            {/* User location marker */}
            {userLocation && (
              <Marker position={[userLocation.lat, userLocation.lng]}>
                <Popup>
                  <div className="text-center">
                    <div className="text-2xl mb-2">
                      {isInDeliveryZone ? "✅" : "❌"}
                    </div>
                    <strong>Таны байршил</strong>
                    <br />
                    {userLocation.address}
                    <br />
                    <small>
                      {isInDeliveryZone
                        ? "Хүргэлт хийдэг"
                        : "Хүргэлтийн бүсээс гадуур"}
                    </small>
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Delivery zone polygon */}
            <Polygon
              positions={DELIVERY_BOUNDARY}
              pathOptions={{
                color: "#f97316",
                fillColor: "#fed7aa",
                fillOpacity: 0.3,
                weight: 3,
                dashArray: "10, 10",
              }}
            >
              <Popup>
                <div className="text-center">
                  <strong>Хүргэлтийн бүс</strong>
                  <br />
                  Энэ бүсэд бид хүргэлт хийдэг
                </div>
              </Popup>
            </Polygon>
          </MapContainer>
        ) : (
          <div className="h-full w-full bg-gray-100 flex items-center justify-center rounded-t-lg">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-2"></div>
              <p className="text-gray-600">Газрын зураг ачааллаж байна...</p>
            </div>
          </div>
        )}
      </div>

      {/* Controls Panel */}
      <div className="p-6 space-y-4">
        {/* Location Controls */}
        <div className="space-y-3">
          {/* Show location permission request button if permission was denied */}
          {locationPermission === "denied" && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm text-yellow-700">
                    Байршлын зөвшөөрөл хэрэгтэй
                  </span>
                </div>
                <Button
                  onClick={() => setShowLocationPermissionRequest(true)}
                  size="sm"
                  className="bg-yellow-500 hover:bg-yellow-600 text-white"
                >
                  Зөвшөөрөх
                </Button>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={getCurrentLocation}
              disabled={isGettingLocation}
              className="flex-1 bg-blue-500 hover:bg-blue-600"
            >
              <Navigation className="h-4 w-4 mr-2" />
              {isGettingLocation
                ? "Байршил тодорхойлж байна..."
                : "Миний байршил"}
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
                  <p className="text-gray-600">Байршлын төрөл:</p>
                  <p className="font-semibold">
                    {userLocation.source === "GPS"
                      ? "Автомат"
                      : userLocation.source === "Manual input"
                        ? "Гараар оруулсан"
                        : userLocation.source === "IP-based"
                          ? "Ойролцоо"
                          : userLocation.source}
                  </p>
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
                <div className="mt-4 space-y-3">
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <div className="text-2xl">📞</div>
                      <div>
                        <h4 className="font-semibold text-orange-800 mb-2">
                          Хүргэлтийн бүсээс гадуур байна
                        </h4>
                        <p className="text-sm text-orange-700 mb-3">
                          Таны байршил хүргэлтийн бүсээс гадуур байгаа тул бид
                          танд хүргэх боломжгүй байна.
                        </p>
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-orange-800">
                            Та дараах аргуудыг туршиж үзнэ үү:
                          </p>
                          <ul className="text-sm text-orange-700 space-y-1 ml-4">
                            <li>
                              • Дээрх "Миний байршил" товчийг дарж дахин шалгах
                            </li>
                            <li>• Хаягаа гараар оруулж шалгах</li>
                            <li>
                              • Бидэнтэй утсаар холбогдох:{" "}
                              <strong>+976 1234-5678</strong>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Service Information */}
        <Card className="bg-gradient-to-r from-orange-50 to-red-50 border-orange-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-orange-800">
              <MapPin className="h-5 w-5" />
              Хүргэлтийн үйлчилгээ
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                <div className="text-2xl mb-2">🕐</div>
                <p className="font-semibold text-gray-800">Ажиллах цаг</p>
                <p className="text-gray-600">10:00 - 22:00</p>
                <p className="text-xs text-gray-500 mt-1">Өдөр бүр</p>
              </div>
              <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                <div className="text-2xl mb-2">🚗</div>
                <p className="font-semibold text-gray-800">Хүргэх хугацаа</p>
                <p className="text-gray-600">20-45 минут</p>
                <p className="text-xs text-gray-500 mt-1">Зайнаас хамаарна</p>
              </div>
              <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                <div className="text-2xl mb-2">📞</div>
                <p className="font-semibold text-gray-800">Холбоо барих</p>
                <p className="text-gray-600">+976 1234-5678</p>
                <p className="text-xs text-gray-500 mt-1">Тусламж авах</p>
              </div>
            </div>

            <div className="mt-4 p-3 bg-white rounded-lg border border-orange-200">
              <h4 className="font-semibold text-orange-800 mb-2 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Байршил тодорхойлох арга:
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="font-medium text-gray-700">
                    📍 Автомат байршил
                  </p>
                  <p className="text-gray-600 text-xs">
                    Хамгийн нарийвчлалтай арга
                  </p>
                </div>
                <div>
                  <p className="font-medium text-gray-700">✍️ Хаяг бичих</p>
                  <p className="text-gray-600 text-xs">
                    Дүүргийн нэр ашиглана уу
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Location Permission Request Dialog */}
        <Dialog
          open={showLocationPermissionRequest}
          onOpenChange={setShowLocationPermissionRequest}
        >
          <DialogContent className="max-w-sm mx-auto z-[9999]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg text-center">
                <Navigation className="h-5 w-5 text-blue-600" />
                Байршлын зөвшөөрөл
              </DialogTitle>
              <DialogDescription className="text-center">
                Хүргэлтийн бүсийг шалгахын тулд таны байршил шаардлагатай.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
                <div className="text-4xl mb-3">📍</div>
                <p className="text-sm text-blue-700">
                  Таны байршлыг тодорхойлж, хүргэлтийн бүсэд байгаа эсэхийг
                  шалгана.
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={requestLocationPermission}
                  className="flex-1 bg-blue-500 hover:bg-blue-600"
                >
                  <Navigation className="h-4 w-4 mr-2" />
                  Байршил зөвшөөрөх
                </Button>
                <Button
                  onClick={() => setShowLocationPermissionRequest(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Болих
                </Button>
              </div>

              <p className="text-xs text-gray-500 text-center">
                Хэрэв зөвшөөрөл өгөхгүй бол хаягаа гараар оруулж болно.
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default DeliveryMap;
