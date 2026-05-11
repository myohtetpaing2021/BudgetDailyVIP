export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // 1. Webhook Setup Route (Browser မှ တိုက်ရိုက်ခေါ်ရန်)
        if (request.method === 'GET' && url.pathname === '/setup') {
            const webhookUrl = `https://${url.hostname}/webhook`;
            const response = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/setWebhook?url=${webhookUrl}`);
            const result = await response.json();
            return new Response(JSON.stringify(result), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 2. Incoming Webhook Updates (POST)
        if (request.method === 'POST' && url.pathname === '/webhook') {
            try {
                const update = await request.json();
                await handleUpdate(update, env);
            } catch (error) {
                console.error("Error processing update:", error);
            }
            return new Response('OK', { status: 200 });
        }

        return new Response('Budget Studio Bot is running on Cloudflare Workers.', { status: 200 });
    }
};

async function handleUpdate(update, env) {
    // A. Handle Admin Inline Keyboard Callbacks (Approve/Reject)
    if (update.callback_query) {
        return await handleCallback(update.callback_query, env);
    }

    const msg = update.message;
    if (!msg) return;

    const chatId = msg.chat.id;
    const text = msg.text || '';
    const username = msg.from.username || 'Unknown';

    // Fetch user from D1 Database
    let user = await env.DB.prepare("SELECT * FROM users WHERE chat_id = ?").bind(chatId).first();

    // /start Command Processing
    if (text === '/start') {
        if (!user) {
            await env.DB.prepare("INSERT INTO users (chat_id, username, status) VALUES (?, ?, 'pending')").bind(chatId, username).run();
            await sendMessage(env, chatId, "👋 Budget Studio မှ ကြိုဆိုပါတယ်။\n\nအသုံးပြုခွင့်ရရှိရန် Kpay (သို့) Wavepay ငွေလွှဲပြေစာ (Slip) သို့မဟုတ် TID ကို ဤနေရာသို့ ပေးပို့ပါ။");
        } else if (user.status === 'pending') {
            await sendMessage(env, chatId, "⏳ သင်၏အကောင့်သည် Admin ၏ အတည်ပြုချက်ကို စောင့်ဆိုင်းနေဆဲဖြစ်ပါသည်။ (Pending)");
        } else if (user.status === 'vip') {
            await sendMessage(env, chatId, "✅ သင်သည် VIP အသုံးပြုခွင့် ရရှိထားပါသည်။\n\nတွက်ချက်ရန် Command: \n`/calc [ဝင်ငွေ] [စုငွေရာခိုင်နှုန်း] [အသုံးစရိတ်]`\nဥပမာ - `/calc 100000 20 16000`", "Markdown");
        }
        return;
    }

    // Handle Client Sending Payment Slips (Photos or TIDs)
    if (user && user.status === 'pending') {
        if (msg.photo || text.length > 5) {
            // Notify Client
            await sendMessage(env, chatId, "✅ ငွေလွှဲမှတ်တမ်း လက်ခံရရှိပါသည်။ Admin မှ စစ်ဆေးပြီးပါက အကြောင်းကြားပေးပါမည်။");
            
            // Forward to Admin with Inline Keyboard
            const adminMsg = `🆕 သုံးစွဲသူအသစ်အတည်ပြုရန်\nUsername: @${username}\nChat ID: ${chatId}\nPayment Info ပေးပို့ထားပါသည်။`;
            const keyboard = {
                inline_keyboard: [[
                    { text: "✅ Approve (1 Month)", callback_data: `approve_${chatId}` },
                    { text: "❌ Reject", callback_data: `reject_${chatId}` }
                ]]
            };

            if (msg.photo) {
                const fileId = msg.photo[msg.photo.length - 1].file_id;
                await sendPhoto(env, env.ADMIN_ID, fileId, adminMsg, keyboard);
            } else {
                await sendMessage(env, env.ADMIN_ID, `${adminMsg}\nTID/Text: ${text}`, null, keyboard);
            }
        }
        return;
    }

    // ==========================================
    // VIP & ADMIN COMMANDS SECTION
    // ==========================================
    if (user && user.status === 'vip') {
        
        // 1. Budget Calculator Feature (/calc income percent expense)
        if (text.startsWith('/calc')) {
            const params = text.split(' ');
            if (params.length === 4) {
                const income = parseFloat(params[1]);
                const savingsPercent = parseFloat(params[2]);
                const expenses = parseFloat(params[3]);

                const savingsAmount = (income * savingsPercent) / 100;
                const stepA = savingsAmount + expenses;
                const stepB = income - stepA;
                const stepC = stepB / 4;
                const stepD = stepC / 7;

                // Output Format ပြင်ဆင်ခြင်း
                let resultMsg = `📊 Budget Studio Results 📊\n\n` +
                                `🔹 ဝင်ငွေ: ${income.toLocaleString()} ကျပ်\n` +
                                `🔹 စုငွေ (${savingsPercent}%): ${savingsAmount.toLocaleString()} ကျပ်\n` +
                                `🔹 အသုံးစရိတ်: ${expenses.toLocaleString()} ကျပ်\n\n` +
                                `တွက်ချက်မှု အဆင့်ဆင့်\n` +
                                `====================\n` +
                                `(A) စုငွေ + အသုံးစရိတ် = ${stepA.toLocaleString()} ကျပ်\n` +
                                `(B) လစဉ်လက်ကျန်သုံးငွေ = ${stepB.toLocaleString()} ကျပ်\n` +
                                `(C) တစ်ပတ်သုံးရမည့်ငွေ = ${stepC.toLocaleString()} ကျပ်\n` +
                                `(D) တစ်ရက်သုံးရမည့်ငွေ = ${stepD.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ကျပ်\n\n`;

                // အကြွေးဖြစ်နေပါက Alert ပြရန် သို့မဟုတ် ပုံမှန်အတိုင်းပြရန်
                if (stepB < 0) {
                    resultMsg += `⚠️ သတိပြုရန်! ဝင်ငွေထက် အသုံးစရိတ် ပိုများနေပါသည် (အကြွေး)\n` +
                                 `💰 ${Math.floor(stepD).toLocaleString()} ကျပ် 💰`;
                } else {
                    resultMsg += `✅ စုပြီး၊ ပေးပြီး တစ်ရက်လျှင် အပိုသုံးနိုင်သောငွေ\n` +
                                 `💰 ${Math.floor(stepD).toLocaleString()} ကျပ် 💰`;
                }
                
                // Markdown ဖယ်ပြီး ပုံမှန် Text အနေနဲ့ပို့ရန်
                await sendMessage(env, chatId, resultMsg);
            } else {
                await sendMessage(env, chatId, "⚠️ Format မှားယွင်းနေပါသည်။\nအသုံးပြုရန်: `/calc 100000 20 16000`", "Markdown");
            }
        }

        // ==========================================
        // ADMIN ONLY COMMANDS
        // ==========================================
        if (chatId.toString() === env.ADMIN_ID) {
            
            // Broadcast Message
            if (text.startsWith('/broadcast ')) {
                const broadcastMsg = text.replace('/broadcast ', '');
                const { results } = await env.DB.prepare("SELECT chat_id FROM users WHERE status = 'vip'").all();
                let count = 0;
                for (const row of results) {
                    await sendMessage(env, row.chat_id, `📢 *Admin Notification*\n\n${broadcastMsg}`, "Markdown");
                    count++;
                }
                await sendMessage(env, env.ADMIN_ID, `✅ သုံးစွဲသူ ${count} ဦးထံသို့ Message ပို့ပြီးပါပြီ။`);
            }

            // VIP List
            if (text === '/viplist') {
                const { results } = await env.DB.prepare("SELECT username, vip_expiry FROM users WHERE status = 'vip'").all();
                let listMsg = "📝 *VIP Members List*\n\n";
                results.forEach((u, index) => {
                    listMsg += `${index + 1}. @${u.username} (Exp: ${new Date(u.vip_expiry).toLocaleDateString()})\n`;
                });
                await sendMessage(env, env.ADMIN_ID, listMsg, "Markdown");
            }

            // Alert VIP (Expiry check logic)
            if (text === '/alertvip') {
                // Expiry သက်တမ်း ၃ ရက်အလို VIP များကို Alert လုပ်ရန် Query
                const { results } = await env.DB.prepare("SELECT chat_id, username, vip_expiry FROM users WHERE status = 'vip' AND vip_expiry <= datetime('now', '+3 days')").all();
                let count = 0;
                for (const row of results) {
                    await sendMessage(env, row.chat_id, "⚠️ *Subscription Alert*\n\nလူကြီးမင်း၏ VIP သက်တမ်းမှာ မကြာမီ ကုန်ဆုံးတော့မည်ဖြစ်ပါသည်။ ဆက်လက်အသုံးပြုရန် Kpay/Wavepay မှတစ်ဆင့် သက်တမ်းတိုးပေးပါ။", "Markdown");
                    count++;
                }
                await sendMessage(env, env.ADMIN_ID, `✅ သက်တမ်းကုန်ခါနီး VIP ${count} ဦးထံသို့ Alert ပို့ပြီးပါပြီ။`);
            }
        }
    }
}

// Handle Admin Approvals/Rejections
async function handleCallback(callbackQuery, env) {
    const data = callbackQuery.data;
    const adminChatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;

    if (data.startsWith('approve_')) {
        const targetId = data.split('_')[1];
        // 1 Month Expiry addition
        await env.DB.prepare("UPDATE users SET status = 'vip', vip_expiry = datetime('now', '+30 days') WHERE chat_id = ?").bind(targetId).run();
        
        await sendMessage(env, targetId, "🎉 ဂုဏ်ယူပါသည်။ Admin မှ အတည်ပြုပေးလိုက်ပြီဖြစ်၍ Budget Studio ကို စတင်အသုံးပြုနိုင်ပါပြီ။\n\nအသုံးပြုရန် Command: `/calc 100000 20 16000`", "Markdown");
        await editMessageText(env, adminChatId, messageId, `✅ Chat ID: ${targetId} ကို Approve လုပ်ပြီးပါပြီ။`);
    } 
    else if (data.startsWith('reject_')) {
        const targetId = data.split('_')[1];
        await env.DB.prepare("UPDATE users SET status = 'rejected' WHERE chat_id = ?").bind(targetId).run();
        
        await sendMessage(env, targetId, "❌ တောင်းပန်ပါသည်။ လူကြီးမင်း၏ ငွေလွှဲပြေစာကို အတည်ပြု၍မရပါ။ Kpay သို့မဟုတ် Wavepay မှတစ်ဆင့် ထပ်မံပေးပို့ပေးပါ။");
        await editMessageText(env, adminChatId, messageId, `❌ Chat ID: ${targetId} ကို Reject လုပ်ပြီးပါပြီ။`);
    }
}

// --- Telegram API Helper Functions ---
async function sendMessage(env, chatId, text, parseMode = null, replyMarkup = null) {
    const payload = { chat_id: chatId, text: text };
    if (parseMode) payload.parse_mode = parseMode;
    if (replyMarkup) payload.reply_markup = replyMarkup;

    await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
}

async function sendPhoto(env, chatId, photoId, caption, replyMarkup = null) {
    const payload = { chat_id: chatId, photo: photoId, caption: caption };
    if (replyMarkup) payload.reply_markup = replyMarkup;

    await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
}

async function editMessageText(env, chatId, messageId, newText) {
    await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId, text: newText })
    });
}
