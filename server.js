
"use strict";

require("dotenv").config();

const path = require("path");
const dns = require("dns");
const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const bcrypt = require("bcryptjs");
const { MongoClient, ObjectId } = require("mongodb");
const OpenAI = require("openai");

// Prefer IPv4
dns.setDefaultResultOrder("ipv4first");

const app = express();

const PORT = process.env.PORT || 3000;
const SESSION_MAX_AGE = 8 * 60 * 60 * 1000;

let records;
let users;
let mongoClient;
let openai = null;

// Production settings
if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
}

// Middleware
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true }));

// Session configuration
if (
    process.env.NODE_ENV === "production" &&
    !process.env.SESSION_SECRET
) {
    throw new Error("SESSION_SECRET is required in production.");
}

// Store sessions in MongoDB instead of Express's in-memory store.
// MONGODB_URI is required for the real application; the same database is used
// for sessions and records, in separate collections.
if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required. Configure it in your environment.");
}

const sessionStore = MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    dbName: process.env.DB_NAME || "church_records",
    collectionName: "sessions",
    ttl: Math.floor(SESSION_MAX_AGE / 1000),
    autoRemove: "native"
});

app.use(
    session({
        name: "baptism.sid",
        secret:
            process.env.SESSION_SECRET ||
            "local-development-secret-change-me",
        store: sessionStore,
        resave: false,
        saveUninitialized: false,
        rolling: true,
        cookie: {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            maxAge: SESSION_MAX_AGE
        }
    })
);

// Serve frontend files
app.use(express.static(path.join(__dirname, "public")));

// Clean input
function clean(value, maxLength = 120) {
    return String(value ?? "").trim().slice(0, maxLength);
}

// Authentication middleware
function signedIn(req, res, next) {
    if (!req.session || req.session.authenticated !== true) {
        return res.status(401).json({
            error: "Your session has expired. Please sign in again."
        });
    }

    next();
}

// Admin permission middleware
function adminOnly(req, res, next) {
    if (!req.session || req.session.authenticated !== true) {
        return res.status(401).json({
            error: "Please sign in to continue."
        });
    }

    if (req.session.role !== "admin") {
        return res.status(403).json({
            error: "Administrator access is required for this action."
        });
    }

    next();
}

// Create login session
function createSession(req, res, user, role) {
    req.session.regenerate((error) => {
        if (error) {
            console.error("Session creation error:", error);

            return res.status(500).json({
                error: "Unable to create a login session."
            });
        }

        req.session.authenticated = true;
        req.session.role = role;
        req.session.user = user;

        req.session.save((saveError) => {
            if (saveError) {
                console.error("Session save error:", saveError);

                return res.status(500).json({
                    error: "Unable to save the login session."
                });
            }

            return res.json({
                ok: true,
                user,
                role
            });
        });
    });
}

// Private admin sign-in page
app.get("/admin-portal", (req, res) => {
    res.set("Cache-Control", "no-store");
    res.set("X-Robots-Tag", "noindex, nofollow, noarchive");

    res.sendFile(
        path.join(__dirname, "private", "admin-login.html")
    );
});

// Health check
app.get("/api/health", (req, res) => {
    res.json({
        ok: true,
        database: Boolean(records)
    });
});

// ==========================================
// PUBLIC USER REGISTRATION
// ==========================================

