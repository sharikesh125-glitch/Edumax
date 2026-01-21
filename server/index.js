import express from 'express';
import pg from 'pg';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Cloudinary Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// PostgreSQL Configuration (Neon)
const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Required for Neon/Heroku/Render
    }
});

pool.on('connect', () => {
    console.log('✅ Connected to Neon PostgreSQL');
});

pool.on('error', (err) => {
    console.error('❌ PostgreSQL Pool Error:', err);
});

// Create tables if they don't exist
const initDb = async () => {
    try {
        // Create PDFs table
        await pool.query(`
          CREATE TABLE IF NOT EXISTS pdfs (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            author TEXT DEFAULT 'Unknown',
            price NUMERIC DEFAULT 0,
            category TEXT NOT NULL,
            description TEXT,
            cloudinary_id TEXT NOT NULL,
            file_url TEXT NOT NULL,
            file_name TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            locked BOOLEAN DEFAULT TRUE
          );
        `);

        // Create Purchases table
        await pool.query(`
          CREATE TABLE IF NOT EXISTS purchases (
            id SERIAL PRIMARY KEY,
            user_email TEXT NOT NULL,
            pdf_id TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_email, pdf_id)
          );
        `);

        // Create Payment Requests table
        await pool.query(`
          CREATE TABLE IF NOT EXISTS payment_requests (
            id SERIAL PRIMARY KEY,
            user_email TEXT NOT NULL,
            user_name TEXT,
            pdf_id TEXT NOT NULL,
            pdf_title TEXT,
            utr_id TEXT NOT NULL,
            amount NUMERIC,
            status TEXT DEFAULT 'pending', -- pending, approved, rejected
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(utr_id)
          );
        `);

        console.log('📊 Database structure verified');
    } catch (err) {
        console.error('❌ Failed to initialize database:', err.message);
    }
};
initDb();

// Cloudinary Storage Engine for Multer
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'edumax_pdfs',
        format: async (req, file) => 'pdf', // force pdf
        public_id: (req, file) => `${Date.now()}-${file.originalname.replace(/\.[^/.]+$/, "")}`,
        resource_type: 'image',
        access_mode: 'authenticated'
    },
});

const upload = multer({ storage: storage });

// Routes

