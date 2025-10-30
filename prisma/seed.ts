/* eslint-disable no-console */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seeding...");

  // Clear existing users first
  await prisma.user.deleteMany({});
  console.log("🧹 Cleared existing users");

  // Create sample users
  const users = await Promise.all([
    prisma.user.create({
      data: {
        email: "john.doe@example.com",
        username: "johndoe",
        firstName: "John",
        lastName: "Doe",
        height: 175.0, // 5'9"
        weight: 75.0, // 75kg
        age: 28,
        gender: "MALE",
      },
    }),
    prisma.user.create({
      data: {
        email: "jane.smith@example.com",
        username: "janesmith",
        firstName: "Jane",
        lastName: "Smith",
        height: 165.0, // 5'5"
        weight: 60.0, // 60kg
        age: 25,
        gender: "FEMALE",
      },
    }),
  ]);

  console.log(`✅ Created ${users.length} users`);
  console.log("🎉 Database seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Error during database seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
