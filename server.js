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
let cuvântCheieCurent = "";
let stocMaxim = 5;
let listaComenzi = [];

io.on('connection', (socket) => {
    console.log('Operator conectat la panou.');
    // Trimite datele curente la conectare
    socket.emit('actualizare_lista', { listaComenzi, cuvântCheieCurent, stocMaxim });

    // Pornire conectare la TikTok Live
    socket.on('conectare_tiktok', (data) => {
        const username = data.username.replace('@', '').trim();
        if (tiktokConnection) {
            tiktokConnection.disconnect();
        }

        tiktokConnection = new WebcastPushConnection(username);

        tiktokConnection.connect().then(state => {
            console.log(`Conectat la live-ul lui ${username}`);
            socket.emit('status_tiktok', { conectat: true, mesaj: `Conectat la @${username}` });
        }).catch(err => {
            console.error('Eroare conectare:', err);
            socket.emit('status_tiktok', { conectat: false, mesaj: 'Eroare: Live-ul nu a fost găsit sau nu este activ.' });
        });

        // Ascultă fiecare mesaj din chat
        tiktokConnection.on('chat', (chatData) => {
            if (!cuvântCheieCurent) return;

            const mesaj = chatData.comment.toLowerCase().trim();
            const user = chatData.uniqueId;
            const numeAfisat = chatData.nickname;

            // Verifică dacă mesajul conține cuvântul cheie
            if (mesaj.includes(cuvântCheieCurent.toLowerCase())) {
                // Caută un grup de 3 cifre în mesaj (ultimele 3 cifre din telefon)
                const matchCifre = mesaj.match(/\b\d{3}\b/);

                if (matchCifre) {
                    const cifreTelefon = matchCifre[0];

                    // Verifică dacă acest utilizator a comandat deja acest produs
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
                        io.emit('actualizare_lista', { listaComenzi, cuvântCheieCurent, stocMaxim });
                    }
                }
            }
        });
    });

    // Setare produs nou (resetează lista)
    socket.on('produs_nou', (data) => {
        cuvântCheieCurent = data.cuvant.trim();
        stocMaxim = parseInt(data.stoc) || 1;
        listaComenzi = [];
        io.emit('actualizare_lista', { listaComenzi, cuvântCheieCurent, stocMaxim });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serverul rulează pe portul ${PORT}`);
});
