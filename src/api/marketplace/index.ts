// Export controller for external use
export { default as MarketplaceController } from "./controllers/marketplace.controller.js";

// Export the main route for the marketplace module
export { default as marketplaceRoute } from "./routes/marketplace.route.js";

// Export service for external use
export { default as MarketplaceService } from "./services/marketplace.service.js";

// Export types for external use
export type {
  CreateProductData,
  UpdateProductData,
  ProductResponse,
  CreateOrderData,
  OrderResponse,
  UpdateOrderStatusData,
  ProductFiltersInput,
  ProductCategory,
  ProductStatus,
  OrderStatus,
} from "./types/marketplace.types.js";

// Export validation schemas for external use
export {
  createProductSchema,
  updateProductSchema,
  createOrderSchema,
  updateOrderStatusSchema,
  productFiltersSchema,
  productCategorySchema,
  productStatusSchema,
  orderStatusSchema,
} from "./validations/marketplace.validation.js";
