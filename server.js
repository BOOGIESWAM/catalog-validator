// E-Commerce Catalog Validator Service
// Plain Node.js (no dependencies). Run: node server.js
const http = require("http");

const PORT = process.env.PORT || 3000;

const SKU_REGEX = /^[A-Z]{3}-\d{4,6}$/;              // e.g. ABC-1234
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COUNTRY_REGEX = /^[A-Z]{2}$/;                  // ISO code, e.g. US, SG

const catalog = [];
let nextId = 1;

function sendJson(res, status, body) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1e6) { reject(new Error("Payload too large")); req.destroy(); }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

const isNonEmptyString = (v) => typeof v === "string" && v.trim() !== "";

// Returns an array of { field, message } objects (empty array = valid)
function validateItem(body) {
  const errors = [];
  const add = (field, message) => errors.push({ field, message });

  // 1. SKU - required, must match regex
  if (!isNonEmptyString(body.sku)) {
    add("sku", "SKU is required");
  } else if (!SKU_REGEX.test(body.sku)) {
    add("sku", "SKU must match pattern ^[A-Z]{3}-\\d{4,6}$ (e.g. ABC-1234)");
  }

  // 2. Price - required number, must be > 0
  if (typeof body.price !== "number" || !Number.isFinite(body.price)) {
    add("price", "Price is required and must be a number");
  } else if (body.price <= 0) {
    add("price", "Price must be greater than 0");
  }

  // 3. Tags - array, min 1 item, all non-empty strings, all unique
  if (!Array.isArray(body.tags)) {
    add("tags", "Tags is required and must be an array");
  } else if (body.tags.length < 1) {
    add("tags", "Tags must contain at least 1 item");
  } else if (!body.tags.every(isNonEmptyString)) {
    add("tags", "Every tag must be a non-empty string");
  } else {
    const normalized = body.tags.map((t) => t.trim().toLowerCase());
    const dupes = normalized.filter((t, i) => normalized.indexOf(t) !== i);
    if (dupes.length > 0) {
      add("tags", `Tags must be unique (duplicate: ${[...new Set(dupes)].join(", ")})`);
    }
  }

  // 4. Vendor details - object with name, email, country
  const v = body.vendor;
  if (v === undefined || v === null || typeof v !== "object" || Array.isArray(v)) {
    add("vendor", "Vendor is required and must be an object");
  } else {
    if (!isNonEmptyString(v.name)) add("vendor.name", "Vendor name is required");
    if (!isNonEmptyString(v.email)) add("vendor.email", "Vendor email is required");
    else if (!EMAIL_REGEX.test(v.email)) add("vendor.email", "Vendor email is not a valid email address");
    if (!isNonEmptyString(v.country)) add("vendor.country", "Vendor country is required");
    else if (!COUNTRY_REGEX.test(v.country)) add("vendor.country", "Vendor country must be a 2-letter uppercase code (e.g. US)");
  }

  return errors;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  try {
    if (path === "/api/catalog/items" && req.method === "GET") {
      return sendJson(res, 200, { count: catalog.length, data: catalog });
    }

    if (path === "/api/catalog/items" && req.method === "POST") {
      const raw = await readBody(req);
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        return sendJson(res, 400, { error: "Bad Request", message: "Request body is not valid JSON" });
      }
      if (body === null || typeof body !== "object" || Array.isArray(body)) {
        return sendJson(res, 400, { error: "Bad Request", message: "Request body must be a JSON object" });
      }

      const errors = validateItem(body);
      if (errors.length > 0) {
        return sendJson(res, 422, { error: "Unprocessable Entity", details: errors });
      }

      const item = {
        id: nextId++,
        sku: body.sku,
        price: body.price,
        tags: body.tags.map((t) => t.trim()),
        vendor: {
          name: body.vendor.name.trim(),
          email: body.vendor.email.trim(),
          country: body.vendor.country,
        },
      };
      catalog.push(item);
      return sendJson(res, 201, { message: "Item created", data: item });
    }

    if (path === "/api/catalog/items") return sendJson(res, 405, { error: "Method Not Allowed" });
    return sendJson(res, 404, { error: "Route not found" });
  } catch (err) {
    return sendJson(res, 500, { error: "Internal server error" });
  }
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`Catalog Validator running at http://localhost:${PORT}`));
}
module.exports = server;
