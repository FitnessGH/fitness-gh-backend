import type { Prisma } from "@prisma/client";

export type ProductCategory = "SUPPLEMENTS" | "EQUIPMENT" | "ACCESSORIES" | "APPAREL" | "OTHER";
export type ProductStatus = "DRAFT" | "ACTIVE" | "OUT_OF_STOCK" | "DISCONTINUED";
export type OrderStatus = "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED";

export type CreateProductData = {
  name: string;
  description?: string;
  category: ProductCategory;
  price: number;
  currency?: string;
  stock: number;
  sku?: string;
  imageUrl?: string;
  images?: Prisma.InputJsonValue;
};

export type UpdateProductData = Partial<Omit<CreateProductData, "category">> & {
  status?: ProductStatus;
  isActive?: boolean;
};

export type ProductResponse = {
  id: string;
  vendorId: string;
  name: string;
  description: string | null;
  category: ProductCategory;
  price: number;
  currency: string;
  stock: number;
  sku: string | null;
  imageUrl: string | null;
  images: Prisma.JsonValue | null;
  status: ProductStatus;
  isActive: boolean;
  rating: number | null;
  reviewCount: number;
  createdAt: Date;
  updatedAt: Date;
  vendor?: {
    id: string;
    username: string;
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
  };
};

export type CreateOrderData = {
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  shippingAddress?: {
    street: string;
    city: string;
    region: string;
    country: string;
    phone: string;
  };
};

export type OrderResponse = {
  id: string;
  customerId: string;
  orderNumber: string;
  total: number;
  currency: string;
  shippingAddress: Prisma.JsonValue | null;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  items: Array<{
    id: string;
    productId: string;
    quantity: number;
    price: number;
    subtotal: number;
    product: ProductResponse;
  }>;
  customer?: {
    id: string;
    username: string;
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
  };
};

export type UpdateOrderStatusData = {
  status: OrderStatus;
};

export type ProductFiltersInput = {
  category?: ProductCategory;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: "price" | "rating" | "createdAt";
};
