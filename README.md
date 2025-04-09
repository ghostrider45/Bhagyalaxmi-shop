# Bhagyalaxmi Shop Management System

A web-based inventory and invoice management system for Bhagyalaxmi Shop.

## Features

- Purchase invoice creation and management
- Item code management
- Serial number tracking for invoices
- Date formatting in DD/MM/YY format

## Deployment on Render

### Prerequisites

1. A Firebase project with Firestore database
2. Firebase service account credentials
3. A Render account

### Setup Firebase Service Account

1. Go to your Firebase project settings
2. Navigate to "Service accounts" tab
3. Click "Generate new private key"
4. Save the JSON file as `serviceAccountKey.json` in the project root directory

### Deploy to Render

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Configure the following settings:
   - **Name**: Your app name
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node index.js`
   - **Environment Variables**:
     - `PORT`: 10000 (or any port you prefer)
     - `NODE_ENV`: production

4. Click "Create Web Service"

### Important Notes

- Make sure to add `serviceAccountKey.json` to your `.gitignore` file to avoid exposing your credentials
- Use the `serviceAccountKey.example.json` as a template for your actual service account file
- The serial number for invoices is stored in the Firestore database and will not reset when the site is refreshed

## Local Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Create a `serviceAccountKey.json` file with your Firebase credentials
4. Start the development server: `npm run dev`

## License

ISC
