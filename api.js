import { useCallback, useEffect, useRef, useState } from "react";

// Point this at your Express server. Put it in a .env file as
// VITE_API_URL=http://localhost:4000 and use import.meta.env.VITE_API_URL
// once you're ready — hardcoded here to keep the first setup simple.
const API_URL = "http://localhost:4000";

// How often to re-fetch for "realtime"-ish updates. Lower = fresher data,
// but more requests. 5s is a reasonable default for a personal tracker.
const POLL_INTERVAL_MS = 5000;

export function useTransactionsApi() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/transactions`);
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = await res.json();
      setTransactions(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + polling loop for near-real-time updates.
  useEffect(() => {
    fetchTransactions();
    pollRef.current = setInterval(fetchTransactions, POLL_INTERVAL_MS);
    return () => clearInterval(pollRef.current);
  }, [fetchTransactions]);

  const create = useCallback(async (payload) => {
    const res = await fetch(`${API_URL}/api/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Create failed: ${res.status}`);
    const record = await res.json();
    // Optimistically update immediately rather than waiting for the next poll.
    setTransactions((prev) => [record, ...prev]);
    return record;
  }, []);

  const update = useCallback(async (id, payload) => {
    const res = await fetch(`${API_URL}/api/transactions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Update failed: ${res.status}`);
    const record = await res.json();
    setTransactions((prev) => prev.map((t) => (t.id === id ? record : t)));
    return record;
  }, []);

  return { transactions, create, update, loading, error, refetch: fetchTransactions };
}
