import {
  array,
  minLength,
  maxLength,
  minValue,
  maxValue,
  number,
  object,
  optional,
  picklist,
  pipe,
  string,
  url,
  type InferOutput,
} from "valibot";

// Product Category
export const productCategorySchema = picklist([
  "SUPPLEMENTS",
  "EQUIPMENT",
  "ACCESSORIES",
  "APPAREL",
  "OTHER",
]);

// Product Status
export const productStatusSchema = picklist([
  "DRAFT",
  "ACTIVE",
  "OUT_OF_STOCK",
  "DISCONTINUED",
]);

// Order Status
export const orderStatusSchema = picklist([
  "PENDING",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
]);

// Create Product Schema
export const createProductSchema = object({
  name: pipe(string(), minLength(1, "Product name is required"), maxLength(200)),
  description: optional(pipe(string(), maxLength(2000))),
  category: productCategorySchema,
  price: pipe(number(), minValue(0, "Price must be positive")),
  currency: optional(pipe(string(), minLength(3), maxLength(3))),
  stock: pipe(number(), minValue(0, "Stock cannot be negative")),
  sku: optional(pipe(string(), maxLength(100))),
  imageUrl: optional(url("Invalid image URL")),
  images: optional(array(url("Invalid image URL"))),
});

export type CreateProductInput = InferOutput<typeof createProductSchema>;

// Update Product Schema
export const updateProductSchema = object({
  name: optional(pipe(string(), minLength(1), maxLength(200))),
  description: optional(pipe(string(), maxLength(2000))),
  price: optional(pipe(number(), minValue(0))),
  currency: optional(pipe(string(), minLength(3), maxLength(3))),
  stock: optional(pipe(number(), minValue(0))),
  sku: optional(pipe(string(), maxLength(100))),
  imageUrl: optional(url("Invalid image URL")),
  images: optional(array(url("Invalid image URL"))),
  status: optional(productStatusSchema),
  isActive: optional(pipe(number(), minValue(0), maxValue(1))),
});

export type UpdateProductInput = InferOutput<typeof updateProductSchema>;

// Shipping Address Schema
export const shippingAddressSchema = object({
  street: pipe(string(), minLength(1, "Street address is required")),
  city: pipe(string(), minLength(1, "City is required")),
  region: pipe(string(), minLength(1, "Region is required")),
  country: pipe(string(), minLength(1, "Country is required")),
  phone: pipe(string(), minLength(1, "Phone is required")),
});

// Order Item Schema
export const orderItemSchema = object({
  productId: pipe(string(), minLength(1, "Product ID is required")),
  quantity: pipe(number(), minValue(1, "Quantity must be at least 1")),
});

// Create Order Schema
export const createOrderSchema = object({
  items: pipe(
    array(orderItemSchema),
    minLength(1, "At least one item is required"),
  ),
  shippingAddress: optional(shippingAddressSchema),
});

export type CreateOrderInput = InferOutput<typeof createOrderSchema>;

// Update Order Status Schema
export const updateOrderStatusSchema = object({
  status: orderStatusSchema,
});

export type UpdateOrderStatusInput = InferOutput<typeof updateOrderStatusSchema>;

// Product ID Schema
export const productIdSchema = object({
  id: pipe(string(), minLength(1)),
});

// Order ID Schema
export const orderIdSchema = object({
  id: pipe(string(), minLength(1)),
});

// Query Filters Schema
export const productFiltersSchema = object({
  category: optional(productCategorySchema),
  search: optional(pipe(string(), maxLength(200))),
  minPrice: optional(pipe(number(), minValue(0))),
  maxPrice: optional(pipe(number(), minValue(0))),
  sortBy: optional(picklist(["price", "rating", "createdAt"])),
});

export type ProductFiltersInput = InferOutput<typeof productFiltersSchema>;
