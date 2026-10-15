export interface Category { id: string; slug: string; name: string; description: string; image: string; sortOrder: number; active: boolean; productCount: number; }

export interface Size { size: 'small' | 'medium' | 'large'; name: string; deltaCents: number; isDefault: boolean; }
export interface Crust { name: string; deltaCents: number; isDefault: boolean; }
export interface Topping { id: string; name: string; priceCents: number; isVeg: boolean; available: boolean; }

export interface Product {
  id: string; slug: string; name: string; description: string; image: string;
  isVeg: boolean; spiceLevel: number; badge: string | null; discountPct: number;
  comparePriceCents: number | null; available: boolean; isCombo: boolean;
  priceCents: number; fromPriceCents: number; customizable: boolean;
  sizes: Size[];
  category?: { slug: string; name: string };
}

export interface ProductDetail extends Product {
  crusts: Crust[]; toppings: Topping[]; extraCheeseCents: number;
}

export interface CartItemProduct {
  id: string; slug: string; name: string; image: string; isVeg: boolean; spiceLevel: number; available: boolean;
}
export interface CartItem {
  id: string; product: CartItemProduct; name: string;
  size: string | null; sizeKey: string | null; crust: string | null;
  toppings: { id: string; name: string; priceCents: number }[];
  extraCheese: boolean; qty: number; unitPriceCents: number; lineTotalCents: number;
  customizable: boolean;
}
export interface AppliedPromo { code: string; description: string; type: 'percent' | 'flat'; value: number; minOrderCents: number; }
export interface Cart {
  id: string; items: CartItem[]; itemCount: number; subtotalCents: number;
  promo: AppliedPromo | null; discountCents: number;
  settings: { deliveryFeeCents: number; freeDeliveryMinCents: number; taxPct: number; currencySymbol: string; extraCheeseCents: number };
}

export interface StoreSettings {
  storeName: string; tagline: string; phone: string; email: string; address: string; hours: string;
  currencySymbol: string; currencyCode: string; deliveryFeeCents: number; freeDeliveryMinCents: number;
  taxPct: number; extraCheeseCents: number; etaDeliveryMinutes: number; etaPickupMinutes: number;
  paymentMethods: { id: string; label: string; enabled: boolean }[];
}

export interface Address { id?: string; label: string; line1: string; line2?: string; city: string; zip: string; isDefault?: boolean; }
export interface User { id: string; email: string; name: string; phone: string | null; role: 'customer' | 'admin'; addresses: Address[]; }

export type OrderStatus = 'received' | 'confirmed' | 'assigned' | 'accepted' | 'preparing' | 'out_for_delivery' | 'ready_for_pickup' | 'picked_up' | 'delivered' | 'delivery_failed' | 'cancelled';
export interface DeliveryLocation { lat: number; lng: number; accuracy?: number | null; landmark?: string | null; }
export interface AssignedRider { id: string; username: string; name: string; phone: string | null; vehicle?: string | null; }
export interface OrderItem {
  id: string; productId: string; name: string; image: string; size: string | null; crust: string | null;
  toppings: string[]; extraCheese: boolean; isVeg: boolean; qty: number; unitPriceCents: number; lineTotalCents: number;
}
export interface Order {
  id: string; number: string; status: OrderStatus; statusLabel: string; fulfilment: 'delivery' | 'pickup';
  customer: { name: string; phone: string; email: string | null };
  address: Address | null; deliveryLocation: DeliveryLocation | null; rider: AssignedRider | null; notes: string | null; items: OrderItem[];
  totals: { subtotalCents: number; discountCents: number; deliveryCents: number; taxCents: number; totalCents: number };
  promoCode: string | null; paymentMethod: string; createdAt: number; statusUpdatedAt: number;
  etaAt: number; etaMinutes: number; autoAdvance: boolean;
  tracking: { stages: { key: string; label: string; state: 'done' | 'current' | 'pending' }[]; current: OrderStatus; cancelled: boolean };
}

export interface PublicPromo { code: string; description: string; type: 'percent' | 'flat'; value: number; minOrderCents: number; maxDiscountCents: number | null; }

export interface AdminProduct extends Product {
  categoryId: string;
  category: { id: string; name: string; slug: string };
  options: { sizes: Size[]; crusts: Crust[]; toppings: Topping[] };
}

/* ---------- Delivery system ---------- */

/** Live rider feed — GET /orders/:id/rider-location and GET /admin/orders/:id/location. */
export interface RiderLiveLocation {
  active: boolean;
  status: OrderStatus;
  rider: AssignedRider | null;
  location: { lat: number; lng: number; accuracy: number | null; updatedAt: number } | null;
  customer?: DeliveryLocation | null;
}

export interface Rider {
  id: string; userId: string; username: string; name: string; phone: string | null;
  vehicle: string | null; photo: string | null;
  status: 'active' | 'inactive' | 'suspended'; availability: 'online' | 'offline';
  createdAt: number;
  activeDeliveries: number; deliveredToday: number; totalDelivered: number;
  lastLocation: { lat: number; lng: number; accuracy: number | null; updatedAt: number } | null;
}
export interface HistoryEntry {
  id: string; from: string | null; to: string; kind: 'status' | 'assignment' | 'issue';
  actorRole: string; actorId: string | null; actorName: string | null;
  note: string | null; label: string; createdAt: number;
}
export interface AssignmentRecord {
  id: string; riderId: string; riderName: string; riderUsername: string;
  assignedBy: string; unassignedAt: number | null; createdAt: number;
}
export interface AppNotification {
  id: string; orderId: string | null; type: string; title: string; body: string; read: boolean; createdAt: number;
}
export interface DeliveryOpsRow {
  id: string; number: string; customer: string; phone: string; fulfilment: 'delivery' | 'pickup';
  status: string; totalCents: number; paymentMethod: string; createdAt: number; statusUpdatedAt: number;
  assignedRiderId: string | null; riderName: string | null; riderPhone: string | null;
  hasLocation: boolean; itemCount: number;
}
export interface DeliveryOps {
  summary: { activeDeliveries: number; unassignedDelivery: number; completedToday: number; failedActive: number; issuesOpen: number };
  riders: Rider[]; orders: DeliveryOpsRow[]; statuses: string[];
}

/* ---------- Rider portal ---------- */
export interface RiderMe {
  rider: {
    id: string; userId: string; username: string; name: string; phone: string | null;
    vehicle: string | null; photo: string | null;
    status: 'active' | 'inactive' | 'suspended'; availability: 'online' | 'offline';
  };
}
export interface RiderOrder {
  id: string; number: string; status: string; statusLabel: string;
  customer: { name: string; phone: string };
  address: Address | null;
  deliveryLocation: { lat: number; lng: number; accuracy: number | null; landmark: string | null } | null;
  notes: string | null;
  items: { name: string; size: string | null; crust: string | null; toppings: string[]; extraCheese: boolean; isVeg: boolean; qty: number; unitPriceCents: number; lineTotalCents: number }[];
  totals: { subtotalCents: number; discountCents: number; deliveryCents: number; taxCents: number; totalCents: number };
  paymentMethod: string; createdAt: number; assignmentTime: number; statusUpdatedAt: number;
}
export interface RiderDashboard {
  rider: RiderMe['rider'];
  counts: { newOrders: number; activeDeliveries: number; deliveredToday: number; totalAssigned: number };
  activeOrder: RiderOrder | null;
  unreadNotifications: number;
}
