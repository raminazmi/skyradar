# 📖 دليل التثبيت والإعداد الكامل

## المتطلبات الأساسية

### نظام التشغيل
- ✅ Windows 10/11 + WSL2
- ✅ macOS 12+
- ✅ Linux (Ubuntu 20.04+)

### البرامج المطلوبة
```bash
# تحقق من الإصدارات
node --version          # يجب أن يكون 16+
npm --version          # يجب أن يكون 8+
php --version          # يجب أن يكون 8.1+
mysql --version        # يجب أن يكون 8.0+
redis-cli --version    # اختياري
```

---

## 🔧 خطوات التثبيت

### 1. استنساخ المشروع
```bash
git clone https://github.com/yourusername/weather-earth.git
cd weather-earth
```

### 2. إعداد Frontend

#### تثبيت المكتبات
```bash
npm install
```

#### التحقق من المكتبات
```bash
npm list react
npm list leaflet
npm list zustand
```

#### تشغيل بيئة التطوير
```bash
npm run dev
# سيفتح على: http://localhost:5173
```

#### بناء للإنتاج
```bash
npm run build
# سينتج ملف واحد في dist/index.html
```

---

### 3. إعداد Backend

#### الانتقال إلى مجلد Laravel
```bash
cd backend
```

#### تثبيت Composer (إذا لم يكن مثبتاً)
```bash
# على Windows
choco install composer

# على macOS
brew install composer

# على Linux
curl -sS https://getcomposer.org/installer | php
```

#### تثبيت المكتبات
```bash
composer install
```

#### إعداد ملف البيئة
```bash
cp .env.example .env
# أو على Windows
copy .env.example .env
```

#### توليد المفتاح
```bash
php artisan key:generate
```

#### إعداد قاعدة البيانات
```bash
# تعديل .env
DB_DATABASE=weather_earth
DB_USERNAME=root
DB_PASSWORD=

# تشغيل الهجرات
php artisan migrate
```

#### (اختياري) إضافة بيانات وهمية
```bash
php artisan db:seed --class=WeatherDataSeeder
```

#### تشغيل الخادم
```bash
php artisan serve
# سيعمل على: http://localhost:8000
```

---

### 4. إعداد قاعدة البيانات

#### الطريقة 1: استخدام MySQL مباشرة
```bash
# فتح MySQL
mysql -u root -p

# إنشاء قاعدة البيانات
CREATE DATABASE weather_earth;
CREATE USER 'weather'@'localhost' IDENTIFIED BY 'password123';
GRANT ALL PRIVILEGES ON weather_earth.* TO 'weather'@'localhost';
FLUSH PRIVILEGES;
EXIT;

# تحديث .env
DB_DATABASE=weather_earth
DB_USERNAME=weather
DB_PASSWORD=password123

# تشغيل الهجرات
php artisan migrate
```

#### الطريقة 2: استخدام Docker (اختياري)
```bash
# إنشاء container
docker-compose up -d

# تشغيل الهجرات
docker-compose exec app php artisan migrate
```

---

### 5. إعداد Redis (اختياري لكن موصى به)

#### على Windows
```bash
# تثبيت
choco install redis

# تشغيل
redis-server
```

#### على macOS
```bash
# تثبيت
brew install redis

# تشغيل
brew services start redis
```

#### على Linux
```bash
# تثبيت
sudo apt-get install redis-server

# تشغيل
sudo systemctl start redis-server
```

#### التحقق
```bash
redis-cli ping
# يجب أن يرد: PONG
```

---

## 🌐 المتغيرات البيئية

### ملف .env المهم
```ini
# الأساسيات
APP_NAME="راصد ويذر"
APP_ENV=local|production
APP_DEBUG=true|false
APP_URL=http://localhost:8000

# قاعدة البيانات
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=weather_earth
DB_USERNAME=root
DB_PASSWORD=

# الخزن المؤقت
CACHE_DRIVER=redis  # redis|file|memcached
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# نماذج الطقس
WEATHER_DEFAULT_MODEL=GFS  # GFS|ICON
WEATHER_CACHE_TTL=60        # بالدقائق

# مفاتيح API (احصل عليها من المواقع)
OPEN_METEO_API_KEY=free              # مجاني!
NOAA_API_KEY=public                  # مجاني!
NASA_FIRMS_API_KEY=YOUR_KEY_HERE     # طلب من NASA
```

---

## 🧪 اختبار التثبيت

