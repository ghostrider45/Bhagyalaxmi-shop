const express = require('express');
const path = require('path');
const cors = require('cors');
const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase Admin SDK with service account file
try {
    const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT);

    // Initialize the app with admin credentials if not already initialized
    if (admin.apps.length === 0) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log('Firebase Admin SDK initialized successfully');
    }
} catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error);
    console.error('Please make sure you have a service_account_key.json file in your project root');
}

// Get Firestore database
const db = admin.firestore();

// Helper functions for Firestore operations
const FirestoreHelper = {
    // Collection reference
    collection: (collectionPath) => db.collection(collectionPath),

    // Document reference
    doc: (collectionPath, docId) => db.collection(collectionPath).doc(docId),

    // Get a document
    getDoc: async (docRef) => {
        const doc = await docRef.get();
        return {
            exists: () => doc.exists,
            data: () => doc.data(),
            id: doc.id
        };
    },

    // Add a document to a collection
    addDoc: async (collectionRef, data) => {
        const docRef = await collectionRef.add(data);
        return { id: docRef.id };
    },

    // Update a document
    updateDoc: async (docRef, data) => {
        await docRef.update(data);
    },

    // Set a document (create or overwrite)
    setDoc: async (docRef, data, options) => {
        if (options && options.merge) {
            await docRef.set(data, { merge: true });
        } else {
            await docRef.set(data);
        }
    },

    // Query a collection
    query: (collectionRef, ...queryConstraints) => {
        let query = collectionRef;

        for (const constraint of queryConstraints) {
            if (constraint.type === 'where') {
                query = query.where(constraint.field, constraint.operator, constraint.value);
            }
        }

        return query;
    },

    // Where clause for queries
    where: (field, operator, value) => ({
        type: 'where',
        field,
        operator,
        value
    }),

    // Get documents from a query
    getDocs: async (query) => {
        const snapshot = await query.get();
        return {
            empty: snapshot.empty,
            docs: snapshot.docs.map(doc => ({
                id: doc.id,
                data: () => doc.data(),
                exists: doc.exists
            }))
        };
    }
};

// Initialize Express
const server = express();
const port = process.env.PORT || 3001;

// Middleware
server.use(cors());
server.use(express.json());

// Extract Firestore helper functions
const { collection, doc, getDoc, addDoc, updateDoc, setDoc, query, where, getDocs } = FirestoreHelper;

// API Routes BEFORE static file serving
server.get('/api/invoices', async (req, res) => {
    console.log('Fetching unpaid invoices...');
    try {
        // Create query with filter for payment_status = "unpaid"
        const purchaseCollection = collection('purchase');
        const purchaseQuery = query(
            purchaseCollection,
            where('payment_status', '==', 'unpaid')
        );

        const snapshot = await getDocs(purchaseQuery);

        if (snapshot.empty) {
            console.log('No unpaid invoices found');
            return res.status(200).json({
                success: true,
                data: []
            });
        }

        const invoices = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        console.log(`Found ${invoices.length} unpaid invoices`);
        return res.status(200).json({
            success: true,
            data: invoices
        });

    } catch (error) {
        console.error('Error fetching unpaid invoices:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch unpaid invoices',
            error: error.message
        });
    }
});
// API Route to get the latest serial number
server.get('/api/latest-serial-number', async (req, res) => {
    try {
        // Reference to the counters collection
        const counterRef = doc('counters', 'invoices');
        const counterSnap = await getDoc(counterRef);

        let nextSerialNumber = 1; // Default starting value

        if (counterSnap.exists()) {
            // If counter document exists, get the current value and add 1 for the next number
            nextSerialNumber = counterSnap.data().currentValue + 1;
        }

        return res.status(200).json({
            success: true,
            serialNumber: nextSerialNumber
        });
    } catch (error) {
        console.error('Error fetching latest serial number:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch latest serial number',
            error: error.message
        });
    }
});

