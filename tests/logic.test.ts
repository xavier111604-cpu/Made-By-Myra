// Pure-logic tests for pricing, discounts, print resolution, file checks and customization validation.
// Run with: npm test
import assert from "node:assert/strict";
import { priceLine, discountAmount, startingPrice, PricingError } from "../src/lib/pricing";
import { effectiveDpi, dpiVerdict } from "../src/lib/upload-rules";
import { matchesSignature, svgIsSafe } from "../src/lib/file-validation";
import { customizationSchema } from "../src/lib/customization";

const settings = { designFeeCents: 1500, includedRevisions: 2, extraRevisionFeeCents: 500 };
const product: any = {
  basePriceCents: 2400, isCustomizable: true, allowUpload: true, allowDesignRequest: true, designRequestMode: "FIXED_FEE", designFeeCents: null,
  sizes: [{ id: "M", surchargeCents: 0 }, { id: "2XL", surchargeCents: 200 }],
  printLocations: [{ id: "front", priceCents: 0 }, { id: "back", priceCents: 800 }],
};
const vM: any = { sizeId: "M", priceOverrideCents: null };
const v2: any = { sizeId: "2XL", priceOverrideCents: null };
const vOverride: any = { sizeId: "M", priceOverrideCents: 3000 };

// plain item
assert.equal(priceLine(product, vM, null, 2, settings).lineTotalCents, 4800);
// size surcharge
assert.equal(priceLine(product, v2, null, 1, settings).lineTotalCents, 2600);
// variant override beats surcharge
assert.equal(priceLine(product, vOverride, null, 1, settings).unitPriceCents, 3000);
// upload front+back x3 => (2400+800)*3
const up = priceLine(product, vM, { method: "UPLOAD", placements: [{ locationId: "front", uploadId: "u1", x: .5, y: .5, scale: .8 }, { locationId: "back", uploadId: "u2", x: .5, y: .5, scale: .8 }] }, 3, settings);
assert.equal(up.lineTotalCents, 9600);
// duplicate location rejected
assert.throws(() => priceLine(product, vM, { method: "UPLOAD", placements: [{ locationId: "front", uploadId: "a", x: .5, y: .5, scale: .8 }, { locationId: "front", uploadId: "b", x: .5, y: .5, scale: .8 }] }, 1, settings), PricingError);
// unknown location rejected
assert.throws(() => priceLine(product, vM, { method: "UPLOAD", placements: [{ locationId: "sleeve", uploadId: "a", x: .5, y: .5, scale: .8 }] }, 1, settings), PricingError);
// design request: fee once per line + chosen placement per unit => (2400+800)*2 + 1500
const dr = priceLine(product, vM, { method: "DESIGN_REQUEST", request: { description: "pink floral name", placementLocationId: "back", inspirationUploadIds: [] } }, 2, settings);
assert.equal(dr.lineTotalCents, 7900); assert.equal(dr.requiresDesign, true);
// per-product design fee overrides global
assert.equal(priceLine({ ...product, designFeeCents: 2500 }, vM, { method: "DESIGN_REQUEST", request: { description: "pink floral name", inspirationUploadIds: [] } }, 1, settings).designFeeCents, 2500);
// quote-mode products can't be added with a design request
assert.throws(() => priceLine({ ...product, designRequestMode: "QUOTE" }, vM, { method: "DESIGN_REQUEST", request: { description: "pink floral name", inspirationUploadIds: [] } }, 1, settings), PricingError);
// non-customizable product rejects customization
assert.throws(() => priceLine({ ...product, isCustomizable: false }, vM, { method: "UPLOAD", placements: [{ locationId: "front", uploadId: "a", x: .5, y: .5, scale: .8 }] }, 1, settings), PricingError);
// starting price
assert.equal(startingPrice({ basePriceCents: 2400, sizes: [{ surchargeCents: 0 }, { surchargeCents: 200 }], variants: [{ priceOverrideCents: 1999 }] }), 1999);