app.post("/api/register", async (req, res) => {
    try {
        const name = clean(req.body.name, 100);
        const email = clean(req.body.email, 254).toLowerCase();
        const password = String(req.body.password ?? "");

        if (
            !name ||
            !email ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ) {
            return res.status(400).json({
                error: "Please enter a valid name and email address."
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                error: "Password must be at least 8 characters long."
            });
        }

        const existing = await users.findOne({ email });

        if (existing) {
            return res.status(409).json({
                error: "An account with this email already exists."
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const user = {
            name,
            email,
            passwordHash,
            role: "user",
            createdAt: new Date()
        };

        await users.insertOne(user);

        return res.status(201).json({
            ok: true,
            message: "Account created. You can now sign in."
        });

    } catch (error) {
        console.error("Registration error:", error);

        return res.status(500).json({
            error: "Unable to create your account. Please try again."
        });
    }
});

// ==========================================
// PUBLIC USER LOGIN
// ==========================================

app.post("/api/user/login", async (req, res) => {
    try {
        const email = clean(req.body.email, 254).toLowerCase();
        const password = String(req.body.password ?? "");

        const account = await users.findOne({ email });

        if (
            !account ||
            !(await bcrypt.compare(password, account.passwordHash))
        ) {
            return res.status(401).json({
                error: "Incorrect email or password."
            });
        }

        return createSession(
            req,
            res,
            {
                name: account.name,
                email: account.email
            },
            "user"
        );

    } catch (error) {
        console.error("User login error:", error);

        return res.status(500).json({
            error: "Login failed. Please try again."
        });
    }
});

// ==========================================
// PRIVATE ADMIN LOGIN
// ==========================================

app.post("/api/admin/login", async (req, res) => {
    try {
        const email = clean(req.body.email, 254).toLowerCase();

        // Do not trim the password.
        // Spaces and special characters may be part of it.
        const password = String(req.body.password ?? "");

        const adminEmail = String(
            process.env.ADMIN_EMAIL ?? ""
        ).trim().toLowerCase();

        // Prefer ADMIN_PASSWORD_HASH (bcrypt). ADMIN_PASSWORD remains supported
        // temporarily for existing deployments; migrate to the hash variable.
        const adminPasswordHash = String(
            process.env.ADMIN_PASSWORD_HASH ?? ""
        );
        const adminPassword = String(
            process.env.ADMIN_PASSWORD ?? ""
        );

        if (!adminEmail || (!adminPassword && !adminPasswordHash)) {
            console.error("Admin credentials are not configured.");

            return res.status(500).json({
                error: "Admin login is not configured."
            });
        }

        // Verify email
        const emailMatches = email === adminEmail;

        // Verify password
        let passwordMatches = false;

        if (adminPasswordHash) {
            passwordMatches = await bcrypt.compare(password, adminPasswordHash);
        } else if (/^\$2[aby]\$/.test(adminPassword)) {
            // Backward-compatible support if ADMIN_PASSWORD already contains a bcrypt hash.
            passwordMatches = await bcrypt.compare(password, adminPassword);
        } else if (process.env.NODE_ENV !== "production") {
            // Plain-text admin passwords are permitted only in local development.
            passwordMatches = Boolean(adminPassword) && password === adminPassword;
        }

        if (!emailMatches || !passwordMatches) {
            console.log("Admin login failed: Invalid credentials.");

            return res.status(401).json({
                error: "Incorrect administrator credentials."
            });
        }

        console.log("Administrator login successful.");

        return createSession(
            req,
            res,
            {
                name: "Administrator",
                email: adminEmail
            },
            "admin"
        );

    } catch (error) {
        console.error("Admin login error:", error);

        return res.status(500).json({
            error: "Admin login failed. Please try again."
        });
    }
});

// ==========================================
// CURRENT SESSION
// ==========================================

app.get("/api/me", (req, res) => {
    if (!req.session || req.session.authenticated !== true) {
        return res.json({
            authenticated: false
        });
    }

    return res.json({
        authenticated: true,
        role: req.session.role,
        user: req.session.user
    });
});

// ==========================================
// LOGOUT
// ==========================================

app.post("/api/logout", (req, res) => {
    if (!req.session) {
        res.clearCookie("baptism.sid");

        return res.json({ ok: true });
    }

    req.session.destroy((error) => {
        if (error) {
            console.error("Logout error:", error);

            return res.status(500).json({
                error: "Unable to log out."
            });
        }

        res.clearCookie("baptism.sid", {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production"
        });

        return res.json({ ok: true });
    });
});

// ==========================================
// GET BAPTISM RECORDS
// ==========================================

app.get("/api/records", signedIn, async (req, res) => {
    try {
        const q = clean(req.query.q, 100);

        const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

        const filter = q
            ? {
                $or: [
                    { firstName: { $regex: escaped, $options: "i" } },
                    { lastName: { $regex: escaped, $options: "i" } },
                    { fatherName: { $regex: escaped, $options: "i" } },
                    { motherName: { $regex: escaped, $options: "i" } },
                    { godfatherName: { $regex: escaped, $options: "i" } },
                    { godmotherName: { $regex: escaped, $options: "i" } },
                    { placeOfBirth: { $regex: escaped, $options: "i" } },
                    { parents: { $regex: escaped, $options: "i" } },
                    { church: { $regex: escaped, $options: "i" } },
                    { minister: { $regex: escaped, $options: "i" } },
                    { certificateNo: { $regex: escaped, $options: "i" } }
                ]
            }
            : {};

        const data = await records
            .find(filter)
            .sort({ baptismDate: -1, _id: -1 })
            .limit(500)
            .toArray();

        return res.json(data);

    } catch (error) {
        console.error("Get records error:", error);

        return res.status(500).json({
            error: "Unable to retrieve baptism records."
        });
    }
});

// ==========================================
// ADD BAPTISM RECORD
// ADMIN ONLY
// ==========================================

app.post("/api/records", adminOnly, async (req, res) => {
    try {
        const item = {
            firstName: clean(req.body.firstName),
            lastName: clean(req.body.lastName),
            birthDate: clean(req.body.birthDate, 20),
            placeOfBirth: clean(req.body.placeOfBirth, 180),
            gender: clean(req.body.gender, 20),
            fatherName: clean(req.body.fatherName, 120),
            motherName: clean(req.body.motherName, 120),
            godfatherName: clean(req.body.godfatherName, 120),
            godmotherName: clean(req.body.godmotherName, 120),
            baptismDate: clean(req.body.baptismDate, 20),
            parents: clean(req.body.parents, 220),
            minister: clean(req.body.minister),
            church: clean(req.body.church),
            certificateNo: clean(req.body.certificateNo, 80),
            notes: clean(req.body.notes, 1000),
            createdAt: new Date(),
            updatedAt: new Date()
        };

        if (
            !item.firstName ||
            !item.lastName ||
            !item.baptismDate
        ) {
            return res.status(400).json({
                error: "First name, last name, and baptism date are required."
            });
        }

        const result = await records.insertOne(item);

        return res.status(201).json({
            ...item,
            _id: result.insertedId
        });

    } catch (error) {
        console.error("Add record error:", error);

        return res.status(500).json({
            error: "Unable to save the baptism record."
        });
    }
});

// ==========================================
// UPDATE BAPTISM RECORD
// ADMIN ONLY
// ==========================================

app.put("/api/records/:id", adminOnly, async (req, res) => {
    try {
        if (!ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                error: "Invalid record ID."
            });
        }

        const update = {
            firstName: clean(req.body.firstName),
            lastName: clean(req.body.lastName),
            birthDate: clean(req.body.birthDate, 20),
            placeOfBirth: clean(req.body.placeOfBirth, 180),
            gender: clean(req.body.gender, 20),
            fatherName: clean(req.body.fatherName, 120),
            motherName: clean(req.body.motherName, 120),
            godfatherName: clean(req.body.godfatherName, 120),
            godmotherName: clean(req.body.godmotherName, 120),
            baptismDate: clean(req.body.baptismDate, 20),
            parents: clean(req.body.parents, 220),
            minister: clean(req.body.minister),
            church: clean(req.body.church),
            certificateNo: clean(req.body.certificateNo, 80),
            notes: clean(req.body.notes, 1000),
            updatedAt: new Date()
        };

        if (
            !update.firstName ||
            !update.lastName ||
            !update.baptismDate
        ) {
            return res.status(400).json({
                error: "First name, last name, and baptism date are required."
            });
        }

        const result = await records.updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: update }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({
                error: "Record not found."
            });
        }

        return res.json({ ok: true });

    } catch (error) {
        console.error("Update record error:", error);

        return res.status(500).json({
            error: "Unable to update the baptism record."
        });
    }
});

