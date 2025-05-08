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
            console.log(`[${moment().tz(config.timezone).format('HH:mm:ss')}] ${config.name} is Already!`.green);
        } else {
            console.log(data.green);
            console.log(`[${moment().tz(config.timezone).format('HH:mm:ss')}] ${config.name} is Already!`.green);
        }
    });
});

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
            *[Gafna pen berak]*
            
            📌 *${config.prefix}sticker* (caption/reply gambar/video)
            📌 *${config.prefix}image* (reply sticker)
            📌 *${config.prefix}change <nama> | <author>* (reply sticker)
            📌 *${config.prefix}tagall* (mention semua anggota grup)
            📌 *${config.prefix}test* (cek apakah bot aktif)
            📌 *${config.prefix}bot* (menampilkan daftar fitur ini)
            
            🟢 Bot akan otomatis memproses jika digunakan dengan benar. Pastikan reply atau caption digunakan sesuai fungsi.
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
