const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const moment = require("moment-timezone");
const colors = require("colors");
const fs = require("fs");

const client = new Client({
  restartOnAuthFail: true,
  puppeteer: {
    headless: true,
    // Args tambahan untuk kestabilan di Docker/Linux
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu",
    ],
  },
  webVersionCache: {
    type: "remote",
    remotePath:
      "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html",
  },
  // PERBAIKAN: Gunakan 'ffmpeg' sistem, bukan file .exe lokal
  ffmpeg: "ffmpeg",
  authStrategy: new LocalAuth({ clientId: "client" }),
});

const config = require("./config/config.json");

client.on("qr", (qr) => {
  // Tampilkan log waktu
  console.log(
    `[${moment().tz(config.timezone).format("HH:mm:ss")}] QR Code received!`
  );

  // 1. Coba tampilkan QR Code standard (siapa tahu terbaca)
  qrcode.generate(qr, { small: true });

  // 2. Tampilkan String Mentah sebagai cadangan (Solusi Paling Aman)
  console.log(
    "\n=================================================================="
  );
  console.log("JIKA QR CODE DI ATAS RUSAK/BERANTAKAN, COPY KODE DI BAWAH INI:");
  console.log("Paste kode tersebut ke: https://www.qr-code-generator.com/");
  console.log(
    "=================================================================="
  );
  console.log(qr); // <--- Ini string mentahnya
  console.log(
    "==================================================================\n"
  );
});

client.on("ready", () => {
  console.clear();
  const consoleText = "./config/console.txt";
  // Cek file console.txt dengan error handling sederhana
  if (fs.existsSync(consoleText)) {
    fs.readFile(consoleText, "utf-8", (err, data) => {
      if (err) {
        console.log(
          `[${moment()
            .tz(config.timezone)
            .format("HH:mm:ss")}] Console Text Error!`.yellow
        );
      } else {
        console.log(data.green);
      }
      console.log(
        `[${moment().tz(config.timezone).format("HH:mm:ss")}] ${
          config.name
        } is Running!`.green
      );
    });
  } else {
    console.log(
      `[${moment().tz(config.timezone).format("HH:mm:ss")}] ${
        config.name
      } is Running!`.green
    );
  }
});

const reminders = new Map(); // Untuk menyimpan reminder aktif

// Fungsi parse waktu
function parseTime(timeStr) {
  if (!timeStr) return null;

  let milliseconds = 0;
  const timeUnits = {
    s: { value: 1000, name: "detik" },
    m: { value: 60 * 1000, name: "menit" },
    h: { value: 60 * 60 * 1000, name: "jam" },
    d: { value: 24 * 60 * 60 * 1000, name: "hari" },
  };

  const regex = /(\d+)([smhd])/g;
  let match;
  const timeTextParts = [];

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
    timeText: timeTextParts.join(" "),
  };
}