### اختبار Frontend
```bash
# في terminal جديد (من مجلد الجذر)
npm run dev

# افتح المتصفح:
http://localhost:5173

# يجب أن ترى:
✅ الخريطة تحمل
✅ الشريط الجانبي يظهر
✅ مفتاح الألوان في المنتصف
```

### اختبار Backend
```bash
# في terminal جديد (من مجلد backend)
php artisan serve

# جرّب هذا الرابط:
curl http://localhost:8000/api/v1/forecast?lat=24.7136&lon=46.6753&model=GFS

# يجب أن تحصل على JSON بيانات الطقس
```

### اختبار Cron (التحديثات التلقائية)
```bash
# تشغيل مهمة واحدة فقط
php artisan weather:update --type=satellite

# يجب أن ترى:
✓ تم تحديث بيانات الأقمار الصناعية
```

---

## 🚀 التشغيل الكامل

### في Production
```bash
# Backend
cd backend
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan serve --host=0.0.0.0 --port=8000

# Frontend (يتم البناء مرة واحدة)
npm run build
# يتم نسخ dist/index.html إلى backend/public
```

### مع Docker
```bash
# بناء الصور
docker-compose build

# تشغيل الـ containers
docker-compose up -d

# الفحص
docker-compose ps
docker-compose logs -f
```

---

## 🛠️ استكشاف الأخطاء

### المشكلة: لا يمكن الاتصال بـ MySQL
```bash
# تحقق من حالة MySQL
mysql -u root -p -e "SELECT 1;"

# أو
sudo systemctl status mysql

# الحل
sudo systemctl start mysql
```

### المشكلة: Port 8000 مستخدم بالفعل
```bash
# استخدم port مختلف
php artisan serve --port=8001

# أو اعرف ما يستخدم Port 8000 وأغلقه
lsof -i :8000          # على Mac/Linux
netstat -ano | findstr :8000  # على Windows
```

### المشكلة: خطأ في npm install
```bash
# امسح cache
npm cache clean --force

# امسح node_modules
rm -rf node_modules package-lock.json

# أعد التثبيت
npm install
```

### المشكلة: الخريطة لا تحمل
```bash
# تحقق من console في F12
# المشاكل الشائعة:
1. CORS errors → تحقق من config/cors.php
2. API key issues → تحقق من .env
3. Redis not running → redis-cli ping

# الحل
php artisan config:clear
php artisan cache:clear
```

---

## 📊 الملفات المهمة للتعديل

### Frontend
```
src/
├── store/weatherStore.ts          # تعديل الحالة الافتراضية
├── services/weatherService.ts     # تغيير مصدر البيانات
└── components/WeatherMap/
    └── WeatherMap.css             # تخصيص الألوان
```

### Backend
```
backend/
├── config/weather.php             # إعدادات الطقس
├── .env                           # متغيرات البيئة
└── app/Services/                  # منطق الأعمال
```

---

## 📈 الخطوات التالية

### 1. تخصيص الموقع الافتراضي
```typescript
// في store/weatherStore.ts
currentLocation: { lat: 24.7136, lon: 46.6753 }, // غيّر إلى موقعك
```

### 2. إضافة مفتاح API الخاص
```bash
# في .env
NASA_FIRMS_API_KEY=YOUR_ACTUAL_KEY
NOAA_API_KEY=YOUR_ACTUAL_KEY
```

### 3. إعداد البريد الإلكتروني (اختياري)
```bash
# في .env
MAIL_MAILER=smtp
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password
```

### 4. تفعيل SSL (للإنتاج)
```bash
php artisan config:cache
# أضف SSL_ENABLED في .env
```

---

## 🎯 ملخص التثبيت السريع

```bash
# الفرونتند
npm install && npm run dev

# الباك اند (في terminal جديد)
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve

# تم! الآن اذهب إلى:
# http://localhost:5173 (Frontend)
# http://localhost:8000 (Backend)
```

---

## 📞 الدعم والمساعدة

- 📖 اقرأ `COMPLETE_DOCUMENTATION.md` للتفاصيل الكاملة
- 🐛 ابحث عن المشكلة في GitHub Issues
- 💬 اسأل في GitHub Discussions
- 📧 اكتب بريد إلى support@weatherearth.com

---

<div align="center">

### 🎉 تم التثبيت بنجاح!

الآن يمكنك البدء في التطوير والتخصيص

Happy Weather Coding! 🌍⛅

</div>
