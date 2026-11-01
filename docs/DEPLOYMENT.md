# Instalasi & deployment

## Prasyarat
Node.js **≥ 22.5** (memakai `node:sqlite` bawaan; tanpa `npm install`). Linux/macOS/Windows. Untuk dev Node 22.5–22.12 tambahkan `--experimental-sqlite`.

## Lokal
```bash
cd garda-narasi
npm start                      # http://127.0.0.1:8787
SCHEDULER=false npm run dev    # mode pengembangan (watch), tanpa scheduler
```

## Produksi (VM/VPS) — systemd + reverse proxy HTTPS
```ini
# /etc/systemd/system/garda-narasi.service
[Service]
User=garda
WorkingDirectory=/opt/garda-narasi
Environment=HOST=127.0.0.1 PORT=8787 DB_PATH=/var/lib/garda/garda.db GARDA_CONTACT=redaksi@contoh.org
EnvironmentFile=/etc/garda-narasi.env          # berisi GARDA_API_TOKEN=…
ExecStart=/usr/bin/node --disable-warning=ExperimentalWarning backend/server.js
Restart=on-failure
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/var/lib/garda
[Install]
WantedBy=multi-user.target
```
Nginx (HTTPS wajib; token API dikirim pada setiap permintaan):
```nginx
location / { proxy_pass http://127.0.0.1:8787; proxy_set_header Host $host; proxy_set_header X-Forwarded-For $remote_addr; }
location /api/stream { proxy_pass http://127.0.0.1:8787; proxy_buffering off; proxy_read_timeout 1h; }
```

## Docker
```bash
export GARDA_API_TOKEN=$(openssl rand -hex 24)
docker compose up -d --build        # data di volume 'garda-data'
```

## Hosting statis (mode lokal)
Sajikan **akar proyek** dengan server statis apa pun dan buka `/frontend/`. Tanpa backend: tidak ada pengumpulan, peringatan, PDF.

## Operasi
* **Cadangan**: `scripts/backup.sh /var/lib/garda/garda.db /backups` (VACUUM INTO, aman saat berjalan). Jadwalkan harian via cron.
* **Retensi**: kurangi `MAX_AGE_DAYS`; hapus klaim lama dengan SQL sesuai kebijakan Anda.
* **Pembaruan**: hentikan layanan → ganti kode → mulai; skema dibuat otomatis (`CREATE IF NOT EXISTS`). Cadangkan dulu.
* **Pemantauan**: `GET /api/health`, tabel `runs` (Riwayat pengumpulan), `audit`.

## Daftar periksa keamanan sebelum dibuka ke publik
- [ ] `GARDA_API_TOKEN` panjang & acak  - [ ] HTTPS (proxy)  - [ ] `HOST=127.0.0.1` di belakang proxy  - [ ] `ALLOW_PRIVATE_HOSTS=false`
- [ ] `GARDA_CONTACT` berisi kontak nyata  - [ ] egress firewall hanya ke host sumber  - [ ] cadangan terjadwal  - [ ] kebijakan retensi & dasar hukum data didokumentasikan
- [ ] setiap sumber nyata: ToS dibaca, robots dicek, interval wajar
