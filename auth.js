import { getAuth } from "firebase-admin/auth";
import { getFirebaseAdminApp } from "./firebase-admin.js";

function getAllowedEmails() {
  return new Set(
    (process.env.ALLOWED_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

function getBearerToken(authorizationHeader = "") {
  return authorizationHeader.startsWith("Bearer ") ? authorizationHeader.slice(7) : "";
}

export async function requireAllowedUser(req, res, next) {
  const allowedEmails = getAllowedEmails();
  if (allowedEmails.size === 0) {
    res.status(500).json({ error: "Server allowlist is not configured" });
    return;
  }

  const token = getBearerToken(req.headers.authorization);
  if (!token) {
    res.status(401).json({ error: "Missing Firebase ID token" });
    return;
  }

  let decodedToken;
  try {
    decodedToken = await getAuth(getFirebaseAdminApp()).verifyIdToken(token);
  } catch (error) {
    if (error.code && String(error.code).startsWith("auth/")) {
      res.status(401).json({ error: "Invalid or expired Firebase ID token" });
      return;
    }

    next(error);
    return;
  }

  const email = typeof decodedToken.email === "string" ? decodedToken.email.trim().toLowerCase() : "";
  if (!email || decodedToken.email_verified !== true) {
    res.status(403).json({ error: "Verified Google email required" });
    return;
  }

  if (!allowedEmails.has(email)) {
    res.status(403).json({ error: "This account is not allowed" });
    return;
  }

  req.user = {
    uid: decodedToken.uid,
    email,
  };

  next();
}