// discounts
const code = { type: "PERCENT" as const, value: 10, minSubtotalCents: null, maxRedemptions: null, redemptions: 0, expiresAt: null, active: true };
assert.deepEqual(discountAmount(code, 5000), { ok: true, cents: 500 });
assert.deepEqual(discountAmount({ ...code, type: "FIXED", value: 9000 }, 5000), { ok: true, cents: 5000 }); // capped at subtotal
assert.equal(discountAmount({ ...code, minSubtotalCents: 6000 }, 5000).ok, false);
assert.equal(discountAmount({ ...code, expiresAt: new Date(Date.now() - 1000) }, 5000).ok, false);
assert.equal(discountAmount({ ...code, maxRedemptions: 3, redemptions: 3 }, 5000).ok, false);
assert.equal(discountAmount({ ...code, active: false }, 5000).ok, false);

// print resolution: 3600px wide on 12in area at full width = 300 DPI
assert.equal(effectiveDpi(3600, 3600, 12, 14, 1), 300);
assert.equal(dpiVerdict(effectiveDpi(800, 800, 12, 14, 1)), "low");
assert.equal(dpiVerdict(effectiveDpi(2000, 2000, 12, 14, 1)), "ok");
// shrinking the artwork raises effective DPI
assert.ok(effectiveDpi(800, 800, 12, 14, 0.25) > effectiveDpi(800, 800, 12, 14, 1));

// file signatures
assert.ok(matchesSignature("image/png", Buffer.from("89504e470d0a1a0a0000000d", "hex")));
assert.ok(!matchesSignature("image/png", Buffer.from("ffd8ffe000104a464946", "hex")));
assert.ok(matchesSignature("image/jpeg", Buffer.from("ffd8ffe000104a464946", "hex")));
assert.ok(matchesSignature("application/pdf", Buffer.from("%PDF-1.7\n")));
assert.ok(!matchesSignature("application/pdf", Buffer.from("<html>")));
// SVG safety
assert.ok(svgIsSafe(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h10v10z" fill="#f6dce0"/></svg>')).ok);
assert.ok(!svgIsSafe(Buffer.from('<svg><script>alert(1)</script></svg>')).ok);
assert.ok(!svgIsSafe(Buffer.from('<svg onload="alert(1)"></svg>')).ok);
assert.ok(!svgIsSafe(Buffer.from('<svg><a href="javascript:alert(1)">x</a></svg>')).ok);
assert.ok(!svgIsSafe(Buffer.from('<svg><image href="https://evil.example/x.png"/></svg>')).ok);
assert.ok(!svgIsSafe(Buffer.from('<svg><foreignObject><div/></foreignObject></svg>')).ok);
assert.ok(svgIsSafe(Buffer.from('<svg><use href="#a"/></svg>')).ok);

// customization schema
assert.ok(customizationSchema.safeParse({ method: "UPLOAD", placements: [{ locationId: "front", uploadId: "u1", x: .5, y: .5, scale: .8 }] }).success);
assert.ok(!customizationSchema.safeParse({ method: "UPLOAD", placements: [{ locationId: "front", x: .5, y: .5, scale: .8 }] }).success, "empty placement rejected");
assert.ok(customizationSchema.safeParse({ method: "UPLOAD", placements: [{ locationId: "front", text: "Myra", x: .5, y: .5, scale: .8 }] }).success, "text-only ok");
assert.ok(!customizationSchema.safeParse({ method: "DESIGN_REQUEST", request: { description: "short" } }).success, "too-short description rejected");
assert.ok(!customizationSchema.safeParse({ method: "UPLOAD", placements: [{ locationId: "front", uploadId: "u", x: 2, y: .5, scale: .8 }] }).success, "out-of-range position rejected");
assert.ok(!customizationSchema.safeParse({ method: "HACK" }).success);
console.log("All logic tests passed ✔");
