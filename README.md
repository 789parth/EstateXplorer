# EstateXplorer

EstateXplorer is a full-stack real estate platform built with React, Vite, Express, and MongoDB. It supports property browsing, authentication, dashboards for buyers and builders, and property inquiry flows.

## Features

- Modern landing page and property listings
- User authentication with login, registration, forgot/reset password, and Google sign-in
- Separate buyer and builder dashboards
- Property detail pages and inquiry handling
- Responsive UI with Tailwind CSS

## Tech Stack

### Frontend
- React
- Vite
- Tailwind CSS
- React Router
- Framer Motion

### Backend
- Node.js
- Express.js
- MongoDB with Mongoose
- JWT authentication
- Nodemailer for email notifications

## Project Structure

- client/ - React frontend application
- server/ - Express backend API
- README.md - Project documentation

## Getting Started

### Prerequisites

- Node.js 18 or newer
- npm or yarn
- MongoDB instance

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd EstateXplorer
```

### 2. Install dependencies

#### Frontend
```bash
cd client
npm install
```

#### Backend
```bash
cd ../server
npm install
```

### 3. Environment variables

Create a `.env` file in the `server` folder with the following variables:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
CLIENT_URL=http://localhost:5173
JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_email@example.com
SMTP_PASS=your_email_password
EMAIL_FROM=EstateXplorer <your_email@example.com>
GOOGLE_CLIENT_ID=your_google_client_id
```

### 4. Run the application

#### Start the backend
```bash
cd server
npm run dev
```

#### Start the frontend
```bash
cd ../client
npm run dev
```

The frontend will run at `http://localhost:5173` and the backend at `http://localhost:5000`.

## Scripts

### Frontend
- `npm run dev` - Start the Vite development server
- `npm run build` - Build the production bundle

### Backend
- `npm run dev` - Start the server with nodemon
- `npm run start` - Start the server in production mode

## Notes

- Make sure your MongoDB connection is available before starting the backend.
- For Gmail or SMTP-based email delivery, configure the SMTP values in the server environment file.
- Google authentication requires a valid `GOOGLE_CLIENT_ID` and the corresponding setup in Google Cloud Console.

## License

This project is licensed under the MIT License.
