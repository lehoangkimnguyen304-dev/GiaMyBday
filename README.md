# GiaMyBday

Trang sinh nhật 20 tuổi của Gia Mỹ: thiệp mở bằng confetti, lò bánh "Bake a wish" để làm bánh tặng, và kệ hộp bánh "Just for Gia Mỹ".

Mở `index.html` trong trình duyệt là chạy. Để bật GitHub Pages: Settings → Pages → Deploy from a branch → `main` / root.

## Hộp bánh dùng chung

`api/cakes.js` là API trên Vercel lưu bánh vào Upstash Redis, để ai mở web cũng thấy bánh của nhau.
Bật một lần: Vercel → project → **Storage** → **Upstash for Redis** → tạo database → **Connect** vào project này → **Redeploy**.
API đọc biến môi trường `KV_REST_API_URL`/`KV_REST_API_TOKEN` (hoặc `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`).
Chưa kết nối thì bánh chỉ được giữ trên máy người làm.
