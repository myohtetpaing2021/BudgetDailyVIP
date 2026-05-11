# 📊 Budget Studio Telegram Bot (Cloudflare Worker)

A serverless, high-performance Telegram Bot hosted on **Cloudflare Workers** with **D1 Database** integration. This bot helps users calculate their daily budget allowances and includes a built-in admin approval system with VIP subscription management.

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Cloudflare D1](https://img.shields.io/badge/Cloudflare-D1_SQL-0051C3?logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/d1/)
[![Telegram API](https://img.shields.io/badge/Telegram-Bot%20API-2CA5E0?logo=telegram&logoColor=white)](https://core.telegram.org/bots/api)

## ✨ Key Features

- **Serverless Architecture:** Runs entirely on Cloudflare Workers (Single-file deployment).
- **D1 Database Integration:** Stores user data, VIP status, and expiry dates using Cloudflare's native serverless SQL database.
- **Admin Approval System:** Users must submit payment slips (Kpay/Wavepay). Admins can approve or reject directly via Telegram Inline Buttons.
- **VIP Management:** Features to broadcast messages, view VIP lists, and auto-alert users whose subscriptions are expiring within 3 days.
- **Auto-Calculator:** Instantly calculates savings, expenses, and daily allowances based on a customized algorithm.

---

## 🛠️ Installation & Setup Guide

### Prerequisites
- A Cloudflare Account.
- A Telegram Bot Token (obtained from [@BotFather](https://t.me/BotFather)).
- Your Personal Telegram Chat ID (to set as `ADMIN_ID`).

### Step 1: Cloudflare Dashboard မှ Setup လုပ်ခြင်း (Web UI)

1. Database ဖန်တီးရန်:
   - Cloudflare Dashboard သို့ ဝင်ပါ။
   - ဘယ်ဘက် Menu မှ **Workers & Pages** > **D1 SQL Database** ကို ရွေးချယ်ပါ။
   - **Create Database** ကို နှိပ်ပြီး နာမည်တစ်ခု (ဥပမာ - `budget-bot-db`) ပေးကာ ဖန်တီးပါ။

2. SQL Run ရန်:
   - ဖန်တီးလိုက်သော **Database** အမည်ကို နှိပ်ပြီး ဝင်ပါ။
   - **Console tab** သို့ သွားပါ။
   - အထက်ပါ `CREATE TABLE users (...)` **SQL code** ကို **Box** ထဲတွင် **Paste** လုပ်ပြီး **Execute** ကို နှိပ်ပါ။ `Success` ဟု ပြပါမည်။
3. Worker နှင့် ချိတ်ဆက်ရန် (Bind လုပ်ရန်):
   - ဘယ်ဘက် Menu မှ **Workers & Pages** အောက်ရှိ သင့် **Worker Project** သို့ သွားပါ။
   - **Settings** > **Bindings** (ယခင် Variables & Secrets) သို့ သွားပါ။
   - **Add binding** ကို နှိပ်ပြီး **D1 database** ကို ရွေးချယ်ပါ။
   - **Variable name** တွင် `DB` ဟု ပေးပါ။
   - **D1 database dropdown** တွင် သင်ဖန်တီးခဲ့သော **Database** (`budget-bot-db`) ကို ရွေးချယ်ပြီး Deploy သို့မဟုတ် Save လုပ်ပါ။
     
ဤအဆင့်များ ပြီးဆုံးသွားပါက သင်၏ `worker.js` မှ `env.DB.prepare(...)` ဖြင့် ခေါ်ယူထားသော Code များသည် Database နှင့် ချိတ်ဆက်မိပြီး ကောင်းမွန်စွာ အလုပ်လုပ်မည်ဖြစ်ပါသည်။

4. Create a schema.sql file and execute it:
   ```bash
   CREATE TABLE users (
    chat_id INTEGER PRIMARY KEY,
    username TEXT,
    status TEXT DEFAULT 'pending',
    vip_expiry DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
   );


### Step 2: Deploy the Worker
First, create a D1 database and table for the bot.

1. Open your terminal and run: Create a new Cloudflare Worker (e.g., budget-studio-bot).
2. Copy the code from `worker.js` in this repository and deploy it.
  
### Step 3: Configure Bindings & Variables (Crucial)
Go to **Worker Settings** > **Variables**.
1. **Environment Variables**:
   
| Variable Name | Value |
| :--- | :--- |
| `BOT_TOKEN` | `YOUR_TELEGRAM_BOT_TOKEN_HERE` |
| `ADMIN_ID` | `YOUR_TELEGRAM_CHAT_ID` |

2. **D1 Database Binding**:
   
| Variable Name | Database |
| :--- | :--- |
| `DB` | `budget-bot-db` |
   
### Step 4: Set Webhook
Connect your Telegram Bot to the Cloudflare Worker by visiting the `/setup` route in your browser:

```
https://<YOUR_WORKER_URL>.workers.dev/setup
```

(You should see `{"ok":true,"result":true,"description":"Webhook was set"}`)

---

## 🎮 Usage Guide

## 🧑‍💻 Client Commands
- `/start` : Initialize the bot. (Prompts user to send a payment slip).

- Send Photo/Text : Sends the slip/TID to the Admin for approval.

- `/calc [income] [savings_percent] [expenses]` : (VIP Only) Calculates the budget.
  Example: `/calc 100000 20 16000`

## 🛡️ Admin Commands (Restricted to ADMIN_ID)
- Inline Buttons : `✅ Approve (1 Month)` or `❌ Reject` when a user sends a slip.

- `/viplist` : View all active VIP users and their expiry dates.

- `/broadcast [Message]` : Send an announcement to all VIP users.

- `/alertvip` : Automatically check and notify users whose VIP status will expire in ≤ 3 days.

---

## 📂 Project Structure

```
├── workers          # 🧠 Main Gateway Logic (Router)
├── schema.sql       # 🗄️ D1 Database Schema
└── README.md        # 📄 Documentation

```

## 🤝 Contributing

1. Fork the Project
2. Create your Feature Branch
3. Commit your Changes
4. Push to the Branch
5. Open a Pull Request

---

**Developed with ❤️ using Cloudflare Workers**

