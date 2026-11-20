/**
 * Development seed data. Every product created here is marked isDemo = true and titled "[Demo] …"
 * so it's obvious it isn't a real Made by Myra listing. Delete or replace them from the dashboard.
 * Prices, shipping rates and FAQ answers below are placeholders for testing — not business decisions.
 *
 * Run:  npm run db:seed
 */
import { PrismaClient, type GarmentType, type ImageView } from "@prisma/client";

const db = new PrismaClient();

const COLORS = {
  White: "#FFFFFF",
  Black: "#1F1D1D",
  Cream: "#F4EBDD",
  "Light Pink": "#F6D3DA",
  "Heather Gray": "#B9B7B5",
  Navy: "#22304A",
  "Sage Green": "#B5C1A6",
} as const;

type Loc = { name: string; view: ImageView; areaX: number; areaY: number; areaW: number; areaH: number; widthIn: number; heightIn: number; priceCents: number };

const TOP_LOCS: Loc[] = [
  { name: "Front center", view: "FRONT", areaX: 34, areaY: 33, areaW: 32, areaH: 34, widthIn: 12, heightIn: 13, priceCents: 0 },
  { name: "Left chest", view: "FRONT", areaX: 57, areaY: 21, areaW: 12, areaH: 9, widthIn: 4, heightIn: 3.5, priceCents: 0 },
  { name: "Back center", view: "BACK", areaX: 33, areaY: 22, areaW: 34, areaH: 42, widthIn: 12, heightIn: 15, priceCents: 800 },
];

const TEE_CHART = {
  columns: ["Size", "Chest (in)", "Length (in)"],
  rows: [["XS", "31–34", "27"], ["S", "34–37", "28"], ["M", "38–41", "29"], ["L", "42–45", "30"], ["XL", "46–49", "31"], ["2XL", "50–53", "32"], ["3XL", "54–57", "33"]],
};

type Demo = {
  title: string;
  slug: string;
  category: string;
  garmentType: GarmentType;
  basePriceCents: number;
  description: string;
  colors: (keyof typeof COLORS)[];
  sizes: { label: string; surchargeCents?: number }[];
  locations: Loc[];
  isCustomizable?: boolean;
  allowUpload?: boolean;
  designRequestMode?: "FIXED_FEE" | "QUOTE";
  isFeatured?: boolean;
  tags: string[];
  stock?: number | null;
  sizeChart?: { columns: string[]; rows: string[][] };
};

const STD_SIZES = [{ label: "XS" }, { label: "S" }, { label: "M" }, { label: "L" }, { label: "XL" }, { label: "2XL", surchargeCents: 200 }, { label: "3XL", surchargeCents: 400 }];

