import { db } from "./db";
import { modules } from "@shared/schema";

async function seed() {
  console.log("Seeding database...");

  // Seed modules
  const modulesList = [
    {
      name: "Front Office",
      description: "Reception and customer-facing operations management",
    },
    {
      name: "Power Automation",
      description: "Business process automation and workflow optimization",
    },
    {
      name: "POS (Point of Sale)",
      description: "Retail sales and payment processing system",
    },
    {
      name: "Inventory Management",
      description: "Stock tracking and warehouse management",
    },
    {
      name: "HR & Payroll",
      description: "Human resources and payroll processing",
    },
    {
      name: "Accounting",
      description: "Financial accounting and bookkeeping",
    },
    {
      name: "CRM Integration",
      description: "Customer relationship management tools",
    },
    {
      name: "Reporting & Analytics",
      description: "Business intelligence and data analytics",
    },
  ];

  for (const module of modulesList) {
    try {
      await db.insert(modules).values(module).onConflictDoNothing();
      console.log(`✓ Seeded module: ${module.name}`);
    } catch (error) {
      console.log(`Module ${module.name} already exists, skipping...`);
    }
  }

  console.log("Database seeding completed!");
}

seed()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error seeding database:", error);
    process.exit(1);
  });
