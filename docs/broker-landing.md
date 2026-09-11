# RiseStaff Broker

Отдельный лендинг агентств недвижимости: https://broker.risestaff.kz/.
Резервный адрес: https://risestaff.kz/broker.

Страница находится в `app/broker`; Worker отображает её на корне поддомена.
Существующие кабинеты и API используют прежнюю маршрутизацию. База данных и её схема не меняются.

Форма использует `/api/marketing/company-application`: сохраняет контакты в существующую таблицу заявок компании и использует текущую очередь уведомлений. Источник broker.risestaff.kz записывается в комментарий; UTM сохраняются штатным механизмом. Условные имена и вознаграждение в интерактивном примере не являются клиентским кейсом.

Фото: Maks Makarov / Unsplash. Источник: https://unsplash.com/es/fotos/un-edificio-de-apartamentos-con-balcones-y-balcones-en-los-balcones-x33WfmLfZoU . Лицензия: https://unsplash.com/license . Сохранено локально в `public/broker-building.jpg`.

Поддомен привязан к текущему Sites-проекту. Управление DNS: PS.kz. Основной домен и существующие DNS-записи не меняются.
