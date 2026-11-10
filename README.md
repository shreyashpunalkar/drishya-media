# Drishya Media — Visual Growth Studio & CRM Leads Engine

Modern, cyber-minimalist SMMA portfolio and CRM leads portal built for **Drishya Media**.

## Features
- **Cinematic Webstacked/Lyniq Aesthetic**: Premium typography (Manrope), 0-lag cursor tracking, page transition curtain, and interactive 3D product showcase.
- **Dynamic Pricing Engine**: 3 customizable INR packages (15k, 20k, 25k) and A La Carte Add-ons with instant price updates.
- **Production Arsenal Teaser**: Premiere Pro, CapCut, Canva, Figma, Lightroom.
- **Leads & Bookings CRM (`/admin`)**: Single-Email Role-Based Access Control (RBAC), leads table, follow-up notes, status tracking, and 1-click CSV export.
- **Backend & Native Database**: Node.js Express server running with built-in SQLite (`node:sqlite`).

## Tech Stack
- **Frontend**: HTML5, CSS3 (Custom variables, glassmorphism, 3D tilt, 120Hz RAF inertia), Vanilla JavaScript.
- **Backend**: Node.js (v22.5+) with Express.
- **Database**: Native SQLite (`node:sqlite`).

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Set your authorized admin email and security passcode.

### 3. Start the Server
```bash
npm start
```
- Public Portfolio: `http://localhost:8001/`
- Protected CRM: `http://localhost:8001/admin`

---
© 2026 Drishya Media. All rights reserved.