// @route POST /api/pdfs
// @desc  Upload PDF to Cloudinary and save metadata to Neon
app.post('/api/pdfs', upload.single('file'), async (req, res) => {
    console.log('⚡ Received upload request');

    try {
        if (!req.file) {
            console.error('❌ No file received in request');
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { title, author, price, category, description } = req.body;

        if (!title || !category) {
            console.error('❌ Missing required fields:', { title, category });
            return res.status(400).json({
                error: 'Title and Category are required',
                details: `Received: title="${title}", category="${category}"`
            });
        }

        const isLocked = (Number(price) || 0) > 0;

        const query = `
      INSERT INTO pdfs (title, author, price, category, description, cloudinary_id, file_url, file_name, locked)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

        const values = [
            title,
            author || 'Unknown',
            Number(price) || 0,
            category,
            description,
            req.file.filename, // This is the public_id in Cloudinary
            req.file.path,     // This is the secure_url
            req.file.originalname,
            isLocked
        ];

        const result = await pool.query(query, values);
        const savedPdf = result.rows[0];

        console.log(`✅ PDF Metadata saved: ${savedPdf.title}`);

        const responseData = {
            ...savedPdf,
            _id: savedPdf.id,
            fileId: savedPdf.id
        };

        res.status(201).json(responseData);

    } catch (err) {
        console.error('❌ Upload Workflow Failure:', err);
        res.status(500).json({
            error: 'Server failed to process upload',
            details: err.message || 'Unknown error during file processing'
        });
    }
});

// @route GET /api/pdfs
app.get('/api/pdfs', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM pdfs ORDER BY created_at DESC');
        const pdfs = result.rows.map(pdf => ({
            ...pdf,
            _id: pdf.id,
            fileId: pdf.id
        }));
        res.json(pdfs);
    } catch (err) {
        console.error('❌ GET Failed:', err);
        res.status(500).json({ error: 'Failed to fetch PDFs' });
    }
});

// @route GET /api/pdfs/file/:id
app.get('/api/pdfs/file/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const userEmail = req.query.email;

        // 1. Fetch PDF Metadata
        const pdfResult = await pool.query('SELECT * FROM pdfs WHERE id = $1', [id]);
        if (pdfResult.rows.length === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }
        const pdf = pdfResult.rows[0];

        // 2. Security Check: If it's a paid document, verify purchase
        if (pdf.price > 0) {
            if (!userEmail) {
                return res.status(403).json({ error: 'Authentication required for paid documents' });
            }

            const purchaseCheck = await pool.query(
                'SELECT * FROM purchases WHERE user_email = $1 AND pdf_id = $2',
                [userEmail, String(id)]
            );

            if (purchaseCheck.rows.length === 0) {
                return res.status(403).json({ error: 'Access denied: Payment not verified for this document' });
            }
        }

        // 3. Generate Secure Signed URL (Expires in 1 hour)
        // Note: For this to be fully secure, Cloudinary assets should be "private" or "authenticated"
        const signedUrl = cloudinary.url(pdf.cloudinary_id, {
            sign_url: true,
            resource_type: 'image',
            expires_at: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
        });

        console.log(`🔒 Secure access granted to ${userEmail || 'Anonymous'} for: ${pdf.title}`);
        res.redirect(signedUrl);

    } catch (err) {
        console.error('❌ Secure Stream Engine Error:', err);
        res.status(500).json({ error: 'Internal server error while securing document' });
    }
});

// @route DELETE /api/pdfs/:id
app.delete('/api/pdfs/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const result = await pool.query('SELECT cloudinary_id FROM pdfs WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'PDF not found' });
        }

        const cloudinaryId = result.rows[0].cloudinary_id;

        try {
            await cloudinary.uploader.destroy(cloudinaryId, { resource_type: 'image' });
        } catch (cloudinaryErr) {
            console.warn('⚠️ Cloudinary cleanup warning:', cloudinaryErr.message);
        }

        await pool.query('DELETE FROM pdfs WHERE id = $1', [id]);
        res.json({ message: 'PDF deleted successfully' });
    } catch (err) {
        console.error('❌ Delete failed:', err);
        res.status(500).json({ error: 'Failed to delete PDF' });
    }
});

// @route POST /api/purchases
app.post('/api/purchases', async (req, res) => {
    const { email, pdfId } = req.body;
    if (!email || !pdfId) return res.status(400).json({ error: 'Missing email or pdfId' });

    try {
        await pool.query(
            'INSERT INTO purchases (user_email, pdf_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [email, String(pdfId)]
        );
        res.status(201).json({ success: true });
    } catch (err) {
        console.error('❌ Purchase record failed:', err);
        res.status(500).json({ error: 'Failed to record purchase' });
    }
});

// @route GET /api/purchases/check
app.get('/api/purchases/check', async (req, res) => {
    const { email, pdfId } = req.query;
    if (!email || !pdfId) return res.status(400).json({ error: 'Missing email or pdfId' });

    try {
        const result = await pool.query(
            'SELECT * FROM purchases WHERE user_email = $1 AND pdf_id = $2',
            [email, String(pdfId)]
        );
        res.json({ purchased: result.rows.length > 0 });
    } catch (err) {
        res.status(500).json({ error: 'Check failed' });
    }
});

// @route POST /api/payment-requests
app.post('/api/payment-requests', async (req, res) => {
    console.log('💰 Received payment request:', req.body);
    const { email, name, pdfId, pdfTitle, utrId, amount } = req.body;
    if (!email || !pdfId || !utrId) return res.status(400).json({ error: 'Missing required fields' });

    try {
        await pool.query(
            'INSERT INTO payment_requests (user_email, user_name, pdf_id, pdf_title, utr_id, amount) VALUES ($1, $2, $3, $4, $5, $6)',
            [email, name, String(pdfId), pdfTitle, utrId, amount]
        );
        console.log('✅ Payment request saved successfully');
        res.status(201).json({ success: true, message: 'Payment request submitted for verification' });
    } catch (err) {
        console.error('❌ Payment request database error:', err);
        if (err.code === '23505') {
            return res.status(400).json({ error: 'This UTR/Transaction ID has already been submitted.' });
        }
        res.status(500).json({ error: 'Failed to submit payment request' });
    }
});

// @route GET /api/payment-requests/status
app.get('/api/payment-requests/status', async (req, res) => {
    const { email, pdfId } = req.query;
    try {
        const result = await pool.query(
            'SELECT status FROM payment_requests WHERE user_email = $1 AND pdf_id = $2 ORDER BY created_at DESC LIMIT 1',
            [email, String(pdfId)]
        );
        res.json({ status: result.rows.length > 0 ? result.rows[0].status : null });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch status' });
    }
});

// @route GET /api/admin/payment-requests
app.get('/api/admin/payment-requests', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM payment_requests ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch requests' });
    }
});

// @route POST /api/admin/approve-payment
app.post('/api/admin/approve-payment', async (req, res) => {
    const { requestId, email, pdfId } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Update request status
        await client.query('UPDATE payment_requests SET status = $1 WHERE id = $2', ['approved', requestId]);

        // 2. Add to purchases
        await client.query(
            'INSERT INTO purchases (user_email, pdf_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [email, String(pdfId)]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: 'Payment approved and document unlocked' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Approval failed:', err);
        res.status(500).json({ error: 'Approval failed' });
    } finally {
        client.release();
    }
});

// @route POST /api/admin/reject-payment
app.post('/api/admin/reject-payment', async (req, res) => {
    const { requestId } = req.body;
    try {
        await pool.query('UPDATE payment_requests SET status = $1 WHERE id = $2', ['rejected', requestId]);
        res.json({ success: true, message: 'Payment rejected' });
    } catch (err) {
        res.status(500).json({ error: 'Rejection failed' });
    }
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('🔥 GLOBAL SERVER ERROR:', err);
    res.status(500).json({
        error: 'An internal server error occurred',
        details: err.message
    });
});

app.listen(PORT, () => console.log(`🚀 Server active on port ${PORT}`));