const PRODUCTS: Demo[] = [
  {
    title: "[Demo] Classic Custom Tee",
    slug: "demo-classic-custom-tee",
    category: "custom-t-shirts",
    garmentType: "TSHIRT",
    basePriceCents: 2400,
    description: "Demonstration product. A soft everyday tee ready for your artwork, a name, or a design we create together.",
    colors: ["White", "Black", "Cream", "Light Pink", "Heather Gray", "Navy", "Sage Green"],
    sizes: STD_SIZES,
    locations: TOP_LOCS,
    isFeatured: true,
    tags: ["tee", "t-shirt", "custom", "shirt"],
    sizeChart: TEE_CHART,
  },
  {
    title: "[Demo] Cozy Custom Hoodie",
    slug: "demo-cozy-custom-hoodie",
    category: "hoodies-sweatshirts",
    garmentType: "HOODIE",
    basePriceCents: 4800,
    description: "Demonstration product. A cozy pullover hoodie for your own design or a custom creation.",
    colors: ["Light Pink", "Cream", "Heather Gray", "Black", "Sage Green"],
    sizes: STD_SIZES.slice(1),
    locations: [
      { name: "Front center", view: "FRONT", areaX: 34, areaY: 37, areaW: 32, areaH: 24, widthIn: 11, heightIn: 8, priceCents: 0 },
      { name: "Left chest", view: "FRONT", areaX: 56, areaY: 25, areaW: 12, areaH: 9, widthIn: 4, heightIn: 3.5, priceCents: 0 },
      { name: "Back center", view: "BACK", areaX: 32, areaY: 26, areaW: 36, areaH: 40, widthIn: 12, heightIn: 14, priceCents: 900 },
    ],
    isFeatured: true,
    tags: ["hoodie", "sweatshirt", "custom"],
  },
  {
    title: "[Demo] Custom Crewneck Sweatshirt",
    slug: "demo-custom-crewneck",
    category: "hoodies-sweatshirts",
    garmentType: "CREWNECK",
    basePriceCents: 4200,
    description: "Demonstration product. A classic crewneck — perfect for names, dates and little doodles.",
    colors: ["Cream", "Heather Gray", "Navy", "Light Pink"],
    sizes: STD_SIZES.slice(1),
    locations: TOP_LOCS,
    isFeatured: true,
    tags: ["crewneck", "sweatshirt", "custom"],
  },
  {
    title: "[Demo] Custom Long-Sleeve Tee",
    slug: "demo-custom-long-sleeve",
    category: "custom-t-shirts",
    garmentType: "LONGSLEEVE",
    basePriceCents: 3000,
    description: "Demonstration product. A long-sleeve tee with an optional sleeve print.",
    colors: ["White", "Black", "Cream"],
    sizes: STD_SIZES.slice(1, 6),
    locations: [...TOP_LOCS, { name: "Sleeve", view: "FRONT", areaX: 80, areaY: 56, areaW: 8, areaH: 18, widthIn: 3, heightIn: 8, priceCents: 600 }],
    tags: ["long sleeve", "tee", "custom"],
  },
  {
    title: "[Demo] Personalized Sweatpants",
    slug: "demo-personalized-sweatpants",
    category: "sweatpants-bottoms",
    garmentType: "SWEATPANTS",
    basePriceCents: 4000,
    description: "Demonstration product. Comfy joggers with a print on either leg.",
    colors: ["Heather Gray", "Black", "Light Pink"],
    sizes: STD_SIZES.slice(1, 6),
    locations: [
      { name: "Left leg", view: "FRONT", areaX: 56, areaY: 38, areaW: 14, areaH: 26, widthIn: 4, heightIn: 10, priceCents: 0 },
      { name: "Right leg", view: "FRONT", areaX: 30, areaY: 38, areaW: 14, areaH: 26, widthIn: 4, heightIn: 10, priceCents: 0 },
    ],
    isFeatured: true,
    tags: ["sweatpants", "joggers", "bottoms"],
  },
  {
    title: "[Demo] Custom Shorts",
    slug: "demo-custom-shorts",
    category: "sweatpants-bottoms",
    garmentType: "SHORTS",
    basePriceCents: 3200,
    description: "Demonstration product. This one is set to “quote first” for design requests, so you can test the quote flow.",
    colors: ["Heather Gray", "Black"],
    sizes: STD_SIZES.slice(1, 5),
    locations: [{ name: "Left leg", view: "FRONT", areaX: 56, areaY: 46, areaW: 18, areaH: 20, widthIn: 4, heightIn: 4, priceCents: 0 }],
    designRequestMode: "QUOTE",
    tags: ["shorts", "bottoms"],
  },
  {
    title: "[Demo] Canvas Tote Bag",
    slug: "demo-canvas-tote",
    category: "tote-bags-accessories",
    garmentType: "TOTE",
    basePriceCents: 2000,
    description: "Demonstration product. A sturdy canvas tote for groceries, books and everything in between.",
    colors: ["Cream", "Black"],
    sizes: [{ label: "One size" }],
    locations: [{ name: "Front center", view: "FRONT", areaX: 30, areaY: 45, areaW: 40, areaH: 36, widthIn: 10, heightIn: 10, priceCents: 0 }],
    isFeatured: true,
    tags: ["tote", "bag", "accessories", "gift"],
    stock: 25,
  },
  {
    title: "[Demo] Personalized Gift Tote",
    slug: "demo-personalized-gift-tote",
    category: "personalized-gifts",
    garmentType: "TOTE",
    basePriceCents: 2600,
    description: "Demonstration product. A tote personalized with a name — a thoughtful gift.",
    colors: ["Cream", "Light Pink"],
    sizes: [{ label: "One size" }],
    locations: [{ name: "Front center", view: "FRONT", areaX: 30, areaY: 45, areaW: 40, areaH: 36, widthIn: 10, heightIn: 10, priceCents: 0 }],
    tags: ["gift", "tote", "personalized"],
  },
  {
    title: "[Demo] Made With Love Tee",
    slug: "demo-made-with-love-tee",
    category: "ready-to-shop",
    garmentType: "TSHIRT",
    basePriceCents: 2600,
    description: "Demonstration product. A ready-to-shop design — choose your color and size, no customization needed.",
    colors: ["White", "Light Pink", "Cream"],
    sizes: STD_SIZES.slice(0, 6),
    locations: [],
    isCustomizable: false,
    isFeatured: true,
    tags: ["ready to ship", "tee", "love"],
    stock: 10,
    sizeChart: TEE_CHART,
  },
];

