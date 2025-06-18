## ✅ MVP Plan – “Гоё пицца” 🍕
![image](https://github.com/user-attachments/assets/b0d67cbe-22b6-4923-bc1b-797fcac1f4b2)
![image](https://github.com/user-attachments/assets/39053e1b-4006-4885-a23c-6377c9729a6d)
![image](https://github.com/user-attachments/assets/c182e932-ab64-4ca5-9c31-680390eed9b2)
![image](https://github.com/user-attachments/assets/fc5e167e-c075-4acf-8bf5-79d3399b28ce)
![image](https://github.com/user-attachments/assets/ded8e1d3-53fb-433c-9392-bd7fdec9fcc9)
![image](https://github.com/user-attachments/assets/bffc2fcf-9f5b-42f0-acf2-59583baa8cf1)






| Feature              | Description                                                      |
| -------------------- | ---------------------------------------------------------------- |
| 👴 Target Audience   | Local buildings (mostly elderly)                                 |
| 📱 Responsive Design | ✅ Mobile-first via Tailwind                                      |
| 🌐 Tech Stack        | Next.js + Tailwind + Supabase (DB + Auth + Realtime)             |
| 📦 Focus             | Simple pizza ordering, fast delivery flow                        |
| 🧾 Login             | ❌ No login for customers, ✅ Delivery/Admin login (Supabase Auth) |
| 🔁 Realtime Updates  | ✅ For delivery dashboard + admin stats + order status            |
| 💳 Payment           | ✅ QPay integration or “Pay with cash”                            |
| 🏠 Address Input     | Building (select) + floor + door + phone                         |
| 🧍 Tracking Orders   | ✅ By phone number, no SMS needed                                 |
| 📥 Save Info Locally | ✅ `localStorage` remembers inputs                                |
| 💬 Notification      | ✅ Supabase Realtime for delivery workers                         |
| 🚶 Delivery Type     | Local walk-only delivery (no car/bike)                           |

---

## 🗃️ Supabase Database Schema

### 1. `orders`

| Field          | Type      | Description                                               |
| -------------- | --------- | --------------------------------------------------------- |
| `id`           | UUID      | Primary key                                               |
| `pizza_items`  | JSONB     | `[{ pizza_id: 1, quantity: 2 }]`                          |
| `total_price`  | Integer   | Total in MNT                                              |
| `building`     | Text      | From dropdown                                             |
| `floor`        | Integer   | Input                                                     |
| `door_number`  | Text      | Input                                                     |
| `phone`        | Text      | For tracking + delivery                                   |
| `payment_type` | Text      | `"qpay"` or `"cash"`                                      |
| `is_paid`      | Boolean   | Set to `true` after payment or selecting cash             |
| `status`       | Text      | `"pending"`, `"accepted"`, `"on_delivery"`, `"delivered"` |
| `created_at`   | Timestamp | Order time                                                |
| `delivered_at` | Timestamp | When status set to `delivered`                            |

### 2. `pizzas`

| Field       | Type    | Description                |
| ----------- | ------- | -------------------------- |
| `id`        | UUID    | Primary key                |
| `name`      | Text    | Pizza name in Mongolian    |
| `price`     | Integer | ₮                          |
| `image_url` | Text    | Stored in Supabase Storage |
| `is_active` | Boolean | Show/hide in menu          |

### 3. `users` (Supabase Auth)

| Field        | Type      | Description               |
| ------------ | --------- | ------------------------- |
| `id`         | UUID      | Supabase Auth user ID     |
| `role`       | Text      | `"admin"` or `"delivery"` |
| `created_at` | Timestamp | Metadata                  |

---

## 🔐 Role-Based Access Logic

### 👨‍🦯 Customer

* No login needed
* Can:

  * Browse pizzas
  * Place order
  * Track order by phone number

### 🚚 Delivery Worker

* Must login
* Sees only `paid` orders (via `is_paid = true`)
* Can:

  * View full order info:

    * Phone
    * Pizza items
    * Building, floor, door
    * Payment type
    * Time
  * Tap to call customer
  * Update order status:

    * `pending` → `on_delivery`
    * `on_delivery` → `delivered` (also sets `delivered_at`)

### 🧠 Admin

* Must login
* Can:

  * View all orders
  * Filter by status / date / payment type
  * View advanced stats (see below)

---

## 📊 Advanced Admin Dashboard

### 📈 Realtime Stats Cards

| Stat                         | Description                                             |
| ---------------------------- | ------------------------------------------------------- |
| 🧾 **Total Orders**          | All orders (regardless of status)                       |
| 💵 **Total Revenue**         | Sum of `total_price` where `is_paid = true`             |
| 📅 **Orders Today**          | Filter `created_at = today()`                           |
| 🕑 **Average Delivery Time** | Avg of `delivered_at - created_at` for delivered orders |
| 🏆 **Top Selling Pizzas**    | Group by `pizza_id`, sum quantity                       |
| 🏢 **Frequent Buildings**    | Group by `building`, count                              |
| 💸 **Cash vs QPay Split**    | Pie chart of payment types                              |

> Use Supabase `rpc` (PostgreSQL functions) or filtering via Supabase client.

---

## 🧩 Next.js Project Structure

```
/pages
  index.tsx            → Pizza menu
  cart.tsx             → Add-to-cart & order form
  track.tsx            → Track order by phone number
  login.tsx            → Login page
  /admin/index.tsx     → Admin dashboard (protected)
  /delivery/index.tsx  → Delivery dashboard (protected)

/components
  PizzaCard.tsx
  Cart.tsx
  OrderForm.tsx
  OrderTracker.tsx
  DeliveryTable.tsx
  AdminStats.tsx
  ProtectedRoute.tsx   → Checks Supabase role

/lib
  supabase.ts
  qpay.ts               → Mongolian QPay integration
  utils.ts              → Format price, time helpers

/public
  logo.png
  fallback.jpg
```

---

## 💳 Payment Flow

1. User chooses QPay → calls `/api/qpay` to get QR/payment link
2. Once payment is made, QPay sends webhook → Supabase updates `is_paid = true`
3. Order now visible on delivery dashboard
4. For `cash`, `is_paid = true` immediately after confirmation

---

## 🔁 Realtime Setup (Supabase)

```ts
supabase
  .channel("orders")
  .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, payload => {
    // Re-fetch orders for delivery or admin dashboards
  })
  .subscribe();
```

---

## 🧠 LocalStorage UX

```ts
// Save after order
localStorage.setItem("userInfo", JSON.stringify({
  building, floor, door_number, phone
}));

// On mount
const saved = JSON.parse(localStorage.getItem("userInfo") || "{}");
```

---

## ✅ Final MVP Checklist

| Feature                              | Done? |
| ------------------------------------ | :---: |
| No login for customers               |   ✅   |
| LocalStorage autofill                |   ✅   |
| Track order by phone number          |   ✅   |
| Only show `paid` orders to delivery  |   ✅   |
| Delivery sees full info + can update |   ✅   |
| Admin can view all orders            |   ✅   |
| Admin sees full stats + filters      |   ✅   |
| QPay & cash payment logic            |   ✅   |
| Minimal design, old people friendly  |   ✅   |
| Mongolian language                   |   ✅   |
| Realtime sync for admin + delivery   |   ✅   |

