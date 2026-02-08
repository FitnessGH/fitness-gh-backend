import { BaseRoute } from "../../../core/base-route.js";
import { authenticate } from "../../../middlewares/auth.middleware.js";

import MarketplaceController from "../controllers/marketplace.controller.js";

class MarketplaceRoute extends BaseRoute {
  protected initializeRoutes(): void {
    // Public routes - Products
    this.get("/products", MarketplaceController.listProducts);
    
    // Protected routes - Products (Vendor)
    // IMPORTANT: Specific routes must come before parameterized routes
    this.get("/products/my", authenticate, MarketplaceController.getMyProducts);
    this.post("/products", authenticate, MarketplaceController.createProduct);
    
    // Parameterized routes come after specific routes
    this.get("/products/:id", MarketplaceController.getProduct);
    this.put("/products/:id", authenticate, MarketplaceController.updateProduct);
    this.delete("/products/:id", authenticate, MarketplaceController.deleteProduct);

    // Protected routes - Orders (Customer)
    // IMPORTANT: Specific routes must come before parameterized routes
    this.post("/orders", authenticate, MarketplaceController.createOrder);
    this.get("/orders/my", authenticate, MarketplaceController.getMyOrders);
    
    // Protected routes - Orders (Vendor)
    this.get("/orders/vendor/my", authenticate, MarketplaceController.getVendorOrders);
    
    // Parameterized routes come after specific routes
    this.get("/orders/:id", authenticate, MarketplaceController.getOrder);
    this.put("/orders/:id/status", authenticate, MarketplaceController.updateOrderStatus);
  }
}

export default new MarketplaceRoute().getRouter();
