export interface Category { id: string; slug: string; name: string; image: string; productCount: number; }

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

export type OrderStatus = 'received' | 'confirmed' | 'preparing' | 'out_for_delivery' | 'ready_for_pickup' | 'delivered' | 'cancelled';
export interface OrderItem {
  id: string; productId: string; name: string; image: string; size: string | null; crust: string | null;
  toppings: string[]; extraCheese: boolean; isVeg: boolean; qty: number; unitPriceCents: number; lineTotalCents: number;
}
export interface Order {
  id: string; number: string; status: OrderStatus; statusLabel: string; fulfilment: 'delivery' | 'pickup';
  customer: { name: string; phone: string; email: string | null };
  address: Address | null; notes: string | null; items: OrderItem[];
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
