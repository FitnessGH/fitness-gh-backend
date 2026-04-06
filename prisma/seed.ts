/* eslint-disable no-console */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;

async function main() {
  console.log("🌱 Starting database seeding...\n");

  // ─── 1. Create vendor accounts + profiles ───────────────────────
  const vendorPassword = await bcrypt.hash("Vendor@123", SALT_ROUNDS);

  const vendors = [
    {
      email: "vendor.nutrition@fitnessgh.com",
      username: "ghnutrition",
      firstName: "GH",
      lastName: "Nutrition Co.",
    },
    {
      email: "vendor.ironworks@fitnessgh.com",
      username: "ironworksgh",
      firstName: "IronWorks",
      lastName: "GH",
    },
    {
      email: "vendor.fitgear@fitnessgh.com",
      username: "fitgearaccra",
      firstName: "FitGear",
      lastName: "Accra",
    },
    {
      email: "vendor.activewear@fitnessgh.com",
      username: "activeweargh",
      firstName: "ActiveWear",
      lastName: "GH",
    },
  ];

  const vendorProfiles: Record<string, string> = {}; // username → profileId

  for (const v of vendors) {
    // Upsert account
    const account = await prisma.account.upsert({
      where: { email: v.email },
      update: {},
      create: {
        email: v.email,
        passwordHash: vendorPassword,
        userType: "EMPLOYEE", // vendors use EMPLOYEE type
        emailVerified: true,
        isActive: true,
      },
    });

    // Upsert profile
    const profile = await prisma.userProfile.upsert({
      where: { accountId: account.id },
      update: {},
      create: {
        accountId: account.id,
        username: v.username,
        firstName: v.firstName,
        lastName: v.lastName,
        preferences: { businessName: `${v.firstName} ${v.lastName}` },
      },
    });

    vendorProfiles[v.username] = profile.id;
    console.log(`  ✅ Vendor: ${v.firstName} ${v.lastName} (${v.email})`);
  }

  console.log(`\n📦 Created ${Object.keys(vendorProfiles).length} vendor accounts\n`);

  // ─── 2. Seed marketplace products ───────────────────────────────
  const products = [
    {
      name: "Premium Whey Protein Isolate",
      description:
        "High-quality whey protein with 25g protein per serving. Fast absorption for post-workout recovery. Available in chocolate and vanilla flavors. Our whey protein isolate is sourced from grass-fed cows and undergoes micro-filtration to deliver a clean, easily digestible protein with minimal fat and lactose. Perfect for athletes and fitness enthusiasts looking to build lean muscle.",
      category: "SUPPLEMENTS" as const,
      price: 250.0,
      stock: 48,
      sku: "SUP-WPI-001",
      imageUrl:
        "https://images.unsplash.com/photo-1593095948071-474c5cc2c4d8?w=600&h=450&fit=crop",
      images: [
        "https://images.unsplash.com/photo-1593095948071-474c5cc2c4d8?w=600&h=450&fit=crop",
        "https://images.unsplash.com/photo-1579722821273-0f6c7d44362f?w=600&h=450&fit=crop",
      ],
      rating: 4.7,
      reviewCount: 134,
      vendorUsername: "ghnutrition",
    },
    {
      name: "Adjustable Dumbbell Set (5-25kg)",
      description:
        "Space-saving adjustable dumbbells perfect for home workouts. Quick-change weight system with durable steel construction and comfortable grip. Each dumbbell adjusts from 5kg to 25kg in 2.5kg increments, replacing an entire rack of weights. The anti-slip handle design ensures a secure grip even during the most intense training sessions.",
      category: "EQUIPMENT" as const,
      price: 850.0,
      stock: 12,
      sku: "EQP-ADB-002",
      imageUrl:
        "https://images.unsplash.com/photo-1586401100295-7a8096fd231a?w=600&h=450&fit=crop",
      images: [
        "https://images.unsplash.com/photo-1586401100295-7a8096fd231a?w=600&h=450&fit=crop",
        "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&h=450&fit=crop",
      ],
      rating: 4.9,
      reviewCount: 87,
      vendorUsername: "ironworksgh",
    },
    {
      name: "Resistance Bands Set (5 Pack)",
      description:
        "Five resistance levels from light to extra heavy. Made from natural latex with non-slip handles. Great for stretching, toning, and rehab exercises. Includes a carrying bag and exercise guide. Each band is color-coded for easy identification and offers a different resistance level to suit all fitness levels.",
      category: "ACCESSORIES" as const,
      price: 120.0,
      stock: 95,
      sku: "ACC-RBS-003",
      imageUrl:
        "https://images.unsplash.com/photo-1598289431512-b97b0917affc?w=600&h=450&fit=crop",
      images: [],
      rating: 4.5,
      reviewCount: 203,
      vendorUsername: "fitgearaccra",
    },
    {
      name: "Compression Training Tights",
      description:
        "Moisture-wicking compression leggings with four-way stretch fabric. Features a hidden pocket and reflective logo for night runs. The graduated compression technology improves circulation and reduces muscle fatigue during and after workouts.",
      category: "APPAREL" as const,
      price: 175.0,
      stock: 35,
      sku: "APP-CTT-004",
      imageUrl:
        "https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=600&h=450&fit=crop",
      images: [],
      rating: 4.3,
      reviewCount: 56,
      vendorUsername: "activeweargh",
    },
    {
      name: "Creatine Monohydrate (500g)",
      description:
        "Pure micronized creatine monohydrate for increased strength and power output. Mixes easily with no gritty texture. 100 servings per container. Clinically proven to enhance high-intensity exercise performance and support muscle growth when combined with resistance training.",
      category: "SUPPLEMENTS" as const,
      price: 180.0,
      stock: 72,
      sku: "SUP-CRM-005",
      imageUrl:
        "https://images.unsplash.com/photo-1579722821273-0f6c7d44362f?w=600&h=450&fit=crop",
      images: [],
      rating: 4.8,
      reviewCount: 312,
      vendorUsername: "ghnutrition",
    },
    {
      name: "Olympic Barbell (20kg)",
      description:
        "Competition-grade 7ft Olympic barbell with 700lb capacity. Chrome finish with diamond knurling for superior grip during heavy lifts. Features precision-machined sleeves with smooth spin for Olympic lifts. Meets IWF specifications for competitive use.",
      category: "EQUIPMENT" as const,
      price: 1200.0,
      stock: 8,
      sku: "EQP-OLB-006",
      imageUrl:
        "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&h=450&fit=crop",
      images: [],
      rating: 5.0,
      reviewCount: 42,
      vendorUsername: "ironworksgh",
    },
    {
      name: "Gym Duffle Bag (45L)",
      description:
        "Spacious gym bag with wet/dry compartments, shoe pocket, and ventilated mesh panels. Water-resistant nylon exterior with reinforced stitching. Features adjustable shoulder strap and multiple pockets for organized storage of all your gym essentials.",
      category: "ACCESSORIES" as const,
      price: 145.0,
      stock: 22,
      sku: "ACC-GDB-007",
      imageUrl:
        "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&h=450&fit=crop",
      images: [],
      rating: 4.1,
      reviewCount: 78,
      vendorUsername: "activeweargh",
    },
    {
      name: "Foam Roller & Massage Ball Kit",
      description:
        "High-density EVA foam roller with textured surface plus lacrosse-style massage ball. Ideal for myofascial release and post-workout recovery. Helps relieve muscle tension, improve flexibility, and speed up recovery time between training sessions.",
      category: "OTHER" as const,
      price: 95.0,
      stock: 60,
      sku: "OTH-FRM-008",
      imageUrl:
        "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=600&h=450&fit=crop",
      images: [],
      rating: 4.6,
      reviewCount: 149,
      vendorUsername: "fitgearaccra",
    },
    {
      name: "Dry-Fit Training Tank Top",
      description:
        "Lightweight breathable tank with anti-odor technology. Flatlock seams prevent chafing during intense sessions. Available in 6 colors. The moisture-management fabric keeps you cool and dry, making it perfect for both gym workouts and outdoor training.",
      category: "APPAREL" as const,
      price: 85.0,
      stock: 150,
      sku: "APP-DTT-009",
      imageUrl:
        "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&h=450&fit=crop",
      images: [],
      rating: 4.4,
      reviewCount: 91,
      vendorUsername: "activeweargh",
    },
  ];

  for (const p of products) {
    const vendorId = vendorProfiles[p.vendorUsername];
    if (!vendorId) {
      console.warn(`  ⚠️  Vendor not found for ${p.name}, skipping`);
      continue;
    }

    await prisma.product.upsert({
      where: { sku: p.sku },
      update: {
        name: p.name,
        description: p.description,
        category: p.category,
        price: p.price,
        stock: p.stock,
        imageUrl: p.imageUrl,
        images: p.images,
        rating: p.rating,
        reviewCount: p.reviewCount,
        status: "ACTIVE",
        isActive: true,
      },
      create: {
        vendorId,
        name: p.name,
        description: p.description,
        category: p.category,
        price: p.price,
        currency: "GHS",
        stock: p.stock,
        sku: p.sku,
        imageUrl: p.imageUrl,
        images: p.images,
        status: "ACTIVE",
        isActive: true,
        rating: p.rating,
        reviewCount: p.reviewCount,
      },
    });

    console.log(`  🏷️  ${p.name} (${p.sku})`);
  }

  console.log(`\n🎉 Seeded ${products.length} products successfully!`);
  console.log("\n📋 Vendor login credentials:");
  console.log("   Password for all vendors: Vendor@123");
  for (const v of vendors) {
    console.log(`   • ${v.email}`);
  }
}

main()
  .catch((e) => {
    console.error("❌ Error during database seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
