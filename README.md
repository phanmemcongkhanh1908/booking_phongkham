# Dental Smart Booking

A full-stack clinic management and booking system using React, Vite, Node.js, Express, and PostgreSQL (Drizzle ORM).

## Features
- Public Booking Flow with real-time slot holding
- Admin Dashboard to manage appointments, patients, and services
- Automated notifications via Web Push, Telegram, and Email
- Patient records and document management (PDF/PNG upload)

## Requirements
- Node.js 22+
- PostgreSQL 15+

## Quick Start (Docker)
1. Clone the repository
2. Edit \`docker-compose.yml\` or set environment variables in a \`.env\` file.
3. Run \`docker-compose up -d --build\`
4. Access the app at \`http://localhost\`

## Local Development
1. Install dependencies:
   \`npm install\`
2. Set up the database (requires a running PostgreSQL instance):
   Create a \`.env\` file based on \`.env.example\`
3. Push the database schema:
   \`npm run db:push\`
4. Start the development server:
   \`npm run dev\`

## Production Build
To build the application for production:
\`npm run build\`

Start the compiled server:
\`npm start\`