async function main() {
  const categories = [
    { name: "Custom T-Shirts", slug: "custom-t-shirts" },
    { name: "Hoodies & Sweatshirts", slug: "hoodies-sweatshirts" },
    { name: "Sweatpants & Bottoms", slug: "sweatpants-bottoms" },
    { name: "Tote Bags & Accessories", slug: "tote-bags-accessories" },
    { name: "Personalized Gifts", slug: "personalized-gifts" },
    { name: "Ready-to-Shop Designs", slug: "ready-to-shop" },
  ];
  const catIds: Record<string, string> = {};
  for (const [i, c] of categories.entries()) {
    const row = await db.category.upsert({ where: { slug: c.slug }, update: {}, create: { ...c, sortOrder: i } });
    catIds[c.slug] = row.id;
  }

  for (const d of PRODUCTS) {
    if (await db.product.findUnique({ where: { slug: d.slug } })) continue;
    await db.product.create({
      data: {
        title: d.title,
        slug: d.slug,
        description: d.description,
        materials: "Demo: replace with real fabric details.",
        careInstructions: "Demo: replace with your care instructions.",
        productionTime: "Demo: replace with your production timeframe.",
        basePriceCents: d.basePriceCents,
        garmentType: d.garmentType,
        categoryId: catIds[d.category],
        tags: d.tags,
        status: "PUBLISHED",
        isFeatured: d.isFeatured ?? false,
        isCustomizable: d.isCustomizable ?? true,
        allowUpload: d.allowUpload ?? true,
        allowDesignRequest: d.isCustomizable ?? true,
        designRequestMode: d.designRequestMode ?? "FIXED_FEE",
        isDemo: true,
        sizeChart: d.sizeChart,
        colors: { create: d.colors.map((name, i) => ({ name, hex: COLORS[name], sortOrder: i })) },
        sizes: { create: d.sizes.map((s, i) => ({ label: s.label, surchargeCents: s.surchargeCents ?? 0, sortOrder: i })) },
        printLocations: { create: d.locations.map((l, i) => ({ ...l, sortOrder: i })) },
      },
    });
    const p = await db.product.findUniqueOrThrow({ where: { slug: d.slug }, include: { colors: true, sizes: true } });
    for (const c of p.colors) for (const s of p.sizes) await db.productVariant.create({ data: { productId: p.id, colorId: c.id, sizeId: s.id, stock: d.stock ?? null } });
  }

  if ((await db.shippingRate.count()) === 0) {
    await db.shippingRate.createMany({
      data: [
        { name: "Demo — Standard shipping", amountCents: 595, freeOverCents: 7500, minDays: 3, maxDays: 7, sortOrder: 0 },
        { name: "Demo — Express shipping", amountCents: 1495, minDays: 1, maxDays: 3, sortOrder: 1 },
      ],
    });
  }

  if ((await db.faqItem.count()) === 0) {
    const draft = "(Draft answer — please edit in the dashboard.)";
    await db.faqItem.createMany({
      data: [
        { q: "How do custom orders work?", a: "Choose a product, pick your color and size, then upload your own design or describe the design you'd like us to create. We review every order before it's made." },
        { q: "What file formats can I upload?", a: "PNG, JPG/JPEG, PDF and SVG. For the sharpest prints, upload a high-resolution file (ideally 300 DPI at print size) with a transparent background." },
        { q: "Can you help me create a design?", a: `Yes — choose “Help me create a design” and describe your idea. We'll create a proof for you to approve before production. ${draft}` },
        { q: "How long does production take?", a: `Production times are shown on each product page. ${draft}` },
        { q: "How much is shipping?", a: "Shipping options and prices are shown at checkout." },
        { q: "What is your return policy?", a: `Please see our Return Policy page. ${draft}` },
        { q: "How do I choose my size?", a: "Each product has a size chart next to the size buttons." },
        { q: "How does artwork approval work?", a: "For design requests, we email you a proof. You can approve it or request changes from your order page. Production starts after you approve." },
        { q: "How should I wash my custom item?", a: `Care instructions are listed on each product page. ${draft}` },
      ].map((f, i) => ({ question: f.q, answer: f.a, sortOrder: i })),
    });
  }

  console.log("Seed complete: demo categories, products, shipping rates and draft FAQs.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
