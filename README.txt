BERANGKAS MANAGEMENT
=====================

CARA MENJALANKAN
1. Ekstrak folder/ZIP ini.
2. Buka VS Code.
3. Pilih File > Open Folder, lalu pilih folder berangkas_management.
4. Buka index.html.
5. Klik kanan pada index.html > Open with Live Server (jika ekstensi Live Server sudah ada).
   Alternatif tanpa ekstensi: klik dua kali index.html untuk membuka di Microsoft Edge.
6. Login menggunakan akun awal:
   Admin   : admin / admin123
   Petugas : petugas / petugas123
7. Setelah berhasil login sebagai Admin, buka menu Kelola Pengguna untuk membuat akun petugas.

ATURAN SALDO
- Pemasukan: menambah saldo berangkas.
- Pengeluaran: mengurangi saldo berangkas.
- Setoran ke Bank: mengurangi saldo berangkas dan menambah saldo bank.
- Pembelian: mengurangi saldo berangkas.
- Total dana = saldo berangkas + saldo bank.

PENYIMPANAN DAN BATASAN
- Data disimpan pada localStorage browser di komputer ini.
- Tidak memerlukan internet atau database server.
- Gunakan browser dan profil browser yang sama agar data tetap terlihat.
- Jangan hapus data situs/browser sebelum melakukan backup.
- Fitur ekspor CSV tersedia pada Riwayat Transaksi dan Laporan.
- File ini adalah prototipe lokal untuk satu komputer. Login dan data localStorage bukan sistem keamanan tingkat tinggi; password tersimpan di browser dan dapat diakses oleh pengguna komputer yang memiliki kemampuan teknis.
- Jangan gunakan untuk menyimpan data keuangan sensitif/bernilai besar tanpa sistem backup, kontrol akses OS, dan database yang aman.

BACKUP DATA
Buka aplikasi di browser, tekan F12 > Console, lalu jalankan:
copy(localStorage.getItem("berangkas_management_v1"))
Simpan hasilnya di file teks yang aman.

RESTORE DATA
Di browser yang sama, buka F12 > Console, jalankan:
localStorage.setItem("berangkas_management_v1", `TEMPEL_JSON_BACKUP_DI_SINI`)
Lalu refresh halaman. Pastikan JSON backup valid.
