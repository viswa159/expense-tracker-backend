import cors from "cors";
import express from "express";
import { v4 as uuidv4 } from "uuid";
import { requireAllowedUser } from "./auth.js";
import { pool } from "./db.js";

const VALID_TRANSACTION_KINDS = new Set(["income", "expense"]);
const VALID_PAYMENT_METHODS = new Set(["bank", "credit"]);
const DEFAULT_ALLOWED_ORIGINS = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
]);

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function getAllowedOrigins() {
  const configuredOrigins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...configuredOrigins]);
}

function createCorsOptions() {
  const allowedOrigins = getAllowedOrigins();

  return {
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    allowedHeaders: ["Authorization", "Content-Type"],
    methods: ["GET", "POST", "PUT", "OPTIONS"],
  };
}

function validateTransactionPayload(body) {
  const date = typeof body.date === "string" ? body.date.trim() : "";
  const amount = Number(body.amount);
  const transactionKind = typeof body.transaction_kind === "string" ? body.transaction_kind.trim() : "";
  const paymentMethod = typeof body.payment_method === "string" ? body.payment_method.trim() : "";
  const categoryId = typeof body.category_id === "string" ? body.category_id.trim() : "";
  const description =
    typeof body.description === "string" && body.description.trim().length > 0
      ? body.description.trim()
      : null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { error: "date must be in YYYY-MM-DD format" };
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "amount must be a positive number" };
  }

  if (!VALID_TRANSACTION_KINDS.has(transactionKind)) {
    return { error: "transaction_kind must be income or expense" };
  }

  if (!VALID_PAYMENT_METHODS.has(paymentMethod)) {
    return { error: "payment_method must be bank or credit" };
  }

  if (!categoryId) {
    return { error: "category_id is required" };
  }

  return {
    value: {
      date,
      amount,
      transaction_kind: transactionKind,
      payment_method: paymentMethod,
      category_id: categoryId,
      description,
    },
  };
}

export function createApp() {
  const app = express();

  app.use(cors(createCorsOptions()));
  app.use(express.json());

  app.get("/healthz", (req, res) => {
    res.json({ ok: true });
  });

  app.use("/api", requireAllowedUser);

  app.get(
    "/api/categories",
    asyncHandler(async (req, res) => {
      const { rows } = await pool.query("SELECT id, name FROM categories ORDER BY name");
      res.json(rows);
    })
  );

  app.get(
    "/api/transactions",
    asyncHandler(async (req, res) => {
      const requestedMonth = Number(req.query.month);
      const requestedYear = Number(req.query.year);

      let query = `SELECT t.id, to_char(t.date, 'YYYY-MM-DD') AS date, t.amount, t.transaction_kind,
                        t.payment_method, t.category_id, t.description
                   FROM trans t`;
      const params = [];

      if (
        Number.isInteger(requestedMonth) &&
        Number.isInteger(requestedYear) &&
        requestedMonth >= 1 &&
        requestedMonth <= 12
      ) {
        const startDate = `${requestedYear}-${String(requestedMonth).padStart(2, "0")}-01`;
        const nextYear = requestedMonth === 12 ? requestedYear + 1 : requestedYear;
        const nextMonth = requestedMonth === 12 ? 1 : requestedMonth + 1;
        const endDate = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

        query += " WHERE t.date >= $1 AND t.date < $2";
        params.push(startDate, endDate);
      }

      query += " ORDER BY t.date DESC, t.created_at DESC";

      const { rows } = await pool.query(query, params);
      res.json(rows);
    })
  );

  app.get(
    "/api/balances",
    asyncHandler(async (req, res) => {
      const { rows } = await pool.query(
        `SELECT
           COALESCE(SUM(CASE WHEN transaction_kind = 'income' THEN amount ELSE 0 END), 0)
           - COALESCE(SUM(CASE
               WHEN transaction_kind = 'expense' AND payment_method = 'bank' THEN amount
               ELSE 0
             END), 0) AS account_balance,
           COALESCE(SUM(CASE WHEN transaction_kind = 'income' THEN amount ELSE 0 END), 0)
           - COALESCE(SUM(CASE WHEN transaction_kind = 'expense' THEN amount ELSE 0 END), 0)
             AS net_balance
         FROM trans`
      );

      const accountBalance = Number(rows[0].account_balance);
      const netBalance = Number(rows[0].net_balance);
      if (!Number.isFinite(accountBalance) || !Number.isFinite(netBalance)) {
        res.status(500).json({ error: "Unable to calculate balances" });
        return;
      }

      res.json({ accountBalance, netBalance });
    })
  );

  app.post(
    "/api/transactions",
    asyncHandler(async (req, res) => {
      const parsedPayload = validateTransactionPayload(req.body);
      if (parsedPayload.error) {
        res.status(400).json({ error: parsedPayload.error });
        return;
      }

      const id = uuidv4();

      const { rows } = await pool.query(
        `INSERT INTO trans (id, date, amount, transaction_kind, payment_method, category_id, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, to_char(date, 'YYYY-MM-DD') AS date, amount, transaction_kind,
                   payment_method, category_id, description`,
        [
          id,
          parsedPayload.value.date,
          parsedPayload.value.amount,
          parsedPayload.value.transaction_kind,
          parsedPayload.value.payment_method,
          parsedPayload.value.category_id,
          parsedPayload.value.description,
        ]
      );

      res.status(201).json(rows[0]);
    })
  );

  app.put(
    "/api/transactions/:id",
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const parsedPayload = validateTransactionPayload(req.body);
      if (parsedPayload.error) {
        res.status(400).json({ error: parsedPayload.error });
        return;
      }

      const { rows } = await pool.query(
        `UPDATE trans
         SET date = $1, amount = $2, transaction_kind = $3,
             payment_method = $4, category_id = $5, description = $6
         WHERE id = $7
         RETURNING id, to_char(date, 'YYYY-MM-DD') AS date, amount, transaction_kind,
                   payment_method, category_id, description`,
        [
          parsedPayload.value.date,
          parsedPayload.value.amount,
          parsedPayload.value.transaction_kind,
          parsedPayload.value.payment_method,
          parsedPayload.value.category_id,
          parsedPayload.value.description,
          id,
        ]
      );

      if (rows.length === 0) {
        res.status(404).json({ error: "Transaction not found" });
        return;
      }

      res.json(rows[0]);
    })
  );

  app.use((error, req, res, next) => {
    console.error(error);

    if (res.headersSent) {
      next(error);
      return;
    }

    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}

export const app = createApp();
