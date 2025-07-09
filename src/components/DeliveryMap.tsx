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
  const [userDismissedDialog, setUserDismissedDialog] = useState(false);

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

  // Check current permission status with HTTPS detection
  const checkPermissionStatus = async () => {
    // Check if we're on HTTPS
    const isSecure =
      window.location.protocol === "https:" ||
      window.location.hostname === "localhost";

    if (!isSecure) {
      console.warn("Geolocation requires HTTPS in production");
      return "requires-https";
    }

    if (!navigator.permissions) {
      return "unknown";
    }

    try {
      const permission = await navigator.permissions.query({
        name: "geolocation",
      });
      return permission.state;
    } catch (error) {
      console.log("Permission query not supported");
      return "unknown";
    }
  };

  // Get GPS location with enhanced error handling
  const getCurrentLocation = async () => {
    if (!navigator.geolocation) {
      alert("Таны хөтөч байршлын үйлчилгээг дэмждэггүй.");
      return;
    }

    // Check permission status first
    const permissionStatus = await checkPermissionStatus();
    console.log("Current permission status:", permissionStatus);

    // Handle HTTPS requirement
    if (permissionStatus === "requires-https") {
      setLocationPermission("requires-https");
      // Only show dialog if user hasn't dismissed it before
      if (!userDismissedDialog) {
        setShowLocationPermissionRequest(true);
      }
      return;
    }

    // If permission is already granted, don't show the dialog
    if (permissionStatus === "granted") {
      setLocationPermission("granted");
      setShowLocationPermissionRequest(false);
    } else if (permissionStatus === "denied") {
      setLocationPermission("denied");
      // Only show dialog if user hasn't dismissed it before
      if (!userDismissedDialog) {
        setShowLocationPermissionRequest(true);
      }
      return;
    } else if (permissionStatus === "prompt") {
      // Permission will be requested when we call getCurrentPosition
      setLocationPermission("prompt");
      setShowLocationPermissionRequest(false);
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
      setShowLocationPermissionRequest(false); // Hide dialog on success
      checkDeliveryZone(newLocation);
      // Don't change map center to preserve restaurant marker
      // setMapCenter([newLocation.lat, newLocation.lng]);
    } catch (error: any) {
      console.error("GPS location error:", error);

      // Handle different error types
      if (error.code === 1) {
        // PERMISSION_DENIED
        setLocationPermission("denied");
        // Only show dialog if user hasn't dismissed it before
        if (!userDismissedDialog) {
          setShowLocationPermissionRequest(true);
        }
      } else if (error.code === 2) {
        // POSITION_UNAVAILABLE
        setLocationPermission("granted"); // Permission was given but location unavailable
        setShowLocationPermissionRequest(false);
        alert("Байршил тодорхойлох боломжгүй. Интернет холболтоо шалгана уу.");
      } else if (error.code === 3) {
        // TIMEOUT
        setLocationPermission("granted"); // Permission was given but timed out
        setShowLocationPermissionRequest(false);
        alert("Байршил тодорхойлоход хэт удаж байна. Дахин оролдоно уу.");
      } else {
        setLocationPermission("unknown");
      }

      // Fall back to IP location if GPS fails
      if (ipLocation) {
        setUserLocation({ ...ipLocation, source: "Ойролцоо (автомат буруу)" });
        checkDeliveryZone(ipLocation);
        // Don't change map center to preserve restaurant marker
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
    setUserDismissedDialog(false); // Reset dismissal state when user actively tries again

    // Reset permission state and try again
    setLocationPermission(null);

    // Small delay to ensure dialog closes before permission prompt
    setTimeout(() => {
      getCurrentLocation();
    }, 100);
  };

  // Handle dialog dismissal
  const handleDialogDismiss = () => {
    setShowLocationPermissionRequest(false);
    setUserDismissedDialog(true); // Remember that user dismissed the dialog
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

    // Check initial permission status
    checkPermissionStatus().then((status) => {
      console.log("Initial permission status:", status);
      if (status === "granted") {
        setLocationPermission("granted");
        setShowLocationPermissionRequest(false);
      } else if (status === "denied") {
        setLocationPermission("denied");
      } else if (status === "requires-https") {
        setLocationPermission("requires-https");
      }
    });

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
          {/* Show location permission request button if permission was denied or HTTPS required */}
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
                  onClick={() => {
                    setUserDismissedDialog(false); // Reset dismissal when user actively clicks
                    setShowLocationPermissionRequest(true);
                  }}
                  size="sm"
                  className="bg-yellow-500 hover:bg-yellow-600 text-white"
                >
                  Зөвшөөрөх
                </Button>
              </div>
            </div>
          )}

          {/* Show HTTPS requirement warning */}
          {locationPermission === "requires-https" && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800 mb-1">
                    HTTPS холболт шаардлагатай
                  </p>
                  <p className="text-sm text-red-700 mb-2">
                    Байршил тодорхойлохын тулд аюулгүй (HTTPS) холболт хэрэгтэй.
                    Одоогийн хаяг: {window.location.protocol}//
                    {window.location.host}
                  </p>
                  <p className="text-xs text-red-600">
                    Хаягаа гараар оруулж эсвэл админтай холбогдоно уу.
                  </p>
                </div>
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

        {/* Location Permission Request Dialog */}
        <Dialog
          open={showLocationPermissionRequest}
          onOpenChange={(open) => {
            if (!open) {
              handleDialogDismiss();
            } else {
              setShowLocationPermissionRequest(open);
            }
          }}
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
              {locationPermission === "requires-https" ? (
                <div className="space-y-4">
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-center">
                    <div className="text-4xl mb-3">🔒</div>
                    <h4 className="font-semibold text-red-800 mb-2">
                      HTTPS холболт шаардлагатай
                    </h4>
                    <p className="text-sm text-red-700 mb-3">
                      Хөтчийн аюулгүйн шаардлагын улмаас байршил тодорхойлоход
                      аюулгүй холболт (HTTPS) хэрэгтэй.
                    </p>
                    <div className="text-xs text-red-600 space-y-1">
                      <p>
                        <strong>Одоогийн хаяг:</strong>{" "}
                        {window.location.protocol}//{window.location.host}
                      </p>
                      <p>
                        <strong>Шаардлагатай:</strong> https://
                        {window.location.host}
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <h5 className="font-medium text-yellow-800 mb-2">
                      Шийдлийн арга:
                    </h5>
                    <ul className="text-sm text-yellow-700 space-y-1">
                      <li>• Хаягаа гараар оруулах</li>
                      <li>• Админтай холбогдож HTTPS тохируулах</li>
                      <li>• Localhost дээр туршиж үзэх</li>
                    </ul>
                  </div>

                  <Button
                    onClick={handleDialogDismiss}
                    className="w-full"
                    variant="outline"
                  >
                    Ойлголоо
                  </Button>
                </div>
              ) : (
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
                      onClick={handleDialogDismiss}
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
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default DeliveryMap;