// API Route to save invoice data
server.post('/api/invoices', async (req, res) => {
    const invoiceData = req.body; // Invoice data from the request body

    try {
        // Get the serial number from the request or use the counters collection
        let serialNumber;

        if (invoiceData.serialNumber) {
            // If client provided a serial number, use it
            serialNumber = parseInt(invoiceData.serialNumber);
        } else {
            // Otherwise get the next serial number from the counters collection
            const counterRef = doc('counters', 'invoices');
            const counterSnap = await getDoc(counterRef);

            serialNumber = 1; // Default starting value

            if (counterSnap.exists()) {
                // If counter document exists, get the current value
                serialNumber = counterSnap.data().currentValue + 1;
            }
        }

        // Update or create the counter document
        const counterRef = doc('counters', 'invoices');
        await setDoc(counterRef, { currentValue: serialNumber }, { merge: true });

        // Add serial number to invoice data
        invoiceData.serialNumber = serialNumber;

        // Reference to the 'purchase' collection
        const purchaseRef = collection('purchase');

        // Add a new document with the invoice data
        const docRef = await addDoc(purchaseRef, invoiceData);

        console.log(`Invoice saved with ID: ${docRef.id} and Serial Number: ${serialNumber}`);

        // Send a success response
        return res.status(201).json({
            success: true,
            message: 'Invoice saved successfully!',
            data: {
                id: docRef.id,
                serialNumber: serialNumber
            }
        });

    } catch (error) {
        console.error('Error saving invoice:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to save invoice',
            error: error.message
        });
    }
});


// Serve static files from 'public' after API routes
server.use(express.static('public'));

// HTML routes AFTER API routes
server.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.get('/sales', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'sales.html'));
});

// API Route to handle payment status update
server.put('/api/invoices/:id/pay', async (req, res) => {
  const { id } = req.params;

  try {
      const invoiceRef = doc(db, 'purchase', id); // Reference the invoice document in Firestore
      const invoiceSnap = await getDoc(invoiceRef); // Use getDoc for a single document

      if (!invoiceSnap.exists()) {
          console.log(`Invoice with ID ${id} not found`);
          return res.status(404).json({ error: 'Invoice not found' });
      }

      // Log the document data before update
      console.log('Invoice data before update:', invoiceSnap.data());

      // Update payment status to 'paid'
      await updateDoc(invoiceRef, {
          payment_status: 'paid'
      });

      console.log(`Invoice ${id} payment status updated to 'paid'`);

      return res.status(200).json({ message: 'Payment status updated successfully' });
  } catch (error) {
      console.error('Error updating payment status:', error.message);
      res.status(500).json({ error: 'Failed to update payment status', details: error.message });
  }
});
server.get('/api/invoices/party', async (req, res) => {
    try {
        const snapshot = await getDocs(query(collection(db, 'purchase')));

        const invoices = snapshot.docs.map(doc => {
            const data = doc.data();
            let formattedDate = 'N/A';

            console.log("Raw date from Firestore:", data.date); // Debug log

            if (data.date) {
                try {
                    if (typeof data.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
                        // Handle "YYYY-MM-DD" string format
                        formattedDate = new Date(data.date).toLocaleDateString('en-IN', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                        });
                    } else if (data.date.seconds) {
                        // Handle Firestore Timestamp
                        formattedDate = new Date(data.date.seconds * 1000).toLocaleDateString('en-IN', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                        });
                    } else {
                        console.warn(`Unexpected date format: ${data.date}`);
                    }
                } catch (err) {
                    console.error(`Date parsing error: ${err.message}`);
                }
            }

            return {
                party_name: data.customer_name || 'Unknown',
                date: formattedDate,
                amount: data.total_amount || 0,
                payment_status: data.payment_status || 'unpaid'
            };
        });

        return res.status(200).json({ success: true, data: invoices });

    } catch (error) {
        console.error(`Error fetching invoices`, error);
        return res.status(500).json({ success: false, message: 'Failed to fetch invoices' });
    }
});


// Start server
server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log('Available endpoints:');
    console.log('  GET  /api/invoices');
    console.log('  GET  /sales');
});
