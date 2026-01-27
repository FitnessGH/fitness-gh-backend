import request from "supertest";
import { describe, expect, it } from "vitest";

import app from "../src/app.js";

describe("GET /", () => {
  it("responds with a json message containing welcome info", async () => {
    const response = await request(app)
      .get("/")
      .set("Accept", "application/json")
      .expect("Content-Type", /json/)
      .expect(200);

    expect(response.body).toHaveProperty("message", "Welcome to Fitness GH Backend API - 🚀");
    expect(response.body).toHaveProperty("version");
    expect(response.body).toHaveProperty("endpoints");
  });
});