client.on("message", async (message) => {
  const isGroups = message.from.endsWith("@g.us");
  if ((isGroups && config.groups) || !isGroups) {
    const { prefix } = config;

    // !test - cek apakah bot aktif
    if (message.body === `${config.prefix}test`) {
      return client.sendMessage(
        message.from,
        "*[✅]* Bot aktif dan siap digunakan!"
      );
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
      if (!isGroups)
        return client.sendMessage(
          message.from,
          "*[❎]* Fitur ini hanya untuk grup!"
        );

      const chat = await message.getChat();
      let mentions = [];
      let text = `📢 Mention All:\n`;

      for (let participant of chat.participants) {
        // Mengambil contact bisa memakan waktu, hati-hati terkena rate limit jika grup sangat besar
        try {
          const contact = await client.getContactById(
            participant.id._serialized
          );
          mentions.push(contact);
          text += `@${contact.number} `;
        } catch (e) {
          // skip jika gagal fetch contact
        }
      }

      chat.sendMessage(text, { mentions });
      return;
    }

    // Quote of the day
    if (message.body === `${config.prefix}quote`) {
      try {
        // Pastikan path sesuai structure di Railway
        const data = fs.readFileSync("./config/quote.json", "utf-8");
        const quotes = JSON.parse(data);

        const random = quotes[Math.floor(Math.random() * quotes.length)];
        const quoteText = `qr📜 *Quote Hari Ini:*\n\n"${random.quote}"\n\n– *${random.by}*`;

        client.sendMessage(message.from, quoteText);
      } catch (err) {
        console.error(err);
        client.sendMessage(message.from, "*[❎]* Gagal mengambil quote.");
      }
    }

    // Reminder
    if (message.body.startsWith(`${prefix}remain`)) {
      try {
        const args = message.body
          .slice(prefix.length + 7)
          .trim()
          .split(" ");
        if (args.length < 2) {
          return client.sendMessage(
            message.from,
            `❌ Format salah! Contoh:\n` +
              `• ${prefix}remain 5m mabar\n` +
              `• ${prefix}remain 1h meeting @Teman`
          );
        }

        // Parse waktu
        const timeStr = args.shift().toLowerCase();
        const parsedTime = parseTime(timeStr);

        if (!parsedTime) {
          return client.sendMessage(
            message.from,
            `❌ Format waktu salah! Gunakan:\n` +
              `• angka + satuan (s/m/h/d)\n` +
              `Contoh: 30s, 5m, 1h, 2d, 1h30m`
          );
        }

        const { durationMs, timeText } = parsedTime;
        let reminderMsg = args.join(" ");
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
          sender: message.from,
        });

        // Konfirmasi ke pengguna
        let replyText =
          `⏰ *Reminder Set!*\n` +
          `⏱ Waktu: ${timeText}\n` +
          `📝 Pesan: "${reminderMsg}"`;

        if (mentions.length > 0) {
          try {
            const contact = await client.getContactById(targetUser);
            replyText += `\n👤 Untuk: @${contact.number}`;
          } catch (e) {}
        }

        await client.sendMessage(message.from, replyText, {
          mentions: mentions,
        });

        // Set timeout
        setTimeout(async () => {
          if (!reminders.has(reminderId)) return;

          const reminder = reminders.get(reminderId);
          let reminderText =
            `🔔 *REMINDER!*\n` +
            `📝 ${reminder.message}\n\n` +
            `_Dari: @${message.from.replace("@c.us", "")}_`;

          try {
            await client.sendMessage(reminder.chatId, reminderText, {
              mentions: [reminder.sender, ...reminder.mentions],
            });
          } catch (err) {
            console.error("Gagal mengirim reminder:", err);
            // Coba kirim balik ke pengirim jika gagal kirim ke target
            if (reminder.chatId !== message.from) {
              await client.sendMessage(
                message.from,
                `❌ Gagal mengirim reminder ke ${reminder.chatId}`
              );
            }
          }

          reminders.delete(reminderId);
        }, durationMs);
      } catch (err) {
        console.error("Error dalam remain command:", err);
        client.sendMessage(
          message.from,
          "❌ Terjadi error saat memproses reminder"
        );
      }
    }

    // Sticker from media with caption "!sticker"
    if (message.hasMedia && message.caption === `${prefix}sticker`) {
      if (config.log)
        console.log(
          `[${"!".red}] ${
            message.from.replace("@c.us", "").yellow
          } created sticker`
        );
      client.sendMessage(message.from, "*[⏳]* Loading..");
      try {
        const media = await message.downloadMedia();
        await client.sendMessage(message.from, media, {
          sendMediaAsSticker: true,
          stickerName: config.name,
          stickerAuthor: config.author,
        });
        client.sendMessage(message.from, "*[✅]* Successfully!");
      } catch (err) {
        console.error(err);
        client.sendMessage(message.from, "*[❎]* Failed! (Check logs)");
      }
    }

    // Sticker from replied media
    else if (message.body === `${prefix}sticker`) {
      const quotedMsg = await message.getQuotedMessage();
      if (message.hasQuotedMsg && quotedMsg.hasMedia) {
        if (config.log)
          console.log(
            `[${"!".red}] ${
              message.from.replace("@c.us", "").yellow
            } created sticker`
          );
        client.sendMessage(message.from, "*[⏳]* Loading..");
        try {
          const media = await quotedMsg.downloadMedia();
          await client.sendMessage(message.from, media, {
            sendMediaAsSticker: true,
            stickerName: config.name,
            stickerAuthor: config.author,
          });
          client.sendMessage(message.from, "*[✅]* Successfully!");
        } catch (err) {
          console.error(err);
          client.sendMessage(message.from, "*[❎]* Failed! (Check logs)");
        }
      } else {
        client.sendMessage(message.from, "*[❎]* Reply Image First!");
      }
    }

    // Sticker to Image via reply only
    else if (message.body === `${prefix}image`) {
      const quotedMsg = await message.getQuotedMessage();
      if (message.hasQuotedMsg && quotedMsg.hasMedia) {
        if (config.log)
          console.log(
            `[${"!".red}] ${
              message.from.replace("@c.us", "").yellow
            } convert sticker into image`
          );
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
      if (
        message.body.includes("|") &&
        message.hasQuotedMsg &&
        quotedMsg.hasMedia
      ) {
        if (config.log)
          console.log(
            `[${"!".red}] ${
              message.from.replace("@c.us", "").yellow
            } change sticker metadata`
          );
        const [namePart, authorPart] = message.body.split("|");
        const name = namePart.replace(`${prefix}change`, "").trim();
        const author = authorPart.trim();

        client.sendMessage(message.from, "*[⏳]* Loading..");
        try {
          const media = await quotedMsg.downloadMedia();
          await client.sendMessage(message.from, media, {
            sendMediaAsSticker: true,
            stickerName: name,
            stickerAuthor: author,
          });
          client.sendMessage(message.from, "*[✅]* Successfully!");
        } catch {
          client.sendMessage(message.from, "*[❎]* Failed!");
        }
      } else {
        client.sendMessage(
          message.from,
          `*[❎]* Format salah:\n*${prefix}change <name> | <author>* (reply sticker)`
        );
      }
    }

    // Mark chat as seen
    else {
      try {
        const chat = await client.getChatById(message.id.remote);
        await chat.sendSeen();
      } catch (e) {}
    }
  }
});

// --- Welcome & Goodbye Events (DILUAR event 'message') ---
client.on("group_join", async (notification) => {
  try {
    const chat = await notification.getChat();
    const contact = await notification.getContact();
    if (config.groups) {
      chat.sendMessage(
        `👋 Selamat datang @${contact.number} di *${chat.name}*!\nJangan lupa baca deskripsi grup ya 🙏`,
        {
          mentions: [contact],
        }
      );
    }
  } catch (e) {
    console.log("Error in welcome msg", e);
  }
});

client.on("group_leave", async (notification) => {
  try {
    const chat = await notification.getChat();
    const contact = await notification.getContact();
    if (config.groups) {
      chat.sendMessage(
        `👋 Selamat tinggal @${contact.number}, semoga sukses di perjalanan selanjutnya.`,
        {
          mentions: [contact],
        }
      );
    }
  } catch (e) {
    console.log("Error in goodbye msg", e);
  }
});

client.initialize();
