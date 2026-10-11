// Đổi tên phiên bản khi có chỉnh sửa mã nguồn để kích hoạt cập nhật
const CACHE_NAME = 'html-pwa-v1';

// Danh sách tài nguyên cốt lõi cần nạp sẵn khi cài đặt
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './sw.js',
  './icon-512.png'
];

// Thời gian chờ tối đa khi fetch qua mạng trước khi fallback về cache (3 giây)
const NETWORK_TIMEOUT_MS = 3000;

function fetchWithTimeout(request, timeout = NETWORK_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Network request timed out'));
    }, timeout);

    fetch(request).then(
      (response) => {
        clearTimeout(timer);
        resolve(response);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

// 1. Cài đặt SW và nạp cache ban đầu
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  // Chưa gọi skipWaiting() ngay để client kịp hiển thị toast cập nhật
});

// 2. Kích hoạt SW và xóa bỏ cache cũ
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  return self.clients.claim();
});

// 3. Xử lý yêu cầu với chiến lược Network-First
self.addEventListener('fetch', (event) => {
  // Chỉ áp dụng với các request GET
  if (event.request.method !== 'GET') return;

  event.respondWith(
    (async () => {
      try {
        // Thử tải qua mạng trước kèm timeout
        const networkResponse = await fetchWithTimeout(event.request);

        // Lưu bản mới tải được vào cache nếu request hợp lệ
        if (networkResponse && networkResponse.status === 200) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, networkResponse.clone());
        }

        return networkResponse;
      } catch (error) {
        // Mất mạng hoặc phản hồi chậm -> Trích xuất từ Cache
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        // Nếu người dùng điều hướng URL con, trả về file index.html
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('./index.html');
        }

        throw error;
      }
    })()
  );
});

// 4. Lắng nghe tín hiệu kích hoạt tức thì từ giao diện (khi ấn nút Cập nhật)
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});