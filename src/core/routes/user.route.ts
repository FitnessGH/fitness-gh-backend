import { BaseRoute } from "@/core/base-route";
import type { Request, Response, NextFunction } from "express";

/**
 * User Route - Example of a comprehensive route class
 * Demonstrates middleware, validation, error handling, and CRUD operations
 */
class UserRoute extends BaseRoute {
  protected initializeRoutes(): void {
    // Apply middleware to all routes in this class
    this.router.use(this.logRequest);
    
    // Define routes using helper methods
    this.get("/", this.getAllUsers);
    this.get("/:id", this.validateUserId, this.getUserById);
    this.post("/", this.validateUserData, this.createUser);
    this.put("/:id", this.validateUserId, this.validateUserData, this.updateUser);
    this.patch("/:id", this.validateUserId, this.patchUser);
    this.delete("/:id", this.validateUserId, this.deleteUser);
  }

  // Middleware
  private logRequest = (req: Request, res: Response, next: NextFunction): void => {
    console.log(`User Route: ${req.method} ${req.path}`);
    next();
  };

  private validateUserId = (req: Request, res: Response, next: NextFunction): void => {
    const { id } = req.params;
    if (!id || isNaN(Number(id))) {
      res.status(400).json({ error: "Invalid user ID" });
      return;
    }
    next();
  };

  private validateUserData = (req: Request, res: Response, next: NextFunction): void => {
    const { name, email } = req.body;
    if (!name || !email) {
      res.status(400).json({ error: "Name and email are required" });
      return;
    }
    next();
  };

  // Route handlers
  private getAllUsers = (req: Request, res: Response): void => {
    // Simulate fetching users
    const users = [
      { id: 1, name: "John Doe", email: "john@example.com" },
      { id: 2, name: "Jane Smith", email: "jane@example.com" },
    ];
    res.json(users);
  };

  private getUserById = (req: Request, res: Response): void => {
    const { id } = req.params;
    // Simulate fetching user by ID
    const user = { id: Number(id), name: "John Doe", email: "john@example.com" };
    res.json(user);
  };

  private createUser = (req: Request, res: Response): void => {
    const { name, email } = req.body;
    // Simulate creating user
    const newUser = { id: Date.now(), name, email };
    res.status(201).json(newUser);
  };

  private updateUser = (req: Request, res: Response): void => {
    const { id } = req.params;
    const { name, email } = req.body;
    // Simulate updating user
    const updatedUser = { id: Number(id), name, email };
    res.json(updatedUser);
  };

  private patchUser = (req: Request, res: Response): void => {
    const { id } = req.params;
    // Simulate partial update
    const updatedUser = { id: Number(id), ...req.body };
    res.json(updatedUser);
  };

  private deleteUser = (req: Request, res: Response): void => {
    const { id } = req.params;
    // Simulate deleting user
    res.json({ message: `User ${id} deleted successfully` });
  };
}

export default new UserRoute().getRouter();