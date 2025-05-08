const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const moment = require('moment-timezone');
const colors = require('colors');
const fs = require('fs');

const client = new Client({
    restartOnAuthFail: true,
    puppeteer: {
        headless: true,
        args: [ '--no-sandbox', '--disable-setuid-sandbox' ]
    },
    webVersionCache: { 
        type: 'remote', 
        remotePath: "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html",
    },
    ffmpeg: './ffmpeg.exe',
    authStrategy: new LocalAuth({ clientId: "client" })
});
const config = require('./config/config.json');

client.on('qr', (qr) => {
    console.log(`[${moment().tz(config.timezone).format('HH:mm:ss')}] Scan the QR below : `);
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.clear();
    const consoleText = './config/console.txt';
    fs.readFile(consoleText, 'utf-8', (err, data) => {
        if (err) {
            console.log(`[${moment().tz(config.timezone).format('HH:mm:ss')}] Console Text not found!`.yellow);
            console.log(`[${moment().tz(config.timezone).format('HH:mm:ss')}] ${config.name} is Running!`.green);
        } else {
            console.log(data.green);
            console.log(`[${moment().tz(config.timezone).format('HH:mm:ss')}] ${config.name} is Running!`.green);
        }
    });
});

const reminders = new Map(); // Untuk menyimpan reminder aktif

// Fungsi parse waktu yang sudah diperbaiki
function parseTime(timeStr) {
    if (!timeStr) return null;
    
    let milliseconds = 0;
    const timeUnits = {
        's': { value: 1000, name: 'detik' },
        'm': { value: 60 * 1000, name: 'menit' },
        'h': { value: 60 * 60 * 1000, name: 'jam' },
        'd': { value: 24 * 60 * 60 * 1000, name: 'hari' }
    };

    const regex = /(\d+)([smhd])/g;
    let match;
    const timeTextParts = []; // Inisialisasi array untuk teks waktu
    
    while ((match = regex.exec(timeStr)) !== null) {
        const [_, value, unit] = match;
        const timeUnit = timeUnits[unit];
        if (!timeUnit) continue;
        
        milliseconds += parseInt(value) * timeUnit.value;
        timeTextParts.push(`${value} ${timeUnit.name}`);
    }

    if (milliseconds <= 0 || timeTextParts.length === 0) {
        return null;
    }

    return {
        durationMs: milliseconds,
        timeText: timeTextParts.join(' ')
    };
}

