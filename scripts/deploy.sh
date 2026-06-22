#!/usr/bin/env bash
# نشر/تحديث skyradarweather.com على cPanel عبر SSH.
# الاستخدام (أول مرة):  bash scripts/deploy.sh
# يُفترض تشغيله من داخل ~/skyradarweather.com بعد git clone.
set -euo pipefail

APP_DIR="$HOME/skyradarweather.com"
BACKEND_DIR="$APP_DIR/backend"

echo "==> [1/7] جلب آخر نسخة من GitHub"
cd "$APP_DIR"
git pull origin main

echo "==> [2/7] تثبيت اعتماديات Laravel"
cd "$BACKEND_DIR"
composer install --no-dev --optimize-autoloader

echo "==> [3/7] تجهيز ملف .env"
if [ ! -f .env ]; then
  cp .env.example .env
  php artisan key:generate
  echo "!! عدّل backend/.env (بيانات قاعدة البيانات والمفاتيح) ثم أعد تشغيل السكربت."
  exit 1
fi

echo "==> [4/7] الترحيلات والروابط"
php artisan migrate --force
php artisan storage:link || true

echo "==> [5/7] بناء الفرونت (Vite)"
cd "$APP_DIR"
npm ci
npm run build
# نظّف أصول البناء القديمة فقط، مع الحفاظ على ملفات Laravel public الأخرى
rm -rf "$BACKEND_DIR/public/assets"
cp -r dist/* "$BACKEND_DIR/public/"

echo "==> [6/7] صلاحيات وتخزين مؤقت"
cd "$BACKEND_DIR"
chmod -R 775 storage bootstrap/cache
php artisan config:cache
php artisan route:cache

echo "==> [7/7] تم النشر. تذكير: Document Root للدومين = skyradarweather.com/backend/public"
