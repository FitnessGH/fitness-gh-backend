import { prisma } from "../../../core/services/prisma.service.js";
import { NotFoundError } from "../../../errors/not-found.error.js";
import { ConflictError } from "../../../errors/conflict.error.js";

import type {
  CreateProductData,
  UpdateProductData,
  ProductResponse,
  CreateOrderData,
  OrderResponse,
  UpdateOrderStatusData,
  ProductFiltersInput,
} from "../types/marketplace.types.js";

class MarketplaceService {
  // ========================================
  // PRODUCT OPERATIONS
  // ========================================

  /**
   * Get all products with optional filters
   */
  async getAllProducts(filters?: ProductFiltersInput): Promise<ProductResponse[]> {
    const where: any = {
      isActive: true,
      status: "ACTIVE",
    };

    if (filters?.category) {
      where.category = filters.category;
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    if (filters?.minPrice !== undefined || filters?.maxPrice !== undefined) {
      where.price = {};
      if (filters.minPrice !== undefined) {
        where.price.gte = filters.minPrice;
      }
      if (filters.maxPrice !== undefined) {
        where.price.lte = filters.maxPrice;
      }
    }

    const orderBy: any = { createdAt: "desc" };
    if (filters?.sortBy) {
      switch (filters.sortBy) {
        case "price":
          orderBy.price = "asc";
          break;
        case "rating":
          orderBy.rating = "desc";
          break;
        case "createdAt":
          orderBy.createdAt = "desc";
          break;
      }
    }

    const products = await prisma.product.findMany({
      where,
      orderBy,
      include: {
        vendor: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    return products.map((product) => ({
      id: product.id,
      vendorId: product.vendorId,
      name: product.name,
      description: product.description,
      category: product.category as any,
      price: product.price,
      currency: product.currency,
      stock: product.stock,
      sku: product.sku,
      imageUrl: product.imageUrl,
      images: product.images,
      status: product.status as any,
      isActive: product.isActive,
      rating: product.rating,
      reviewCount: product.reviewCount,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      vendor: product.vendor,
    }));
  }

  /**
   * Get product by ID
   */
  async getProductById(id: string): Promise<ProductResponse | null> {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        vendor: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!product) {
      return null;
    }

    return {
      id: product.id,
      vendorId: product.vendorId,
      name: product.name,
      description: product.description,
      category: product.category as any,
      price: product.price,
      currency: product.currency,
      stock: product.stock,
      sku: product.sku,
      imageUrl: product.imageUrl,
      images: product.images,
      status: product.status as any,
      isActive: product.isActive,
      rating: product.rating,
      reviewCount: product.reviewCount,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      vendor: product.vendor,
    };
  }

  /**
   * Create a new product (vendor only)
   */
  async createProduct(vendorId: string, data: CreateProductData): Promise<ProductResponse> {
    // Check if SKU already exists
    if (data.sku) {
      const existing = await prisma.product.findUnique({
        where: { sku: data.sku },
      });
      if (existing) {
        throw new ConflictError({ message: "SKU already exists" });
      }
    }

    const product = await prisma.product.create({
      data: {
        vendorId,
        ...data,
        currency: data.currency || "GHS",
        status: "DRAFT",
      },
      include: {
        vendor: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    return {
      id: product.id,
      vendorId: product.vendorId,
      name: product.name,
      description: product.description,
      category: product.category as any,
      price: product.price,
      currency: product.currency,
      stock: product.stock,
      sku: product.sku,
      imageUrl: product.imageUrl,
      images: product.images,
      status: product.status as any,
      isActive: product.isActive,
      rating: product.rating,
      reviewCount: product.reviewCount,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      vendor: product.vendor,
    };
  }

  /**
   * Update product (vendor only)
   */
  async updateProduct(
    id: string,
    vendorId: string,
    data: UpdateProductData,
  ): Promise<ProductResponse> {
    // Verify product exists and belongs to vendor
    const existing = await prisma.product.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError({ message: "Product not found" });
    }

    if (existing.vendorId !== vendorId) {
      throw new ConflictError({ message: "You can only update your own products" });
    }

    // Check SKU uniqueness if updating
    if (data.sku && data.sku !== existing.sku) {
      const skuExists = await prisma.product.findUnique({
        where: { sku: data.sku },
      });
      if (skuExists) {
        throw new ConflictError({ message: "SKU already exists" });
      }
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...data,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : undefined,
      },
      include: {
        vendor: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    return {
      id: product.id,
      vendorId: product.vendorId,
      name: product.name,
      description: product.description,
      category: product.category as any,
      price: product.price,
      currency: product.currency,
      stock: product.stock,
      sku: product.sku,
      imageUrl: product.imageUrl,
      images: product.images,
      status: product.status as any,
      isActive: product.isActive,
      rating: product.rating,
      reviewCount: product.reviewCount,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      vendor: product.vendor,
    };
  }

  /**
   * Delete product (vendor only)
   */
  async deleteProduct(id: string, vendorId: string): Promise<void> {
    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundError({ message: "Product not found" });
    }

    if (product.vendorId !== vendorId) {
      throw new ConflictError({ message: "You can only delete your own products" });
    }

    await prisma.product.delete({
      where: { id },
    });
  }

  /**
   * Get vendor's products
   */
  async getVendorProducts(vendorId: string): Promise<ProductResponse[]> {
    const products = await prisma.product.findMany({
      where: { vendorId },
      orderBy: { createdAt: "desc" },
      include: {
        vendor: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    return products.map((product) => ({
      id: product.id,
      vendorId: product.vendorId,
      name: product.name,
      description: product.description,
      category: product.category as any,
      price: product.price,
      currency: product.currency,
      stock: product.stock,
      sku: product.sku,
      imageUrl: product.imageUrl,
      images: product.images,
      status: product.status as any,
      isActive: product.isActive,
      rating: product.rating,
      reviewCount: product.reviewCount,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      vendor: product.vendor,
    }));
  }

  // ========================================
  // ORDER OPERATIONS
  // ========================================

  /**
   * Create a new order
   */
  async createOrder(customerId: string, data: CreateOrderData): Promise<OrderResponse> {
    // Generate order number
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Fetch products and calculate total
    const productIds = data.items.map((item) => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    if (products.length !== productIds.length) {
      throw new NotFoundError({ message: "One or more products not found" });
    }

    // Check stock availability
    for (const item of data.items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) {
        throw new NotFoundError({ message: `Product ${item.productId} not found` });
      }
      if (product.stock < item.quantity) {
        throw new ConflictError({
          message: `Insufficient stock for ${product.name}. Available: ${product.stock}`,
        });
      }
    }

    // Calculate total
    let total = 0;
    const orderItems = data.items.map((item) => {
      const product = products.find((p) => p.id === item.productId)!;
      const subtotal = product.price * item.quantity;
      total += subtotal;
      return {
        productId: item.productId,
        quantity: item.quantity,
        price: product.price,
        subtotal,
      };
    });

    // Create order with items in a transaction
    const order = await prisma.$transaction(async (tx) => {
      // Create order
      const newOrder = await tx.order.create({
        data: {
          customerId,
          orderNumber,
          total,
          currency: "GHS",
          shippingAddress: data.shippingAddress || null,
          status: "PENDING",
          items: {
            create: orderItems,
          },
        },
        include: {
          items: {
            include: {
              product: {
                include: {
                  vendor: {
                    select: {
                      id: true,
                      username: true,
                      firstName: true,
                      lastName: true,
                      avatarUrl: true,
                    },
                  },
                },
              },
            },
          },
          customer: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
        },
      });

      // Update product stock
      for (const item of data.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });
      }

      return newOrder;
    });

    return {
      id: order.id,
      customerId: order.customerId,
      orderNumber: order.orderNumber,
      total: order.total,
      currency: order.currency,
      shippingAddress: order.shippingAddress,
      status: order.status as any,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.subtotal,
        product: {
          id: item.product.id,
          vendorId: item.product.vendorId,
          name: item.product.name,
          description: item.product.description,
          category: item.product.category as any,
          price: item.product.price,
          currency: item.product.currency,
          stock: item.product.stock,
          sku: item.product.sku,
          imageUrl: item.product.imageUrl,
          images: item.product.images,
          status: item.product.status as any,
          isActive: item.product.isActive,
          rating: item.product.rating,
          reviewCount: item.product.reviewCount,
          createdAt: item.product.createdAt,
          updatedAt: item.product.updatedAt,
          vendor: item.product.vendor,
        },
      })),
      customer: order.customer,
    };
  }

  /**
   * Get order by ID
   */
  async getOrderById(id: string, userId: string, isAdmin: boolean = false): Promise<OrderResponse | null> {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              include: {
                vendor: {
                  select: {
                    id: true,
                    username: true,
                    firstName: true,
                    lastName: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },
        customer: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!order) {
      return null;
    }

    // Check access: customer can only see their own orders, admin can see all
    if (!isAdmin && order.customerId !== userId) {
      throw new ConflictError({ message: "Access denied" });
    }

    return {
      id: order.id,
      customerId: order.customerId,
      orderNumber: order.orderNumber,
      total: order.total,
      currency: order.currency,
      shippingAddress: order.shippingAddress,
      status: order.status as any,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.subtotal,
        product: {
          id: item.product.id,
          vendorId: item.product.vendorId,
          name: item.product.name,
          description: item.product.description,
          category: item.product.category as any,
          price: item.product.price,
          currency: item.product.currency,
          stock: item.product.stock,
          sku: item.product.sku,
          imageUrl: item.product.imageUrl,
          images: item.product.images,
          status: item.product.status as any,
          isActive: item.product.isActive,
          rating: item.product.rating,
          reviewCount: item.product.reviewCount,
          createdAt: item.product.createdAt,
          updatedAt: item.product.updatedAt,
          vendor: item.product.vendor,
        },
      })),
      customer: order.customer,
    };
  }

  /**
   * Get customer's orders
   */
  async getCustomerOrders(customerId: string): Promise<OrderResponse[]> {
    const orders = await prisma.order.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          include: {
            product: {
              include: {
                vendor: {
                  select: {
                    id: true,
                    username: true,
                    firstName: true,
                    lastName: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },
        customer: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    return orders.map((order) => ({
      id: order.id,
      customerId: order.customerId,
      orderNumber: order.orderNumber,
      total: order.total,
      currency: order.currency,
      shippingAddress: order.shippingAddress,
      status: order.status as any,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.subtotal,
        product: {
          id: item.product.id,
          vendorId: item.product.vendorId,
          name: item.product.name,
          description: item.product.description,
          category: item.product.category as any,
          price: item.product.price,
          currency: item.product.currency,
          stock: item.product.stock,
          sku: item.product.sku,
          imageUrl: item.product.imageUrl,
          images: item.product.images,
          status: item.product.status as any,
          isActive: item.product.isActive,
          rating: item.product.rating,
          reviewCount: item.product.reviewCount,
          createdAt: item.product.createdAt,
          updatedAt: item.product.updatedAt,
          vendor: item.product.vendor,
        },
      })),
      customer: order.customer,
    }));
  }

  /**
   * Get vendor's orders (orders containing their products)
   */
  async getVendorOrders(vendorId: string): Promise<OrderResponse[]> {
    // Get all products by this vendor
    const vendorProducts = await prisma.product.findMany({
      where: { vendorId },
      select: { id: true },
    });

    const productIds = vendorProducts.map((p) => p.id);

    // Get orders that contain these products
    const orders = await prisma.order.findMany({
      where: {
        items: {
          some: {
            productId: { in: productIds },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          where: {
            productId: { in: productIds },
          },
          include: {
            product: {
              include: {
                vendor: {
                  select: {
                    id: true,
                    username: true,
                    firstName: true,
                    lastName: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },
        customer: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    return orders.map((order) => ({
      id: order.id,
      customerId: order.customerId,
      orderNumber: order.orderNumber,
      total: order.total,
      currency: order.currency,
      shippingAddress: order.shippingAddress,
      status: order.status as any,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.subtotal,
        product: {
          id: item.product.id,
          vendorId: item.product.vendorId,
          name: item.product.name,
          description: item.product.description,
          category: item.product.category as any,
          price: item.product.price,
          currency: item.product.currency,
          stock: item.product.stock,
          sku: item.product.sku,
          imageUrl: item.product.imageUrl,
          images: item.product.images,
          status: item.product.status as any,
          isActive: item.product.isActive,
          rating: item.product.rating,
          reviewCount: item.product.reviewCount,
          createdAt: item.product.createdAt,
          updatedAt: item.product.updatedAt,
          vendor: item.product.vendor,
        },
      })),
      customer: order.customer,
    }));
  }

  /**
   * Update order status
   */
  async updateOrderStatus(
    id: string,
    data: UpdateOrderStatusData,
  ): Promise<OrderResponse> {
    const updateData: any = {
      status: data.status,
    };

    // Set timestamps based on status
    if (data.status === "SHIPPED") {
      updateData.shippedAt = new Date();
    } else if (data.status === "DELIVERED") {
      updateData.deliveredAt = new Date();
    }

    const order = await prisma.order.update({
      where: { id },
      data: updateData,
      include: {
        items: {
          include: {
            product: {
              include: {
                vendor: {
                  select: {
                    id: true,
                    username: true,
                    firstName: true,
                    lastName: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },
        customer: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    return {
      id: order.id,
      customerId: order.customerId,
      orderNumber: order.orderNumber,
      total: order.total,
      currency: order.currency,
      shippingAddress: order.shippingAddress,
      status: order.status as any,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.subtotal,
        product: {
          id: item.product.id,
          vendorId: item.product.vendorId,
          name: item.product.name,
          description: item.product.description,
          category: item.product.category as any,
          price: item.product.price,
          currency: item.product.currency,
          stock: item.product.stock,
          sku: item.product.sku,
          imageUrl: item.product.imageUrl,
          images: item.product.images,
          status: item.product.status as any,
          isActive: item.product.isActive,
          rating: item.product.rating,
          reviewCount: item.product.reviewCount,
          createdAt: item.product.createdAt,
          updatedAt: item.product.updatedAt,
          vendor: item.product.vendor,
        },
      })),
      customer: order.customer,
    };
  }
}

export default new MarketplaceService();
