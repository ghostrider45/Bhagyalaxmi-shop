const admin = require('firebase-admin');
const serviceAccount = require('./path/to/serviceAccountKey.json'); // Update the path

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://your-firebase-project-id.firebaseio.com' // Replace with your Firebase project URL
});

// Set custom claims for the admin user
const setAdminClaim = async (uid) => {
  try {
    await admin.auth().setCustomUserClaims(uid, { admin: true });
    console.log(`Admin claim set for user ${uid}`);
  } catch (error) {
    console.error('Error setting admin claim:', error);
  }
};

// Replace with your Firebase UID
const adminUid = process.env.FIREBASE_ADMIN_UID; // Replace with your Firebase UID
setAdminClaim(adminUid);

module.exports = admin;