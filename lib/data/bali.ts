// Data Wilayah Administratif Provinsi Bali
// Sumber: BPS Provinsi Bali, Kemendesa, Pemerintah Provinsi Bali
// Total: 8 Kabupaten + 1 Kota, 57 Kecamatan, 716 Desa/Kelurahan

export type Kelurahan = string

export type Kecamatan = {
  nama: string
  kelurahan: string[]
}

export type Kabupaten = {
  nama: string
  kecamatan: Kecamatan[]
}

export const WILAYAH_BALI: Kabupaten[] = [
  {
    nama: 'Jembrana',
    kecamatan: [
      { nama: 'Melaya', kelurahan: ['Melaya', 'Candikusuma', 'Tuwed', 'Nusasari', 'Warnasari', 'Ekasari', 'Manistutu', 'Blimbingsari', 'Kaliakah', 'Gilimanuk'] },
      { nama: 'Mendoyo', kelurahan: ['Pendem', 'Mendoyo Dauh Tukad', 'Pohsanten', 'Mendoyo Dangin Tukad', 'Pergung', 'Delod Berawah', 'Tegal Cangkring', 'Penyaringan', 'Yeh Embang', 'Yeh Embang Kangin', 'Yeh Embang Kauh', 'Yeh Sumbul'] },
      { nama: 'Pekutatan', kelurahan: ['Medewi', 'Pulukan', 'Pekutatan', 'Gumbrih', 'Pengeragoan', 'Asahduren', 'Pangyangan', 'Banyubiru'] },
      { nama: 'Negara', kelurahan: ['Baleraja', 'Banyubiru', 'Berangbang', 'Cupel', 'Kaliakah', 'Lelateng', 'Loloan Barat', 'Loloan Timur', 'Pemuteran', 'Sangkaragung', 'Tegal Badeng Barat', 'Tegal Badeng Timur', 'Yehembang Kauh', 'Yehembang Kangin', 'Baluk', 'Batu Agung', 'Budeng', 'Dauhwaru'] },
      { nama: 'Jembrana', kelurahan: ['Dangintukadaya', 'Jembrana', 'Loloan Timur', 'Pendem', 'Sangkaragung', 'Batu Agung', 'Dauhwaru', 'Lelateng', 'Pangkungparuk', 'Tukadaya', 'Yeh Kuning'] },
    ],
  },
  {
    nama: 'Tabanan',
    kecamatan: [
      { nama: 'Selemadeg', kelurahan: ['Bajera', 'Bajera Utara', 'Berembeng', 'Manikyang', 'Pupuan Sawah', 'Selemadeg', 'Serampingan', 'Wanagiri', 'Wanagiri Kauh', 'Antap'] },
      { nama: 'Selemadeg Timur', kelurahan: ['Bantas', 'Beraban', 'Dalang', 'Gadungan', 'Gunung Salak', 'Mambang', 'Megati', 'Pangkung Dedap', 'Tangguntiti', 'Tegal Mengkeb'] },
      { nama: 'Selemadeg Barat', kelurahan: ['Angkah', 'Antosari', 'Bajera', 'Bajera Utara', 'Bengkel Sari', 'Lalanglinggah', 'Lumbung', 'Mundeh', 'Mundeh Kangin', 'Mundeh Kauh', 'Selabih', 'Tiying Gading'] },
      { nama: 'Kerambitan', kelurahan: ['Baturiti', 'Belumbang', 'Kelating', 'Kerambitan', 'Kesiut', 'Kukuh', 'Meliling', 'Pangkung Karung', 'Penarukan', 'Samsam', 'Sembung Gede', 'Tibubiu', 'Timpag', 'Tista'] },
      { nama: 'Tabanan', kelurahan: ['Bongan', 'Buahan', 'Dajan Peken', 'Dauh Peken', 'Delod Peken', 'Denbantas', 'Gubug', 'Kesiman', 'Pangkung Tibah', 'Pejaten', 'Sesandan', 'Subamia', 'Sudimara', 'Tunjuk', 'Wanasari'] },
      { nama: 'Kediri', kelurahan: ['Abian Tuwung', 'Banjar Anyar', 'Belalang', 'Bengkel', 'Beraban', 'Cepaka', 'Kaba-Kaba', 'Kediri', 'Mandiangan', 'Nyambu', 'Pandak Bandung', 'Pandak Gede', 'Pangkung Tibah', 'Pejaten', 'Tibubeneng'] },
      { nama: 'Marga', kelurahan: ['Baru', 'Batannyuh', 'Beringkit', 'Cau Belayu', 'Geluntung', 'Kuwum', 'Marga', 'Marga Dajan Puri', 'Marga Dauh Puri', 'Payangan', 'Peken', 'Petiga', 'Selanbawak', 'Tegaljadi', 'Tua'] },
      { nama: 'Baturiti', kelurahan: ['Angseri', 'Antapan', 'Apuan', 'Bangli', 'Batunya', 'Baturiti', 'Candikuning', 'Luwus', 'Mekarsari', 'Perean', 'Perean Kangin', 'Perean Tengah'] },
      { nama: 'Penebel', kelurahan: ['Babahan', 'Biaung', 'Buruan', 'Jatiluwih', 'Jegu', 'Mengesta', 'Penatahan', 'Penebel', 'Pesagi', 'Pitra', 'Rejasa', 'Riang Gede', 'Sangkan Buana', 'Senganan', 'Tajen', 'Tegallinggah', 'Tengkudak', 'Wongaya Gede'] },
      { nama: 'Pupuan', kelurahan: ['Bantiran', 'Batungsel', 'Belatungan', 'Belimbing', 'Jelijih Punggang', 'Karya Sari', 'Kebon Padangan', 'Munduk Temu', 'Padangan', 'Pajahan', 'Pujungan', 'Pupuan', 'Sai', 'Tista'] },
    ],
  },
  {
    nama: 'Badung',
    kecamatan: [
      { nama: 'Kuta', kelurahan: ['Kuta', 'Legian', 'Seminyak', 'Tuban', 'Kedonganan'] },
      { nama: 'Kuta Selatan', kelurahan: ['Benoa', 'Jimbaran', 'Kutuh', 'Pecatu', 'Tanjung Benoa', 'Ungasan'] },
      { nama: 'Kuta Utara', kelurahan: ['Canggu', 'Dalung', 'Kerobokan', 'Kerobokan Kaja', 'Kerobokan Kelod', 'Tibubeneng'] },
      { nama: 'Mengwi', kelurahan: ['Abianbase', 'Baha', 'Buduk', 'Cemagi', 'Gulingan', 'Kapal', 'Kekeran', 'Kuwum', 'Lukluk', 'Mengwi', 'Mengwitani', 'Munggu', 'Penarungan', 'Pererenan', 'Sading', 'Sempidi', 'Sembung', 'Tumbak Bayuh', 'Werdi Bhuwana'] },
      { nama: 'Abiansemal', kelurahan: ['Abiansemal', 'Angantaka', 'Ayunan', 'Blahkiuh', 'Bongkasa', 'Bongkasa Pertiwi', 'Dauh Yeh Cani', 'Jagapati', 'Mambal', 'Mejangan', 'Punggul', 'Sangeh', 'Sedang', 'Selat', 'Sibang Gede', 'Sibang Kaja', 'Taman', 'Taman Sari'] },
      { nama: 'Petang', kelurahan: ['Belok', 'Carangsari', 'Getasan', 'Pangsan', 'Pelaga', 'Petang', 'Sulangai'] },
    ],
  },
  {
    nama: 'Gianyar',
    kecamatan: [
      { nama: 'Sukawati', kelurahan: ['Batubulan', 'Batubulan Kangin', 'Celuk', 'Guwang', 'Kemenuh', 'Ketewel', 'Singapadu', 'Singapadu Kaler', 'Singapadu Tengah', 'Sukawati', 'Sukawati Kaja', 'Banjarangkan'] },
      { nama: 'Blahbatuh', kelurahan: ['Bedulu', 'Belega', 'Blahbatuh', 'Bona', 'Buruan', 'Keramas', 'Medahan', 'Pering', 'Saba'] },
      { nama: 'Gianyar', kelurahan: ['Abianbase', 'Beng', 'Bitera', 'Bakbakan', 'Gianyar', 'Lebih', 'Petak', 'Petak Kaja', 'Samplangan', 'Serongga', 'Siangan', 'Sidan', 'Sumerta Kelod', 'Temesi', 'Tulikup'] },
      { nama: 'Tampaksiring', kelurahan: ['Manukaya', 'Pejeng', 'Pejeng Kaja', 'Pejeng Kangin', 'Pejeng Kawan', 'Pejeng Kelod', 'Sanding', 'Tampaksiring'] },
      { nama: 'Ubud', kelurahan: ['Kedewatan', 'Lodtunduh', 'Mas', 'Peliatan', 'Petulu', 'Sayan', 'Singakerta', 'Ubud'] },
      { nama: 'Tegallalang', kelurahan: ['Bresela', 'Kedisan', 'Keliki', 'Kenderan', 'Pupuan', 'Sebatu', 'Taro', 'Tegallalang'] },
      { nama: 'Payangan', kelurahan: ['Bresela', 'Buahan', 'Buahan Kaja', 'Bukian', 'Kelusa', 'Kerta', 'Melinggih', 'Melinggih Kelod', 'Puhu', 'Sakti'] },
    ],
  },
  {
    nama: 'Klungkung',
    kecamatan: [
      { nama: 'Nusa Penida', kelurahan: ['Batukandik', 'Batumadeg', 'Batununggul', 'Bunga Mekar', 'Jungutbatu', 'Kampung Toyapakeh', 'Klumpu', 'Kutampi', 'Lembongan', 'Ped', 'Pejukutan', 'Sakti', 'Sekartaji', 'Suana', 'Tanglad', 'Toyapakeh'] },
      { nama: 'Banjarangkan', kelurahan: ['Aan', 'Bakas', 'Banjarangkan', 'Bungbungan', 'Getakan', 'Negari', 'Nyalian', 'Nyanglan', 'Takmung', 'Tihingan', 'Timuhun', 'Tohpati', 'Tusan'] },
      { nama: 'Klungkung', kelurahan: ['Akah', 'Gelgel', 'Jumpai', 'Kamasan', 'Kampung Gelgel', 'Manduang', 'Satria', 'Selat', 'Semarapura Kaja', 'Semarapura Kangin', 'Semarapura Kauh', 'Semarapura Klod', 'Semarapura Klod Kangin', 'Semarapura Tengah', 'Tangkas', 'Tegak', 'Tojan'] },
      { nama: 'Dawan', kelurahan: ['Besan', 'Dawan Kaler', 'Dawan Klod', 'Gunaksa', 'Kampung Kusamba', 'Kusamba', 'Paksa', 'Pesinggahan', 'Sampalan Klod', 'Sampalan Tengah', 'Sulang', 'Sukawati'] },
    ],
  },
  {
    nama: 'Bangli',
    kecamatan: [
      { nama: 'Susut', kelurahan: ['Apuan', 'Abuan', 'Bebalang', 'Bunutin', 'Cempaga', 'Kawan', 'Kayubihi', 'Landih', 'Pengotan', 'Taman Bali'] },
      { nama: 'Bangli', kelurahan: ['Bebalang', 'Bunutin', 'Cempaga', 'Kawan', 'Kayubihi', 'Landih', 'Pengotan', 'Taman Bali'] },
      { nama: 'Tembuku', kelurahan: ['Bangbang', 'Jehem', 'Peninjoan', 'Tembuku', 'Undisan', 'Yangapi'] },
      { nama: 'Kintamani', kelurahan: ['Abangsongan', 'Abuan', 'Awan', 'Bantang', 'Banua', 'Batumadeg', 'Bayung Cerik', 'Bayung Gede', 'Belancan', 'Belandingan', 'Belanga', 'Belantih', 'Binyan', 'Bonyoh', 'Buahan', 'Bunutin', 'Catur', 'Daup', 'Dausa', 'Gunungbau', 'Katung', 'Kedisan', 'Kintamani', 'Kutuh', 'Langgaan', 'Lembean', 'Mangguh', 'Manikliyu', 'Mengani', 'Pengejaran', 'Pinggan', 'Satria', 'Sekaan', 'Sekardadi', 'Selulung', 'Serai', 'Siakin', 'Songan A', 'Songan B', 'Subaya', 'Sukawana', 'Suter', 'Terunyan', 'Ulian'] },
    ],
  },
  {
    nama: 'Karangasem',
    kecamatan: [
      { nama: 'Rendang', kelurahan: ['Besakih', 'Bebandem', 'Karangasem', 'Muncan', 'Pempatan', 'Pesaban', 'Rendang', 'Sibetan', 'Sidemen', 'Selat', 'Tianyar', 'Tianyar Barat', 'Tianyar Tengah', 'Tribuana', 'Telaga'] },
      { nama: 'Sidemen', kelurahan: ['Sangkan Gunung', 'Sidemen', 'Talibeng', 'Telaga Tawang', 'Tri Eka Buana', 'Wisma Kerta', 'Loka Sari', 'Kertha Buana', 'Sindu Wati', 'Sukawati'] },
      { nama: 'Manggis', kelurahan: ['Antiga', 'Antiga Kelod', 'Gegelang', 'Manggis', 'Ngis', 'Padangbai', 'Pesedahan', 'Selumbung', 'Sengkidu', 'Tenganan', 'Ulakan', 'Nyuh Tebel'] },
      { nama: 'Karangasem', kelurahan: ['Asak', 'Bugbug', 'Bukit', 'Karangasem', 'Padangkerta', 'Subagan', 'Tumbu', 'Seraya', 'Seraya Barat', 'Seraya Timur'] },
      { nama: 'Abang', kelurahan: ['Ababi', 'Abang', 'Bunutan', 'Datah', 'Kesimpar', 'Labasari', 'Nawakerti', 'Pidpid', 'Purwakerthi', 'Tista', 'Tiyingtali', 'Tri Buana', 'Ulakan'] },
      { nama: 'Bebandem', kelurahan: ['Bebandem', 'Budakeling', 'Bungaya', 'Bungaya Kangin', 'Jungutan', 'Kastala', 'Macang', 'Sibetan'] },
      { nama: 'Selat', kelurahan: ['Amertha Buana', 'Duda', 'Duda Timur', 'Duda Utara', 'Muncan', 'Pering Sari', 'Sebudi', 'Selat', 'Sindu Wati'] },
      { nama: 'Kubu', kelurahan: ['Ban', 'Batu Ringgit', 'Dukuh', 'Kubu', 'Muntigunung', 'Tianyar Barat', 'Tianyar Tengah', 'Tianyar Timur', 'Tulamben', 'Purwakerthi'] },
    ],
  },
  {
    nama: 'Buleleng',
    kecamatan: [
      { nama: 'Gerokgak', kelurahan: ['Banyupoh', 'Celukan Bawang', 'Gerokgak', 'Musi', 'Patas', 'Pejarakan', 'Pemuteran', 'Pengulon', 'Penyabangan', 'Sanggalangit', 'Sumberkima', 'Sumberklampok', 'Tinga-Tinga', 'Tukad Sumaga'] },
      { nama: 'Seririt', kelurahan: ['Banjar Asem', 'Bestala', 'Bubunan', 'Gunungsari', 'Joanyar', 'Kalianget', 'Kalisada', 'Lokapaksa', 'Mayong', 'Munduk Bestala', 'Pangkung Paruk', 'Patemon', 'Pengastulan', 'Rangdu', 'Ringdikit', 'Seririt', 'Sulanyah', 'Tangguwisia', 'Ularan', 'Umeanyar', 'Unggahan'] },
      { nama: 'Busungbiu', kelurahan: ['Bengkel', 'Bongancina', 'Busungbiu', 'Kedis', 'Kekeran', 'Pelapuan', 'Pucaksari', 'Sepang', 'Sepang Kelod', 'Subuk', 'Telaga', 'Tinga-Tinga', 'Titab', 'Tista', 'Umejero'] },
      { nama: 'Banjar', kelurahan: ['Banjar', 'Banjar Tegeha', 'Banyuatis', 'Banyuseri', 'Cempaga', 'Dencarik', 'Gesing', 'Gobleg', 'Kaliasem', 'Kayuputih', 'Munduk', 'Pedawa', 'Sidetapa', 'Tampekan', 'Temukus', 'Tigawasa', 'Tista'] },
      { nama: 'Sukasada', kelurahan: ['Ambengan', 'Gitgit', 'Kayuputih', 'Padangbulia', 'Pancasari', 'Panji', 'Panji Anom', 'Pegadungan', 'Pegayaman', 'Sambangan', 'Selat', 'Silangjana', 'Sukasada', 'Tegal Linggah', 'Wanagiri'] },
      { nama: 'Buleleng', kelurahan: ['Anturan', 'Astina', 'Banjar Bali', 'Banjar Jawa', 'Banjar Tegal', 'Banyuasri', 'Banyuning', 'Beratan', 'Kaliuntu', 'Kampung Anyar', 'Kampung Baru', 'Kampung Bugis', 'Kampung Kajanan', 'Kampung Singaraja', 'Liligundi', 'Paket Agung', 'Pemaron', 'Penarukan', 'Sari Mekar', 'Tukadmungga'] },
      { nama: 'Sawan', kelurahan: ['Bebetin', 'Bungkulan', 'Galungan', 'Giri Emas', 'Jagaraga', 'Kerobokan', 'Lemukih', 'Menyinga', 'Sangsit', 'Sawan', 'Sekumpul', 'Sinabun', 'Sudaji', 'Suwug'] },
      { nama: 'Kubutambahan', kelurahan: ['Bila', 'Bukti', 'Bulian', 'Depeha', 'Kubutambahan', 'Mengening', 'Tambakan', 'Tamblang', 'Tunjung', 'Pakisan', 'Tajun', 'Bontihing', 'Kubutambahan'] },
      { nama: 'Tejakula', kelurahan: ['Bondalem', 'Julah', 'Les', 'Madenan', 'Pacung', 'Penuktukan', 'Sambirenteng', 'Sembiran', 'Tejakula', 'Tembok'] },
    ],
  },
  {
    nama: 'Denpasar',
    kecamatan: [
      { nama: 'Denpasar Selatan', kelurahan: ['Pemogan', 'Pedungan', 'Sesetan', 'Serangan', 'Renon', 'Sanur', 'Sanur Kaja', 'Sanur Kauh', 'Sidakarya', 'Panjer'] },
      { nama: 'Denpasar Timur', kelurahan: ['Dangin Puri', 'Dangin Puri Kangin', 'Dangin Puri Kauh', 'Dangin Puri Kelod', 'Penatih', 'Penatih Dangin Puri', 'Sumerta', 'Sumerta Kaja', 'Sumerta Kauh', 'Sumerta Kelod', 'Kesiman', 'Kesiman Kertalangu', 'Kesiman Petilan'] },
      { nama: 'Denpasar Barat', kelurahan: ['Dauh Puri', 'Dauh Puri Kangin', 'Dauh Puri Kauh', 'Dauh Puri Kelod', 'Padangsambian', 'Padangsambian Kaja', 'Padangsambian Kelod', 'Pemecutan', 'Pemecutan Kaja', 'Pemecutan Kelod', 'Tegal Harum', 'Tegal Kertha'] },
      { nama: 'Denpasar Utara', kelurahan: ['Peguyangan', 'Peguyangan Kaja', 'Peguyangan Kangin', 'Tonja', 'Ubung', 'Ubung Kaja', 'Dangin Puri Kaja', 'Dangin Puri Kauh', 'Dangin Puri Kelod', 'Pemecutan Kaja', 'Pemecutan Kelod'] },
    ],
  },
]

export function getKecamatanList(kabupatenNama: string): Kecamatan[] {
  const kab = WILAYAH_BALI.find((k) => k.nama === kabupatenNama)
  return kab?.kecamatan || []
}

export function getKelurahanList(kabupatenNama: string, kecamatanNama: string): string[] {
  const kab = WILAYAH_BALI.find((k) => k.nama === kabupatenNama)
  if (!kab) return []
  const kec = kab.kecamatan.find((k) => k.nama === kecamatanNama)
  return kec?.kelurahan || []
}