client.on('message', async (message) => {
    const isGroups = message.from.endsWith('@g.us');
    if ((isGroups && config.groups) || !isGroups) {

        const { prefix } = config;
                    // !test - cek apakah bot aktif
                if (message.body === `${config.prefix}test`) {
                return client.sendMessage(message.from, "*[✅]* Bot aktif dan siap digunakan!");
            }

            // !bot - list semua fitur
            if (message.body === `${config.prefix}bot`) {
                const fitur = `
            *[WhatsApp Bot]*
            
            📌 *${config.prefix}sticker* (caption/reply gambar/video)
            📌 *${config.prefix}image* (reply sticker)
            📌 *${config.prefix}change <nama> | <author>* (reply sticker)
            📌 *${config.prefix}tagall* (mention semua anggota grup)
            📌 *${config.prefix}test* (cek apakah bot aktif)
            📌 *${config.prefix}bot* (menampilkan daftar fitur ini)
            📌 *${config.prefix}quote* (menampilkan quote random)
            📌 *${config.prefix}remain <waktu> <pesan>* (set reminder)

            Credit:@DrelezTM
            Edited:@sankya
            
            `.trim();
                return client.sendMessage(message.from, fitur);
            }


        // Tag All
        if (message.body === `${config.prefix}tagall`) {
            if (!isGroups) return client.sendMessage(message.from, "*[❎]* Fitur ini hanya untuk grup!");
            
            const chat = await message.getChat();
            let mentions = [];
            let text = `📢 Mention All:\n`;

            for (let participant of chat.participants) {
                const contact = await client.getContactById(participant.id._serialized);
                mentions.push(contact);
                text += `@${contact.number} `;
            }

            chat.sendMessage(text, { mentions });
            return;
        }

        // Quote of the day
        if (message.body === `${config.prefix}quote`) {
            try {
                const data = fs.readFileSync('./config/quote.json', 'utf-8'); 
                const quotes = JSON.parse(data);
        
                const random = quotes[Math.floor(Math.random() * quotes.length)];
                const quoteText = `📜 *Quote Hari Ini:*\n\n"${random.quote}"\n\n– *${random.by}*`;
        
                client.sendMessage(message.from, quoteText);
            } catch (err) {
                console.error(err);
                client.sendMessage(message.from, "*[❎]* Gagal mengambil quote.");
            }
        }
        
        // Reminder
        if (message.body.startsWith(`${prefix}remain`)) {
            try {
                const args = message.body.slice(prefix.length + 7).trim().split(' ');
                if (args.length < 2) {
                    return client.sendMessage(message.from, 
                        `❌ Format salah! Contoh:\n` +
                        `• ${prefix}remain 5m mabar\n` +
                        `• ${prefix}remain 1h meeting @Teman`);
                }
        
                // Parse waktu
                const timeStr = args.shift().toLowerCase();
                const parsedTime = parseTime(timeStr);
                
                if (!parsedTime) {
                    return client.sendMessage(message.from, 
                        `❌ Format waktu salah! Gunakan:\n` +
                        `• angka + satuan (s/m/h/d)\n` +
                        `Contoh: 30s, 5m, 1h, 2d, 1h30m`);
                }
        
                const { durationMs, timeText } = parsedTime;
                let reminderMsg = args.join(' ');
                let mentions = [];
                let targetUser = message.from;
        
                // Cek mention
                if (message.mentionedIds && message.mentionedIds.length > 0) {
                    mentions = message.mentionedIds;
                    targetUser = mentions[0];
                }
        
                // Set reminder
                const reminderId = Date.now().toString();
                const reminderTime = Date.now() + durationMs;
        
                reminders.set(reminderId, {
                    chatId: targetUser,
                    message: reminderMsg,
                    time: reminderTime,
                    mentions: mentions,
                    sender: message.from
                });
        
                // Konfirmasi ke pengguna
                let replyText = `⏰ *Reminder Set!*\n` +
                               `⏱ Waktu: ${timeText}\n` +
                               `📝 Pesan: "${reminderMsg}"`;
        
                if (mentions.length > 0) {
                    const contact = await client.getContactById(targetUser);
                    replyText += `\n👤 Untuk: @${contact.number}`;
                }
        
                await client.sendMessage(message.from, replyText, {
                    mentions: mentions
                });
        
                // Set timeout
                setTimeout(async () => {
                    if (!reminders.has(reminderId)) return;
        
                    const reminder = reminders.get(reminderId);
                    let reminderText = `🔔 *REMINDER!*\n` +
                                      `📝 ${reminder.message}\n\n` +
                                      `_Dari: @${message.from.replace('@c.us', '')}_`;
        
                    try {
                        await client.sendMessage(reminder.chatId, reminderText, {
                            mentions: [reminder.sender, ...reminder.mentions]
                        });
                    } catch (err) {
                        console.error('Gagal mengirim reminder:', err);
                        if (reminder.chatId !== message.from) {
                            await client.sendMessage(message.from, 
                                `❌ Gagal mengirim reminder ke ${reminder.chatId}`);
                        }
                    }
        
                    reminders.delete(reminderId);
                }, durationMs);
        
            } catch (err) {
                console.error('Error dalam remain command:', err);
                client.sendMessage(message.from, '❌ Terjadi error saat memproses reminder');
            }
        }

        // Sticker from media with caption "!sticker"
        if (message.hasMedia && message.caption === `${prefix}sticker`) {
            if (config.log) console.log(`[${'!'.red}] ${message.from.replace("@c.us", "").yellow} created sticker`);
            client.sendMessage(message.from, "*[⏳]* Loading..");
            try {
                const media = await message.downloadMedia();
                await client.sendMessage(message.from, media, {
                    sendMediaAsSticker: true,
                    stickerName: config.name,
                    stickerAuthor: config.author
                });
                client.sendMessage(message.from, "*[✅]* Successfully!");
            } catch {
                client.sendMessage(message.from, "*[❎]* Failed!");
            }
        }

        // Sticker from replied media
        else if (message.body === `${prefix}sticker`) {
            const quotedMsg = await message.getQuotedMessage();
            if (message.hasQuotedMsg && quotedMsg.hasMedia) {
                if (config.log) console.log(`[${'!'.red}] ${message.from.replace("@c.us", "").yellow} created sticker`);
                client.sendMessage(message.from, "*[⏳]* Loading..");
                try {
                    const media = await quotedMsg.downloadMedia();
                    await client.sendMessage(message.from, media, {
                        sendMediaAsSticker: true,
                        stickerName: config.name,
                        stickerAuthor: config.author
                    });
                    client.sendMessage(message.from, "*[✅]* Successfully!");
                } catch {
                    client.sendMessage(message.from, "*[❎]* Failed!");
                }
            } else {
                client.sendMessage(message.from, "*[❎]* Reply Image First!");
            }
        }

        // Sticker to Image via reply only
        else if (message.body === `${prefix}image`) {
            const quotedMsg = await message.getQuotedMessage();
            if (message.hasQuotedMsg && quotedMsg.hasMedia) {
                if (config.log) console.log(`[${'!'.red}] ${message.from.replace("@c.us", "").yellow} convert sticker into image`);
                client.sendMessage(message.from, "*[⏳]* Loading..");
                try {
                    const media = await quotedMsg.downloadMedia();
                    await client.sendMessage(message.from, media);
                    client.sendMessage(message.from, "*[✅]* Successfully!");
                } catch {
                    client.sendMessage(message.from, "*[❎]* Failed!");
                }
            } else {
                client.sendMessage(message.from, "*[❎]* Reply Sticker First!");
            }
        }

        // Change sticker metadata via reply
        else if (message.body.startsWith(`${prefix}change`)) {
            const quotedMsg = await message.getQuotedMessage();
            if (message.body.includes('|') && message.hasQuotedMsg && quotedMsg.hasMedia) {
                if (config.log) console.log(`[${'!'.red}] ${message.from.replace("@c.us", "").yellow} change sticker metadata`);
                const [namePart, authorPart] = message.body.split('|');
                const name = namePart.replace(`${prefix}change`, '').trim();
                const author = authorPart.trim();

                client.sendMessage(message.from, "*[⏳]* Loading..");
                try {
                    const media = await quotedMsg.downloadMedia();
                    await client.sendMessage(message.from, media, {
                        sendMediaAsSticker: true,
                        stickerName: name,
                        stickerAuthor: author
                    });
                    client.sendMessage(message.from, "*[✅]* Successfully!");
                } catch {
                    client.sendMessage(message.from, "*[❎]* Failed!");
                }
            } else {
                client.sendMessage(message.from, `*[❎]* Format salah:\n*${prefix}change <name> | <author>* (reply sticker)`);
            }
        }

        // Mark chat as seen
        else {
            const chat = await client.getChatById(message.id.remote);
            await chat.sendSeen();
        }
    }
});

// --- Welcome & Goodbye Events (DILUAR event 'message') ---
client.on('group_join', async (notification) => {
    const chat = await notification.getChat();
    const contact = await notification.getContact();
    if (config.groups) {
        chat.sendMessage(`👋 Selamat datang @${contact.number} di *${chat.name}*!\nJangan lupa baca deskripsi grup ya 🙏`, {
            mentions: [contact]
        });
    }
});

client.on('group_leave', async (notification) => {
    const chat = await notification.getChat();
    const contact = await notification.getContact();
    if (config.groups) {
        chat.sendMessage(`👋 Selamat tinggal @${contact.number}, semoga sukses di perjalanan selanjutnya.`, {
            mentions: [contact]
        });
    }
});

client.initialize();
