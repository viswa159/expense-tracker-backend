import cors from "cors";
import express from "express";
import { v4 as uuidv4 } from "uuid";
import { requireAllowedUser } from "./auth.js";
import { supabase } from "./db.js";

const VALID_TRANSACTION_KINDS = new Set(["income", "expense"]);
const VALID_PAYMENT_METHODS = new Set(["bank", "credit"]);
const SUPABASE_PAGE_SIZE = 1000;
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

function createDatabaseError(error, fallbackMessage) {
  const message =
    typeof error?.message === "string" && error.message.trim() ? error.message : fallbackMessage;
  const databaseError = new Error(message);
  databaseError.cause = error;
  return databaseError;
}

async function fetchCategories() {
  const { data, error } = await supabase.from("categories").select("id, name").order("name");
  if (error) {
    throw createDatabaseError(error, "Unable to load categories");
  }

  return data;
}

async function fetchAllRows(buildQuery, fallbackMessage) {
  const rows = [];
  let from = 0;

  while (true) {
    const to = from + SUPABASE_PAGE_SIZE - 1;
    const { data, error } = await buildQuery(from, to);
    if (error) {
      throw createDatabaseError(error, fallbackMessage);
    }

    rows.push(...data);

    if (data.length < SUPABASE_PAGE_SIZE) {
      break;
    }

    from += SUPABASE_PAGE_SIZE;
  }

  return rows;
}

async function fetchTransactions({ requestedMonth, requestedYear }) {
  const hasMonthFilter =
    Number.isInteger(requestedMonth) &&
    Number.isInteger(requestedYear) &&
    requestedMonth >= 1 &&
    requestedMonth <= 12;
  const startDate = hasMonthFilter ? `${requestedYear}-${String(requestedMonth).padStart(2, "0")}-01` : null;
  const nextYear = hasMonthFilter && requestedMonth === 12 ? requestedYear + 1 : requestedYear;
  const nextMonth = hasMonthFilter ? (requestedMonth === 12 ? 1 : requestedMonth + 1) : null;
  const endDate = hasMonthFilter ? `${nextYear}-${String(nextMonth).padStart(2, "0")}-01` : null;

  const transactions = await fetchAllRows((from, to) => {
    let query = supabase
      .from("trans")
      .select("id, date, amount, transaction_kind, payment_method, category_id, description")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (hasMonthFilter) {
      query = query.gte("date", startDate).lt("date", endDate);
    }

    return query;
  }, "Unable to load transactions");

  return transactions.map((transaction) => ({
    ...transaction,
    date: typeof transaction.date === "string" ? transaction.date : String(transaction.date),
  }));
}

async function fetchBalances() {
  const data = await fetchAllRows(
    (from, to) =>
      supabase
        .from("trans")
        .select("amount, transaction_kind, payment_method")
        .order("id", { ascending: true })
        .range(from, to),
    "Unable to calculate balances"
  );

  return data.reduce(
    (balances, transaction) => {
      const amount = Number(transaction.amount);
      if (!Number.isFinite(amount)) {
        throw new Error("Balance response contains invalid values");
      }

      if (transaction.transaction_kind === "income") {
        balances.accountBalance += amount;
        balances.netBalance += amount;
        return balances;
      }

      if (transaction.transaction_kind === "expense") {
        balances.netBalance -= amount;
        if (transaction.payment_method === "bank") {
          balances.accountBalance -= amount;
        }
      }

      return balances;
    },
    { accountBalance: 0, netBalance: 0 }
  );
}

async function createTransaction(transaction) {
  const { data, error } = await supabase
    .from("trans")
    .insert(transaction)
    .select("id, date, amount, transaction_kind, payment_method, category_id, description")
    .single();

  if (error) {
    throw createDatabaseError(error, "Unable to create transaction");
  }

  return data;
}

async function updateTransaction(id, transaction) {
  const { data, error } = await supabase
    .from("trans")
    .update(transaction)
    .eq("id", id)
    .select("id, date, amount, transaction_kind, payment_method, category_id, description")
    .maybeSingle();

  if (error) {
    throw createDatabaseError(error, "Unable to update transaction");
  }

  return data;
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
      res.json(await fetchCategories());
    })
  );

  app.get(
    "/api/transactions",
    asyncHandler(async (req, res) => {
      const requestedMonth = Number(req.query.month);
      const requestedYear = Number(req.query.year);
      res.json(await fetchTransactions({ requestedMonth, requestedYear }));
    })
  );

  app.get(
    "/api/balances",
    asyncHandler(async (req, res) => {
      const { accountBalance, netBalance } = await fetchBalances();
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
      const transaction = await createTransaction({
        id,
        date: parsedPayload.value.date,
        amount: parsedPayload.value.amount,
        transaction_kind: parsedPayload.value.transaction_kind,
        payment_method: parsedPayload.value.payment_method,
        category_id: parsedPayload.value.category_id,
        description: parsedPayload.value.description,
      });

      res.status(201).json(transaction);
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

      const transaction = await updateTransaction(id, {
        date: parsedPayload.value.date,
        amount: parsedPayload.value.amount,
        transaction_kind: parsedPayload.value.transaction_kind,
        payment_method: parsedPayload.value.payment_method,
        category_id: parsedPayload.value.category_id,
        description: parsedPayload.value.description,
      });

      if (!transaction) {
        res.status(404).json({ error: "Transaction not found" });
        return;
      }

      res.json(transaction);
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