// ==========================================
// DELETE BAPTISM RECORD
// ADMIN ONLY
// ==========================================

app.delete("/api/records/:id", adminOnly, async (req, res) => {
    try {
        if (!ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                error: "Invalid record ID."
            });
        }

        const result = await records.deleteOne({
            _id: new ObjectId(req.params.id)
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({
                error: "Record not found."
            });
        }

        return res.json({ ok: true });

    } catch (error) {
        console.error("Delete record error:", error);

        return res.status(500).json({
            error: "Unable to delete the baptism record."
        });
    }
});


 // ==========================================
 // AI-ASSISTED REGISTRY SUMMARY
 // ADMIN ONLY
 // ==========================================

app.post("/api/ai-summary", adminOnly, async (req, res) => {
    let basicSummary = "No baptism records available.";

    try {
        const yearCounts = await records.aggregate([
            {
                $project: {
                    year: {
                        $substr: [
                            { $ifNull: ["$baptismDate", "Unknown"] },
                            0,
                            4
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: "$year",
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]).toArray();

        const total = await records.countDocuments({});

        const aggregate = Object.fromEntries(
            yearCounts.map(item => [
                item._id || "Unknown",
                item.count
            ])
        );

        basicSummary =
            `There are ${total} baptism record(s) in the registry. ` +
            "Records by year: " +
            (
                Object.entries(aggregate)
                    .map(([year, count]) => `${year}: ${count}`)
                    .join(", ") || "No records yet."
            );

        // Kung walang OpenAI API key, basic summary muna.
        if (!openai) {
            return res.json({ summary: basicSummary });
        }

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content:
                        "You are a church administrative assistant. " +
                        "Write a short, factual summary of aggregate " +
                        "baptism registry statistics. Do not include " +
                        "personal names or sensitive personal data."
                },
                {
                    role: "user",
                    content:
                        `Summarize these statistics: total records ${total}; ` +
                        `yearly counts ${JSON.stringify(aggregate)}.`
                }
            ],
            max_tokens: 180
        });

        return res.json({
            summary:
                response.choices?.[0]?.message?.content ||
                basicSummary
        });

    } catch (error) {
        console.error("AI summary error:", {
            message: error.message,
            status: error.status,
            code: error.code
        });

        // Ipakita pa rin ang basic summary kung pumalya ang AI.
        return res.json({
            summary:
                basicSummary +
                " (AI summary is temporarily unavailable.)"
        });
    }
});


