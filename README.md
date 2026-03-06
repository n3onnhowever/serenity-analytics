# Serenity Analytics

![version](https://img.shields.io/badge/version-0.1.0-purple) 
![built-with](https://img.shields.io/badge/built%20with-React%20%2B%20TypeScript-%236F42C1)

## ✨ Возможност

- 📂 Загрузка трёх наборов данных: **Exxon** (Excel), **S&P 500** (Excel), **WTI** (CSV)  
- 🔄 Автоматическая обработка: объединение по дате, корректировка форматов дат и чисел  
- 📈 ETS-модели (Holt-Winters): линейная, аддитивная и мультипликативная  
- ⚙️ Два режима: автоматический подбор параметров (grid-search) или ручной ввод (α, β, γ)  
- 🔮 Сценарии прогнозов: базовый, оптимистичный (+10%), пессимистичный (−10%)  
- 📊 Метрики качества: MAE и RMSE  
- 💾 Экспорт прогнозов в **XLSX**

---

## 🚀 Быстрый старт

```bash
# 1. Клонировать репозиторий
git clone https://github.com/n3onnhowever/serenity-analytics.git
cd serenity-analytics

# 2. Установить зависимости
npm install

# 3. Запустить dev-сервер
npm run dev

# 4. Открыть в браузере
http://localhost:5173
```

---

## 📂 Структура проекта

```
serenity-analytics/
│
├── src/                     # Исходники приложения
│   ├── components/          # Компоненты интерфейса
│   │   └── ui/              # Базовые UI-элементы (Card, Button и др.)
│   ├── index.css            # Tailwind + стили
│   ├── index.tsx            # Входная точка приложения
│   └── vite-env.d.ts        # Типы Vite
│
├── .gitignore               # Игнорируемые файлы
├── package.json             # Зависимости и скрипты
├── tsconfig.json            # Конфигурация TypeScript
├── vite.config.ts           # Конфигурация Vite
└── README.md                # Документация
```
