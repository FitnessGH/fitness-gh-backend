import { BaseRoute } from "../../../core/base-route.js";
import { authenticate } from "../../../middlewares/auth.middleware.js";

import MarketplaceController from "../controllers/marketplace.controller.js";

class MarketplaceRoute extends BaseRoute {
  protected initializeRoutes(): void {
    // Public routes - Products
    this.get("/products", MarketplaceController.listProducts);
    this.get("/products/:id", MarketplaceController.getProduct);

    // Protected routes - Products (Vendor)
    this.post("/products", authenticate, MarketplaceController.createProduct);
    this.put("/products/:id", authenticate, MarketplaceController.updateProduct);
    this.delete("/products/:id", authenticate, MarketplaceController.deleteProduct);
    this.get("/products/my", authenticate, MarketplaceController.getMyProducts);

    // Protected routes - Orders (Customer)
    this.post("/orders", authenticate, MarketplaceController.createOrder);
    this.get("/orders/my", authenticate, MarketplaceController.getMyOrders);
    this.get("/orders/:id", authenticate, MarketplaceController.getOrder);

    // Protected routes - Orders (Vendor)
    this.get("/orders/vendor/my", authenticate, MarketplaceController.getVendorOrders);
    this.put("/orders/:id/status", authenticate, MarketplaceController.updateOrderStatus);
  }
}

export default new MarketplaceRoute().getRouter();
