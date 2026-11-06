const express = require('express');
const app = express();

app.use(express.json());
app.use(express.static('public'));

// Mock middleware for authentication & role verification
function verifyToken(req, res, next) {
    // Halimbawa: Kunin ang role mula sa request headers o session/token
    const userRole = req.headers['x-user-role'] || 'user'; // default to 'user'
    req.user = { role: userRole };
    next();
}

// Middleware: Admin Only Check
function verifyAdmin(req, res, next) {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        return res.status(403).json({ 
            success: false, 
            message: "Access Denied: Admin privileges required to add records." 
        });
    }
}

// Sample Database/Records
let records = [
    { id: 1, title: "Sample Record 1", status: "Active" }
];

// GET: Lahat ng user (Admin man o Regular) ay makakakita ng records
app.get('/api/records', (req, res) => {
    res.json(records);
});

// POST: TANGING ADMIN LAMANG ang makakapag-add ng record
app.post('/api/records', verifyToken, verifyAdmin, (req, res) => {
    const { title, status } = req.body;
    const newRecord = {
        id: records.length + 1,
        title: title || `Record ${records.length + 1}`,
        status: status || "Pending"
    };
    records.push(newRecord);
    res.status(201).json({
        success: true,
        message: "Record successfully added by Admin!",
        data: newRecord
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
