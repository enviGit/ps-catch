# PSCatch

![psCatch](https://github.com/user-attachments/assets/4565663a-6a7f-4456-91e3-9c6280621a40)

PSCatch is a custom-built tool designed to catch the best digital PlayStation game deals across multiple global markets. Instead of manually checking prices in the US, UK, Europe, or Poland, this app aggregates them in one place, allowing for lightning-fast sorting and filtering.

🚀 **[Live Demo](https://envigit.github.io/ps-catch/)**

## ✨ Features

* **Multi-Region Tracking:** The backend scraper fetches prices in USD, GBP, EUR, and PLN, smartly linking them to a single, unified game entity using official Sony IDs.
* **Live Filtering:** Interactive sliders let you instantly filter the grid by maximum price or minimum discount percentage with zero lag.
* **User Accounts:** Secure, email-based authentication.
* **Private Wishlists:** Users can save their favorite titles. The backend recognizes wishlisted games and protects their price history from being wiped out during automated database cleanups when a sale ends.

## 🛠️ Tech Stack

* **Backend:** A custom Python scraper that queries public Sony GraphQL APIs and aggregates the data on a schedule.
* **Database:** Supabase (PostgreSQL) handling the core game catalog, user wishlists, and secure JWT authentication.
* **Frontend:** A snappy React application built with Vite, styled with Tailwind CSS, and featuring Lucide icons.