// ==========================================
// START SERVER
// ==========================================

async function start() {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
        throw new Error(
            "MONGODB_URI is missing. Configure it in your .env file."
        );
    }

    if (
        !process.env.ADMIN_EMAIL ||
        (!process.env.ADMIN_PASSWORD && !process.env.ADMIN_PASSWORD_HASH)
    ) {
        throw new Error(
            "ADMIN_EMAIL and ADMIN_PASSWORD_HASH (recommended) or ADMIN_PASSWORD must be configured."
        );
    }

    if (
        process.env.NODE_ENV === "production" &&
        process.env.ADMIN_PASSWORD &&
        !process.env.ADMIN_PASSWORD_HASH &&
        !/^\\$2[aby]\\$/.test(process.env.ADMIN_PASSWORD)
    ) {
        throw new Error(
            "For production, set ADMIN_PASSWORD_HASH to a bcrypt hash instead of a plain-text ADMIN_PASSWORD."
        );
    }

    if (
        process.env.NODE_ENV === "production" &&
        !process.env.SESSION_SECRET
    ) {
        throw new Error(
            "SESSION_SECRET must be configured in production."
        );
    }

    // Connect to MongoDB Atlas
    mongoClient = new MongoClient(mongoUri, {
        serverSelectionTimeoutMS: 30000,
        connectTimeoutMS: 20000,
        socketTimeoutMS: 45000,
        retryReads: true,
        retryWrites: true
    });

    console.log("Connecting to MongoDB Atlas...");

    try {
        await mongoClient.connect();

        await mongoClient
            .db(process.env.DB_NAME || "church_records")
            .command({ ping: 1 });

        console.log("MongoDB connection and ping successful.");

    } catch (error) {
        console.error("MongoDB connection failed.");
        console.error("Error name:", error.name);
        console.error("Error code:", error.code || error.codeName || "N/A");
        console.error("Error message:", error.message);

        if (error.cause) {
            console.error(
                "Error cause:",
                error.cause.message || error.cause
            );
        }

        console.error(
            "Check MongoDB Atlas Network Access, database credentials, " +
            "and MONGODB_URI."
        );

        throw error;
    }

    const database = mongoClient.db(
        process.env.DB_NAME || "church_records"
    );

    records = database.collection("baptism_records");
    users = database.collection("system_users");

    await records.createIndex({ baptismDate: -1 });
    await users.createIndex({ email: 1 }, { unique: true });

    if (process.env.OPENAI_API_KEY) {
        openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        console.log("OpenAI integration enabled.");

    } else {
        console.log(
            "OpenAI API key not configured. Using basic summary."
        );
    }

    app.listen(PORT, () => {
        console.log(`Baptism records app running on port ${PORT}`);
        console.log("Database connected successfully.");
    });
}

// Handle startup errors
start().catch(async (error) => {
    console.error("Server startup error:", error.message);

    if (mongoClient) {
        await mongoClient.close().catch(() => {});
    }

    process.exit(1);
});

// Graceful shutdown
async function shutdown(signal) {
    console.log(`${signal} received. Shutting down...`);

    if (mongoClient) {
        await mongoClient.close().catch(console.error);
    }
    await sessionStore.close().catch(console.error);

    process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
