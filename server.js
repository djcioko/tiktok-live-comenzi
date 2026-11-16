const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { WebcastPushConnection } = require('tiktok-live-connector');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

let tiktokConnection = null;
let cuvantCheieCurent = "";
let stocMaxim = 5;
let listaComenzi = [];

io.on('connection', (socket) => {
    socket.emit('actualizare_lista', { listaComenzi, cuvantCheieCurent, stocMaxim });

    socket.on('conectare_tiktok', (data) => {
        const username = data.username.replace('@', '').trim();
        if (tiktokConnection) {
            tiktokConnection.disconnect();
        }

        // Adăugăm opțiuni pentru a simula un browser normal
        tiktokConnection = new WebcastPushConnection(username, {
            processInitialData: false,
            enableExtendedGiftInfo: false,
            requestOptions: {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            }
        });

        tiktokConnection.connect().then(state => {
            socket.emit('status_tiktok', { conectat: true, mesaj: `Conectat la @${username} (Room ID: ${state.roomId})` });
        }).catch(err => {
            // Trimite eroarea exactă pe site ca să vedem de ce blochează TikTok
            const mesajEroare = err.message || JSON.stringify(err);
            socket.emit('status_tiktok', { conectat: false, mesaj: `Eroare TikTok: ${mesajEroare}` });
        });

        tiktokConnection.on('chat', (chatData) => {
            if (!cuvantCheieCurent) return;

            const mesaj = chatData.comment.toLowerCase().trim();
            const user = chatData.uniqueId;
            const numeAfisat = chatData.nickname;

            if (mesaj.includes(cuvantCheieCurent.toLowerCase())) {
                const matchCifre = mesaj.match(/\b\d{3}\b/);

                if (matchCifre) {
                    const cifreTelefon = matchCifre[0];
                    const dejaComandat = listaComenzi.some(c => c.user === user);
                    if (!dejaComandat) {
                        const comandaNoua = {
                            ordine: listaComenzi.length + 1,
                            user: user,
                            nume: numeAfisat,
                            cifre: cifreTelefon,
                            mesajComplet: chatData.comment,
                            ora: new Date().toLocaleTimeString('ro-RO'),
                            status: listaComenzi.length < stocMaxim ? 'CÂȘTIGĂTOR' : 'REZERVĂ'
                        };

                        listaComenzi.push(comandaNoua);
                        io.emit('actualizare_lista', { listaComenzi, cuvantCheieCurent, stocMaxim });
                    }
                }
            }
        });
    });

    socket.on('produs_nou', (data) => {
        cuvantCheieCurent = data.cuvant.trim();
        stocMaxim = parseInt(data.stoc) || 1;
        listaComenzi = [];
        io.emit('actualizare_lista', { listaComenzi, cuvantCheieCurent, stocMaxim });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serverul rulează pe portul ${PORT}`);
});
