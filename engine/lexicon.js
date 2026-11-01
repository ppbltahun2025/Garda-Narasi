/* GARDA NARASI — leksikon Bahasa Indonesia (sentimen, topik, penanda epistemik, konsep, gazetteer).
   Dimuat di Node maupun browser (namespace GARDA). Semua daftar bersifat transparan dan dapat diaudit. */
(function (G) {
  'use strict';

  const STOPWORDS = `yang dan atau di ke dari untuk pada dengan ini itu akan telah sudah ada dalam oleh karena agar saat sebagai para kami kita mereka
    bahwa sebuah bisa dapat tersebut lebih juga masih hingga mulai adalah ialah yaitu yakni serta setelah sebelum ketika sedang sambil namun tetapi tapi
    sehingga jika bila apabila maka lalu kemudian atas bagi antara tanpa seperti sekitar sampai semua setiap tiap beberapa banyak sangat sekali amat
    anda saya aku kamu dia ia beliau nya lah kah pun per hal dua tiga satu ia kepada terhadap mengenai tentang sesuai dilaporkan melalui lewat
    yg dgn utk dr dlm krn sdh blm tdk gak ga nggak ngga bgt aja saja cuma hanya pernah bukan belum jangan harus perlu mau ingin sempat usai`
    .split(/\s+/).filter(Boolean);

  // Normalisasi bahasa tidak baku / singkatan chat → bentuk baku
  const SLANG = {
    yg: 'yang', dgn: 'dengan', dg: 'dengan', utk: 'untuk', untk: 'untuk', krn: 'karena', karna: 'karena', sdh: 'sudah', udah: 'sudah', udh: 'sudah',
    blm: 'belum', belom: 'belum', tdk: 'tidak', gak: 'tidak', ga: 'tidak', nggak: 'tidak', ngga: 'tidak', gk: 'tidak', enggak: 'tidak', bgt: 'banget',
    bgd: 'banget', jgn: 'jangan', dr: 'dari', dlm: 'dalam', tp: 'tapi', tpi: 'tapi', sm: 'sama', kpd: 'kepada', spy: 'supaya', trs: 'terus', lg: 'lagi',
    skrg: 'sekarang', sbg: 'sebagai', pd: 'pada', tsb: 'tersebut', dll: 'dan lain lain', dsb: 'dan sebagainya', hrs: 'harus', msh: 'masih', bs: 'bisa',
    emg: 'memang', emang: 'memang', kok: 'kok', nih: 'ini', tuh: 'itu', deh: 'deh', dong: 'dong', sih: 'sih', aja: 'saja', ajah: 'saja', gimana: 'bagaimana',
    gmn: 'bagaimana', kenapa: 'mengapa', knp: 'mengapa', pake: 'pakai', bikin: 'membuat', liat: 'lihat', ngeri: 'ngeri', mantul: 'bagus sekali', parah: 'parah',
    pemda: 'pemerintah daerah', pemprov: 'pemerintah provinsi', pemkot: 'pemerintah kota', pemkab: 'pemerintah kabupaten', wni: 'warga negara indonesia',
    hoax: 'hoaks', fake: 'palsu', viral: 'viral', info: 'informasi', infonya: 'informasi', rmh: 'rumah', sakit: 'sakit', bnjr: 'banjir'
  };

  /* ---------- SENTIMEN (skor -3..+3). Domain: teks berita/pesan publik. ---------- */
  const SENT_NEG = {
    // kerugian & kerusakan
    rusak: -2, kerusakan: -2, hancur: -3, ambruk: -3, roboh: -3, putus: -2, bocor: -2, macet: -2, lumpuh: -3, padam: -2, mati: -2, gagal: -2, kegagalan: -2,
    // bencana & bahaya
    bencana: -2, banjir: -2, longsor: -2, gempa: -1, kebakaran: -3, ledakan: -3, meledak: -3, tsunami: -3, darurat: -2, bahaya: -2, berbahaya: -2, ancaman: -2, krisis: -3,
    korban: -2, meninggal: -3, tewas: -3, hilang: -2, terluka: -2, luka: -2, sakit: -1, wabah: -3, keracunan: -3, racun: -3, terkontaminasi: -3, tercemar: -2,
    // emosi / penilaian negatif
    panik: -2, takut: -2, cemas: -2, khawatir: -2, resah: -2, marah: -2, kecewa: -2, mengecewakan: -3, memalukan: -3, buruk: -2, jelek: -2, parah: -2, kacau: -3,
    gawat: -2, mengerikan: -3, menyedihkan: -2, sedih: -2, duka: -2, prihatin: -1, miris: -2, bobrok: -3, busuk: -3, bohong: -3, palsu: -3, hoaks: -2, penipuan: -3,
    menipu: -3, curang: -3, korupsi: -3, korup: -3, pungli: -3, kecurangan: -3, kebohongan: -3, menyesatkan: -3, fitnah: -3, provokasi: -3, provokatif: -3,
    kerusuhan: -3, bentrok: -3, ricuh: -3, kekerasan: -3, serangan: -3, teror: -3, ditutup: -1, diblokir: -2, dilarang: -1, dicabut: -1, dihentikan: -1,
    terlambat: -1, lambat: -1, mahal: -1, melonjak: -1, anjlok: -2, defisit: -2, inflasi: -1, langka: -2, kelangkaan: -2, antre: -1, kesulitan: -2, sulit: -1,
    menderita: -3, terdampak: -1, mengungsi: -1, pengungsi: -1, kelaparan: -3, kekeringan: -2, polusi: -2, kumuh: -2, tidak_aman: -2, tidak_becus: -3, lalai: -2, kelalaian: -2,
    meresahkan: -3, merugikan: -3, kerugian: -2, bangkrut: -3, phk: -2, pemadaman: -1, gangguan: -1, terganggu: -1, kritis: -2, mengancam: -2, retas: -2, diretas: -3, bocor_data: -3
  };
  const SENT_POS = {
    aman: 2, terkendali: 2, pulih: 2, membaik: 2, normal: 1, lancar: 2, tersedia: 1, dibuka: 1, selesai: 1, berhasil: 2, keberhasilan: 2, sukses: 2, selamat: 2,
    bantuan: 1, membantu: 1, evakuasi: 0, siaga: 0, sembuh: 2, kesembuhan: 2, gratis: 1, murah: 1, turun: 0, meningkat: 1, naik: 0, tumbuh: 1, berkembang: 1,
    bagus: 2, baik: 1, hebat: 2, luar_biasa: 3, bangga: 2, membanggakan: 3, puas: 2, memuaskan: 2, senang: 2, gembira: 2, lega: 2, syukur: 2, bersyukur: 2,
    apresiasi: 2, mengapresiasi: 2, dukungan: 1, mendukung: 1, setuju: 1, harapan: 1, optimis: 2, positif: 1, adil: 2, transparan: 2, jujur: 2, tepat: 1, cepat: 1,
    tanggap: 2, sigap: 2, efektif: 2, efisien: 2, mudah: 1, nyaman: 2, bersih: 1, sehat: 2, kondusif: 2, damai: 2, tenang: 2, stabil: 2, terjamin: 2, resmi: 0,
    diperbaiki: 1, perbaikan: 1, pembangunan: 1, diresmikan: 1, penghargaan: 2, prestasi: 2, inovasi: 1, terbantu: 2, tertib: 1, terkonfirmasi: 1, terverifikasi: 1
  };
  const NEGATORS = ['tidak', 'bukan', 'belum', 'tanpa', 'jangan', 'kurang', 'nggak', 'enggak', 'tak', 'bukannya'];
  const INTENSIFIERS = { sangat: 1.5, sekali: 1.4, banget: 1.5, amat: 1.4, paling: 1.5, terlalu: 1.4, benar: 1.2, super: 1.5, sungguh: 1.3, makin: 1.2, semakin: 1.2 };
  const DIMINISHERS = { agak: 0.6, cukup: 0.8, sedikit: 0.6, lumayan: 0.8, relatif: 0.8 };

  /* ---------- TOPIK (benih leksikon per topik) ---------- */
  const TOPICS = {
    'Bencana & keselamatan': 'bencana banjir longsor gempa tsunami erupsi gunung evakuasi pengungsi pengungsian korban siaga darurat bmkg bnpb basarnas kebakaran badai angin puting beliung cuaca ekstrem peringatan dini tanggap posko titik kumpul jalur evakuasi selamat hilang tertimbun abrasi kekeringan karhutla asap',
    'Kesehatan publik': 'kesehatan rumah sakit puskesmas dokter pasien obat vaksin vaksinasi imunisasi wabah penyakit virus demam berdarah dbd covid flu stunting gizi bpjs kemenkes dinkes klinik nakes keracunan sembuh diare tbc campak rabies posyandu pangan kontaminasi',
    'Layanan publik': 'layanan pelayanan administrasi ktp kk akta paspor sim samsat pajak air bersih pdam listrik pln padam pemadaman gas elpiji sampah kelurahan kecamatan dukcapil bansos subsidi bantuan sosial pensiun izin pengumuman jadwal loket kantor pemerintah',
    'Infrastruktur': 'jembatan jalan tol jalan raya rel kereta bandara pelabuhan bendungan irigasi drainase gorong proyek pembangunan konstruksi rusak ambruk retak aspal terowongan fly over transportasi krl mrt lrt bus terminal stasiun kemacetan perbaikan jalan',
    'Ekonomi & harga': 'harga sembako beras minyak goreng cabai bawang telur gula inflasi rupiah dolar ekspor impor pajak umkm pasar subsidi bbm bensin pertalite harga naik kelangkaan pengangguran phk investasi saham bank kredit pinjaman upah gaji bisnis perdagangan',
    'Politik & pemerintahan': 'presiden menteri gubernur bupati walikota dpr dprd partai pemilu pilkada pilpres kampanye koalisi kabinet kebijakan undang undang perppu apbn anggaran reformasi birokrasi pejabat dpd mpr kpu bawaslu suara pemilih demonstrasi aspirasi pemerintah',
    'Keamanan & hukum': 'polisi polri tni hukum pengadilan jaksa kpk korupsi tersangka terdakwa vonis penangkapan narkoba terorisme teror kriminal pembunuhan pencurian begal tawuran kerusuhan penipuan pidana saksi penyelidikan penyidikan hakim sidang kejahatan',
    'Pendidikan': 'sekolah siswa murid guru dosen mahasiswa universitas kampus kurikulum ujian snbt utbk beasiswa pendidikan kemendikbud kelas pembelajaran spp zonasi ppdb ijazah wisuda skripsi sekolah dasar smp sma smk paud madrasah',
    'Teknologi & siber': 'siber hacker peretas retas peretasan data bocor kebocoran serangan ransomware phishing aplikasi internet jaringan sinyal telekomunikasi server situs hoaks disinformasi media sosial platform digital ai kecerdasan buatan malware keamanan siber bssn kominfo komdigi pinjol judi online',
    'Lingkungan': 'lingkungan hutan sampah plastik polusi udara pencemaran sungai laut limbah emisi iklim banjir rob reklamasi tambang deforestasi satwa konservasi cagar alam lahan gambut kebakaran hutan karhutla pemanasan global energi terbarukan daur ulang'
  };

  /* ---------- PENANDA EPISTEMIK ---------- */
  // kelas: unverified (klaim belum terverifikasi), speculation (dugaan), opinion (opini), factual (pernyataan faktual-atributif)
  const EPISTEMIC = {
    unverified: [
      ['beredar', 2], ['viral', 1.5], ['dikabarkan', 2.5], ['kabarnya', 2.5], ['katanya', 2.5], ['konon', 2.5], ['pesan berantai', 3], ['tersebar', 1.5], ['disebut', 1.2],
      ['diklaim', 2], ['klaim', 1.2], ['mengklaim', 2], ['unggahan', 1.2], ['tanpa sumber', 3], ['tanpa bukti', 3], ['belum dikonfirmasi', 3], ['belum terkonfirmasi', 3],
      ['belum diverifikasi', 3], ['belum terverifikasi', 3], ['tidak jelas sumber', 3], ['sumber tidak jelas', 3], ['kebenarannya', 2], ['belum ada konfirmasi', 3], ['menyebut bahwa', 1],
      ['pesan yang beredar', 3], ['broadcast', 2], ['pesan siaran', 2], ['dibagikan ulang', 2], ['diunggah ulang', 2], ['seolah olah', 2], ['seakan akan', 1.5], ['diduga hoaks', 2]
    ],
    speculation: [
      ['diduga', 3], ['dugaan', 3], ['patut diduga', 3.5], ['kemungkinan', 2.5], ['mungkin', 2], ['bisa jadi', 3], ['diperkirakan', 2.5], ['perkiraan', 1.5], ['prediksi', 2.5], ['diprediksi', 2.5],
      ['berpotensi', 2.5], ['potensi', 1.5], ['dikhawatirkan', 2.5], ['jangan jangan', 3], ['sepertinya', 2.5], ['tampaknya', 2.5], ['kelihatannya', 2.5], ['sepertinya', 2.5],
      ['mengindikasikan', 2], ['indikasi', 1.5], ['diprakirakan', 2.5], ['boleh jadi', 3], ['agaknya', 2.5], ['barangkali', 3], ['kira kira', 2], ['bakal', 1.2], ['rencananya', 1], ['skenario', 1.5], ['spekulasi', 3]
    ],
    opinion: [
      ['menurut saya', 3.5], ['menurutku', 3.5], ['saya rasa', 3.5], ['saya pikir', 3.5], ['saya kira', 3], ['aku rasa', 3.5], ['opini', 3], ['pendapat', 2], ['sebaiknya', 2.5], ['seharusnya', 2.5],
      ['harusnya', 2.5], ['semestinya', 2.5], ['sebaiknya', 2.5], ['sayang sekali', 3], ['menyedihkan', 2], ['mengecewakan', 2.5], ['memalukan', 2.5], ['luar biasa', 2], ['hebat', 2], ['bagus', 1.5],
      ['jelek', 2], ['buruk', 2], ['tidak becus', 3], ['bobrok', 3], ['payah', 3], ['lamban', 2], ['gagal total', 2.5], ['pantas', 1.5], ['layak', 1.5], ['setuju', 2], ['tidak setuju', 3],
      ['kecewa', 2.5], ['bangga', 2.5], ['saya', 1], ['aku', 1], ['menurut kami', 3], ['patut', 1.5], ['wajib', 1.2], ['mestinya', 2.5], ['terlalu', 1], ['sungguh', 1.5], ['kebijakan yang', 0.8]
    ],
    factual: [
      ['menurut bmkg', 3], ['menurut bnpb', 3], ['menurut kementerian', 3], ['menurut data', 3], ['berdasarkan data', 3], ['data menunjukkan', 3], ['tercatat', 2.5], ['mencatat', 2],
      ['resmi', 2], ['secara resmi', 3], ['mengumumkan', 2.5], ['diumumkan', 2.5], ['menyatakan', 1.8], ['dinyatakan', 1.8], ['ditetapkan', 2.5], ['menetapkan', 2.5], ['dirilis', 2.5],
      ['dikonfirmasi', 2.5], ['mengonfirmasi', 2.5], ['terkonfirmasi', 2], ['pada pukul', 2.5], ['sebanyak', 2], ['berdasarkan laporan', 2.5], ['laporan resmi', 3], ['siaran pers', 3],
      ['juru bicara', 2], ['kepala', 0.8], ['dinas', 1.2], ['pemerintah', 0.8], ['telah ditutup', 1.5], ['telah dibuka', 1.5], ['sudah dibuka', 1.5], ['dibuka kembali', 1.5], ['berlaku mulai', 2],
      ['sesuai surat', 2.5], ['surat edaran', 2.5], ['peraturan', 1.5], ['hasil pemeriksaan', 2.5], ['hasil penelusuran', 2], ['penelusuran', 1.2], ['dipastikan', 2]
    ]
  };

  /* ---------- KONSEP (sinonim ringan untuk normalisasi semantik-leksikal) ---------- */
  const CONCEPTS = {
    C_BANJIR: 'banjir genangan meluap air bah luapan rob',
    C_PUTUS: 'putus ambruk roboh runtuh terputus jebol',
    C_TUTUP: 'ditutup tutup diblokir blokir terblokir ditiadakan dihentikan berhenti lumpuh disetop stop',
    C_BUKA: 'dibuka buka beroperasi normal pulih kembali',
    C_AIR: 'air pdam air_bersih ledeng',
    C_LISTRIK: 'listrik pln padam pemadaman mati_listrik',
    C_PANGAN: 'pangan beras sembako makanan bahan_pokok logistik',
    C_BANTUAN: 'bantuan donasi sumbangan bansos logistik',
    C_KORBAN: 'korban tewas meninggal jiwa wafat',
    C_HOAKS: 'hoaks hoax palsu bohong disinformasi fitnah',
    C_PALSU: 'palsu bohong hoaks rekayasa manipulasi',
    C_JALAN: 'jalan jalur ruas akses rute',
    C_EVAKUASI: 'evakuasi mengungsi pengungsian titik_kumpul',
    C_RACUN: 'racun terkontaminasi tercemar keracunan beracun',
    C_PESAN: 'pesan broadcast berantai siaran unggahan',
    C_KABAR: 'dikabarkan kabarnya katanya konon beredar tersebar disebut menyebut',
    C_DATA_BOCOR: 'bocor kebocoran diretas retas peretasan dibobol',
    C_HARGA_NAIK: 'melonjak naik mahal meroket'
  };

  /* ---------- Fitur geografis: provinsi Indonesia (centroid perkiraan + posisi tile-grid) ---------- */
  // [kode, nama, lat, lon, kolom, baris, alias[]]
  const PROVINCES = [
    ['ID-AC', 'Aceh', 4.7, 96.7, 0, 0, ['nangroe aceh', 'nad']],
    ['ID-SU', 'Sumatera Utara', 2.1, 99.5, 1, 1, ['sumut']],
    ['ID-SB', 'Sumatera Barat', -0.9, 100.4, 1, 2, ['sumbar']],
    ['ID-RI', 'Riau', 0.5, 101.5, 2, 2, []],
    ['ID-KR', 'Kepulauan Riau', 3.9, 108.2, 3, 1, ['kepri']],
    ['ID-JA', 'Jambi', -1.6, 103.6, 2, 3, []],
    ['ID-BE', 'Bengkulu', -3.8, 102.3, 1, 3, []],
    ['ID-SS', 'Sumatera Selatan', -3.1, 104.1, 2, 4, ['sumsel']],
    ['ID-BB', 'Kepulauan Bangka Belitung', -2.7, 106.4, 3, 3, ['bangka belitung', 'babel']],
    ['ID-LA', 'Lampung', -4.9, 105.0, 2, 5, []],
    ['ID-BT', 'Banten', -6.4, 106.1, 3, 6, []],
    ['ID-JK', 'DKI Jakarta', -6.2, 106.8, 4, 6, ['jakarta']],
    ['ID-JB', 'Jawa Barat', -6.9, 107.6, 5, 6, ['jabar']],
    ['ID-JT', 'Jawa Tengah', -7.2, 110.2, 6, 6, ['jateng']],
    ['ID-YO', 'DI Yogyakarta', -7.9, 110.4, 6, 7, ['yogyakarta', 'jogja', 'diy']],
    ['ID-JI', 'Jawa Timur', -7.5, 112.2, 7, 6, ['jatim']],
    ['ID-BA', 'Bali', -8.4, 115.2, 8, 6, []],
    ['ID-NB', 'Nusa Tenggara Barat', -8.7, 117.4, 9, 6, ['ntb']],
    ['ID-NT', 'Nusa Tenggara Timur', -9.5, 121.1, 10, 6, ['ntt']],
    ['ID-KB', 'Kalimantan Barat', 0.0, 110.9, 4, 2, ['kalbar']],
    ['ID-KT', 'Kalimantan Tengah', -1.7, 113.4, 5, 3, ['kalteng']],
    ['ID-KS', 'Kalimantan Selatan', -3.1, 115.3, 6, 4, ['kalsel']],
    ['ID-KI', 'Kalimantan Timur', 0.5, 116.4, 6, 2, ['kaltim']],
    ['ID-KU', 'Kalimantan Utara', 3.1, 116.0, 6, 1, ['kaltara']],
    ['ID-SA', 'Sulawesi Utara', 0.6, 124.5, 9, 0, ['sulut']],
    ['ID-GO', 'Gorontalo', 0.7, 122.4, 8, 1, []],
    ['ID-ST', 'Sulawesi Tengah', -1.4, 121.4, 8, 2, ['sulteng']],
    ['ID-SR', 'Sulawesi Barat', -2.8, 119.2, 7, 3, ['sulbar']],
    ['ID-SN', 'Sulawesi Selatan', -3.7, 119.9, 8, 3, ['sulsel']],
    ['ID-SG', 'Sulawesi Tenggara', -4.1, 122.2, 9, 3, ['sultra']],
    ['ID-MU', 'Maluku Utara', 1.6, 127.8, 10, 1, ['malut']],
    ['ID-MA', 'Maluku', -3.2, 129.0, 11, 3, []],
    ['ID-PD', 'Papua Barat Daya', -1.2, 131.5, 12, 1, []],
    ['ID-PB', 'Papua Barat', -1.3, 133.2, 13, 1, []],
    ['ID-PA', 'Papua', -2.5, 140.7, 15, 1, []],
    ['ID-PT', 'Papua Tengah', -3.8, 136.2, 14, 2, []],
    ['ID-PE', 'Papua Pegunungan', -4.1, 139.0, 15, 2, []],
    ['ID-PS', 'Papua Selatan', -7.3, 139.9, 15, 3, []]
  ].map(([code, name, lat, lon, col, row, alias]) => ({ code, name, lat, lon, col, row, alias }));

  // Kota besar → kode provinsi (digunakan sebagai kandidat lokasi; verifikasi tetap oleh manusia)
  const CITIES = {
    'banda aceh': 'ID-AC', medan: 'ID-SU', padang: 'ID-SB', pekanbaru: 'ID-RI', batam: 'ID-KR', jambi: 'ID-JA', bengkulu: 'ID-BE', palembang: 'ID-SS', 'pangkal pinang': 'ID-BB',
    'bandar lampung': 'ID-LA', serang: 'ID-BT', tangerang: 'ID-BT', bandung: 'ID-JB', bogor: 'ID-JB', bekasi: 'ID-JB', depok: 'ID-JB', cirebon: 'ID-JB', semarang: 'ID-JT',
    solo: 'ID-JT', surakarta: 'ID-JT', surabaya: 'ID-JI', malang: 'ID-JI', denpasar: 'ID-BA', mataram: 'ID-NB', kupang: 'ID-NT', pontianak: 'ID-KB', palangkaraya: 'ID-KT',
    banjarmasin: 'ID-KS', balikpapan: 'ID-KI', samarinda: 'ID-KI', tarakan: 'ID-KU', manado: 'ID-SA', gorontalo: 'ID-GO', palu: 'ID-ST', mamuju: 'ID-SR', makassar: 'ID-SN',
    kendari: 'ID-SG', ternate: 'ID-MU', ambon: 'ID-MA', sorong: 'ID-PD', manokwari: 'ID-PB', jayapura: 'ID-PA', timika: 'ID-PT', merauke: 'ID-PS', wamena: 'ID-PE'
  };

  G.lexicon = { STOPWORDS, SLANG, SENT_NEG, SENT_POS, NEGATORS, INTENSIFIERS, DIMINISHERS, TOPICS, EPISTEMIC, CONCEPTS, PROVINCES, CITIES };
})(typeof window !== 'undefined' ? (window.GARDA = window.GARDA || {}) : (globalThis.GARDA = globalThis.GARDA || {}));
