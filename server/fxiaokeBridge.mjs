import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const exportScript = path.resolve(projectRoot, "scripts", "export_fxiaoke_products.py");
const exportOutput = path.resolve(projectRoot, "public", "data", "fxiaoke-products.json");
const fxiaokeTool = "/Users/cying/.codex/skills/fxiaoke-crm-full-readonly-query/scripts/fxiaoke_openapi_tool.py";
const fxiaokeConfig = "/Users/cying/.codex/skills/fxiaoke-crm-full-readonly-query/config/credentials.local.json";
const host = process.env.FXIAOKE_BRIDGE_HOST ?? "127.0.0.1";
const port = Number(process.env.FXIAOKE_BRIDGE_PORT ?? 8787);
const ttlMs = Number(process.env.FXIAOKE_BRIDGE_TTL_MS ?? 60_000);

let lastRefreshAt = 0;
let refreshPromise = null;

async function refreshProducts() {
  const now = Date.now();
  if (now - lastRefreshAt < ttlMs) {
    return;
  }
  if (refreshPromise) {
    await refreshPromise;
    return;
  }
  refreshPromise = execFileAsync("python3", [exportScript], {
    cwd: projectRoot,
    env: process.env,
    maxBuffer: 10 * 1024 * 1024,
  })
    .then(() => {
      lastRefreshAt = Date.now();
    })
    .finally(() => {
      refreshPromise = null;
    });
  await refreshPromise;
}

async function createProduct(payload) {
  const categoryValue = String(payload.categoryValue || "").trim();
  if (!categoryValue) {
    throw new Error("请选择纷享销客产品分类");
  }
  const productStatusValue = payload.status === "INACTIVE" ? "2" : "1";
  const objectData = {
    "产品名称": payload.modelName,
    "产品编码": payload.modelCode,
    category: categoryValue,
    "价格(元)": String(Number(payload.basePrice ?? 0).toFixed(2)),
    product_status: productStatusValue,
  };

  if (payload.classification) {
    objectData["规格属性"] = payload.classification;
  }
  if (payload.description) {
    objectData["产品说明"] = payload.description;
  }
  if (productStatusValue === "1") {
    objectData["上架时间"] = Date.now();
  }

  const args = [
    fxiaokeTool,
    "create",
    "--object",
    "产品",
    "--object-data-json",
    JSON.stringify(objectData),
    "--config",
    fxiaokeConfig,
  ];

  const { stdout } = await execFileAsync("python3", args, {
    cwd: projectRoot,
    env: process.env,
    maxBuffer: 10 * 1024 * 1024,
  });
  const jsonStart = stdout.indexOf("{");
  if (jsonStart < 0) {
    throw new Error(`Create output did not contain JSON: ${stdout}`);
  }
  return JSON.parse(stdout.slice(jsonStart));
}

async function readSnapshot() {
  const text = await readFile(exportOutput, "utf-8");
  return JSON.parse(text);
}

async function readRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf-8");
  return text ? JSON.parse(text) : {};
}

function writeJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${host}:${port}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    writeJson(res, 200, {
      ok: true,
      service: "fxiaoke-bridge",
      lastRefreshAt: lastRefreshAt || null,
      ttlMs,
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/fxiaoke/products") {
    try {
      const forceRefresh = url.searchParams.get("refresh") === "1";
      if (forceRefresh) {
        lastRefreshAt = 0;
      }
      await refreshProducts();
      const snapshot = await readSnapshot();
      writeJson(res, 200, {
        mode: "live-bridge",
        bridgeHost: host,
        bridgePort: port,
        lastRefreshAt,
        ...snapshot,
      });
    } catch (error) {
      writeJson(res, 500, {
        error: "FXIAOKE_BRIDGE_FAILED",
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/fxiaoke/products") {
    try {
      const body = await readRequestBody(req);
      if (!body.modelCode || !body.modelName) {
        writeJson(res, 400, {
          error: "INVALID_INPUT",
          message: "modelCode and modelName are required",
        });
        return;
      }
      const result = await createProduct(body);
      lastRefreshAt = 0;
      await refreshProducts();
      const snapshot = await readSnapshot();
      writeJson(res, 200, {
        ok: true,
        mode: "live-bridge",
        createResult: result,
        bridgeHost: host,
        bridgePort: port,
        lastRefreshAt,
        ...snapshot,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      writeJson(res, 500, {
        error: "FXIAOKE_CREATE_FAILED",
        message,
        shortMessage: message.includes("字段[分类]项不存在")
          ? "纷享销客“分类”字段的选项值不匹配，请从下拉里选择已有分类后重试。"
          : message,
      });
    }
    return;
  }

  writeJson(res, 404, { error: "NOT_FOUND" });
});

server.listen(port, host, () => {
  console.log(`[fxiaoke-bridge] listening on http://${host}:${port}`);
});
